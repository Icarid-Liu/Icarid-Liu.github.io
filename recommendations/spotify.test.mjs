import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSpotifySearch } from './spotify.mjs';

const env = { SPOTIFY_CLIENT_ID: 'test-id', SPOTIFY_CLIENT_SECRET: 'test-secret' };
const id = '0123456789ABCDEFGHIJKL';
const album = { id, name: '寓言', artists: [{ name: '王菲' }], release_date: '2000-10-20', images: [{ url: 'https://i.scdn.co/image/test' }] };
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
const token = () => json({ access_token: 'test-access-token', expires_in: 3600 });

test('server authenticates, searches Chinese queries, normalizes results, and caches credentials/results', async () => {
  const calls = [];
  const search = createSpotifySearch(async (input, options) => {
    const url = new URL(input);
    calls.push(url);
    if (url.hostname === 'accounts.spotify.com') {
      assert.equal(options.method, 'POST');
      assert.equal(options.body, 'grant_type=client_credentials');
      assert.equal(options.headers.Authorization, `Basic ${btoa('test-id:test-secret')}`);
      return token();
    }
    assert.equal(url.searchParams.get('type'), 'album');
    assert.equal(url.searchParams.get('limit'), '8');
    assert.equal(url.searchParams.get('market'), 'HK');
    assert.equal(options.headers.Authorization, 'Bearer test-access-token');
    return json({ albums: { items: [album, album, null, { ...album, id: 'invalid' }] } });
  });
  const items = await search('王菲 寓', env);
  assert.equal(calls[1].searchParams.get('q'), '王菲 寓');
  assert.deepEqual(items, [{ id, album: '寓言', artist: '王菲', year: '2000', image: 'https://i.scdn.co/image/test', url: `https://open.spotify.com/album/${id}` }]);
  assert.deepEqual(await search('王菲 寓', env), items);
  assert.equal(calls.length, 2);
  await search('野外合作社 台', env);
  assert.equal(calls.length, 3);
  assert.equal(JSON.stringify(items).includes('test-access-token'), false);
});

test('concurrent searches share the token request', async () => {
  let tokens = 0;
  const search = createSpotifySearch(async (input) => {
    if (new URL(input).hostname === 'accounts.spotify.com') { tokens++; return token(); }
    return json({ albums: { items: [] } });
  });
  await Promise.all([search('王菲', env), search('罗大佑', env)]);
  assert.equal(tokens, 1);
});

test('expired authorization refreshes once; persistent rejection fails without exposing secrets', async () => {
  let tokens = 0;
  let searches = 0;
  const search = createSpotifySearch(async (input) => {
    if (new URL(input).hostname === 'accounts.spotify.com') { tokens++; return token(); }
    searches++;
    return searches === 2 ? json({ albums: { items: [] } }) : json({ error: 'private upstream details' }, 401);
  });
  assert.deepEqual(await search('王菲', env), []);
  assert.equal(tokens, 2);
  await assert.rejects(search('罗大佑', env), (error) => error.status === 503 && !error.message.includes('private'));
  assert.equal(searches, 4);
});

test('Retry-After stops follow-up requests and missing credentials never call Spotify', async () => {
  let searches = 0;
  const search = createSpotifySearch(async (input) => {
    if (new URL(input).hostname === 'accounts.spotify.com') return token();
    searches++;
    return json({}, 429, { 'Retry-After': '60' });
  });
  await assert.rejects(search('王菲', {}), { status: 503 });
  assert.equal(searches, 0);
  await assert.rejects(search('王菲', env), { status: 429 });
  await assert.rejects(search('罗大佑', env), { status: 429 });
  assert.equal(searches, 1);
});

test('malformed catalog responses fail cleanly and non-Spotify images are omitted', async () => {
  let searches = 0;
  const search = createSpotifySearch(async (input) => {
    if (new URL(input).hostname === 'accounts.spotify.com') return token();
    if (++searches === 1) return json({ unexpected: true });
    return json({ albums: { items: [{ ...album, images: [{ url: 'https://other.example/image' }], artists: [null, { name: '王菲' }], release_date: null }] } });
  });
  await assert.rejects(search('王菲', env), { status: 503 });
  const [item] = await search('王菲 寓', env);
  assert.equal(item.image, null);
  assert.equal(item.artist, '王菲');
  assert.equal(item.year, '');
});
