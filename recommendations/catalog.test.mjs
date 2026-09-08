import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAlbumSearch } from './catalog.mjs';

const album = { collectionType: 'Album', collectionId: 123456789, collectionName: '寓言', artistName: '王菲', releaseDate: '2000-10-20T00:00:00Z' };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });

test('search needs no credentials and normalizes valid albums without trusting upstream links', async () => {
  let calls = 0;
  const search = createAlbumSearch(async (input, options) => {
    calls++;
    const url = new URL(input);
    assert.equal(url.origin, 'https://itunes.apple.com');
    assert.equal(url.searchParams.get('term'), '王菲');
    assert.equal(url.searchParams.get('entity'), 'album');
    assert.equal(url.searchParams.get('country'), 'HK');
    assert.equal(url.searchParams.get('limit'), '50');
    assert.equal(options.headers, undefined);
    return json({ results: [album, album, null, { ...album, collectionId: -1 }, { ...album, collectionType: 'Song' }, { ...album, artistName: '' }] });
  });
  const expected = [{ id: '123456789', album: '寓言', artist: '王菲', year: '2000' }];
  assert.deepEqual(await search('王菲'), expected);
  assert.deepEqual(await search('王菲'), expected);
  assert.equal(calls, 1);
});

test('a short Chinese album title falls back to artist results and subsequent refinements use that cache', async () => {
  const terms = [];
  const search = createAlbumSearch(async (input) => {
    const term = new URL(input).searchParams.get('term');
    terms.push(term);
    return json({ results: term === '王菲' ? [album] : [] });
  });
  assert.equal((await search('王菲 寓'))[0].album, '寓言');
  assert.deepEqual(terms, ['王菲 寓', '王菲']);
  assert.equal((await search('王菲 寓言'))[0].album, '寓言');
  assert.equal(terms.length, 2);
});

test('cached artist albums match multiword English titles and duplicate in-flight queries are coalesced', async () => {
  let calls = 0;
  const search = createAlbumSearch(async () => {
    calls++;
    return json({ results: [{ ...album, artistName: 'Radiohead', collectionName: 'In Rainbows' }] });
  });
  await Promise.all([search('Radiohead'), search('Radiohead')]);
  assert.equal(calls, 1);
  assert.equal((await search('Radiohead in ra'))[0].album, 'In Rainbows');
  assert.equal(calls, 1);
});

test('multiword artist names still work and unrelated fuzzy results do not become title matches', async () => {
  const search = createAlbumSearch(async (input) => {
    const term = new URL(input).searchParams.get('term');
    if (term === 'Pink Floyd') return json({ results: [{ ...album, artistName: 'Pink Floyd', collectionName: 'The Dark Side of the Moon' }] });
    if (term === '罗大佑') return json({ results: [{ ...album, artistName: '羅大佑', collectionName: '之乎者也' }] });
    return json({ results: [{ ...album, artistName: 'Unrelated artist', collectionName: 'Unrelated recording' }] });
  });
  assert.equal((await search('Pink Floyd'))[0].album, 'The Dark Side of the Moon');
  assert.deepEqual(await search('罗大佑 皇后'), []);
});

test('cached results expire and the rolling upstream budget recovers', async () => {
  let time = 1000000;
  let calls = 0;
  const search = createAlbumSearch(async () => { calls++; return json({ results: [] }); }, () => time);
  for (let i = 0; i < 18; i++) await search(`query${i}`);
  await assert.rejects(search('extra'), { status: 429 });
  assert.equal(calls, 18);
  await search('query0');
  assert.equal(calls, 18);
  time += 60001;
  await search('extra');
  assert.equal(calls, 19);
  time += 600000;
  await search('query0');
  assert.equal(calls, 20);
});

test('upstream Retry-After prevents repeated requests until the cooldown ends', async () => {
  let time = 1000000;
  let calls = 0;
  const search = createAlbumSearch(async () => {
    calls++;
    return calls === 1 ? json({}, 429, { 'Retry-After': '120' }) : json({ results: [] });
  }, () => time);
  await assert.rejects(search('王菲'), { status: 429 });
  await assert.rejects(search('Radiohead'), { status: 429 });
  assert.equal(calls, 1);
  time += 120001;
  assert.deepEqual(await search('Radiohead'), []);
});

test('upstream failures are not cached and malformed results fail clearly', async () => {
  let calls = 0;
  const search = createAlbumSearch(async () => {
    if (++calls === 1) return json({ internal: 'private details' }, 500);
    if (calls === 2) return json({ unexpected: true });
    return json({ results: [] });
  });
  await assert.rejects(search('王菲'), (error) => error.status === 503 && !error.message.includes('private'));
  await assert.rejects(search('王菲'), { status: 503 });
  assert.deepEqual(await search('王菲'), []);
});
