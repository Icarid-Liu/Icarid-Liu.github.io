import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Miniflare } from 'miniflare';

test('anonymous recommendations persist, paginate, validate input, and limit repeated posts', async () => {
  const storage = await mkdtemp(join(tmpdir(), 'soundness-test-'));
  const options = {
    modules: true,
    scriptPath: 'worker.js',
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    d1Persist: storage,
    bindings: { RATE_LIMIT_SECRET: 'test-only-secret' },
  };
  let worker = new Miniflare(options);
  const origin = 'https://icarid-liu.me';
  const url = 'https://recommendations.example/api/recommendations';
  const post = (body, ip = '192.0.2.1') => worker.dispatchFetch(url, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });

  try {
    const db = await worker.getD1Database('DB');
    for (const name of (await readdir('drizzle')).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = await readFile(`drizzle/${name}`, 'utf8');
      await db.batch(sql.split('--> statement-breakpoint').map((statement) => db.prepare(statement.trim())));
    }
    const preflight = await worker.dispatchFetch(url, { method: 'OPTIONS', headers: { Origin: origin } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('Access-Control-Allow-Origin'), origin);

    const empty = await worker.dispatchFetch(url);
    assert.deepEqual(await empty.json(), { items: [], next: null });
    assert.equal((await post({ album: '  ', artist: '王菲' })).status, 400);
    assert.equal((await post({ album: '寓言', artist: '王菲', note: 'x'.repeat(501) })).status, 400);
    assert.equal((await post({ album: '寓言', artist: '王菲', note: 'x'.repeat(5000) })).status, 413);
    assert.equal((await post({ album: '寓言', artist: '王菲', website: 'filled' })).status, 400);
    const foreign = await worker.dispatchFetch(url, { method: 'POST', headers: { Origin: 'https://other.example' }, body: '{}' });
    assert.equal(foreign.status, 403);

    const saved = await post({ album: ' 寓言 ', artist: '王菲', note: '一直在听。', name: '' });
    assert.equal(saved.status, 201);
    const { item } = await saved.json();
    assert.equal(item.album, '寓言');
    assert.equal(item.note, '一直在听。');
    assert.equal(item.name, '');
    assert.ok(Number.isInteger(item.id));
    assert.equal('visitor_hash' in item, false);
    const limited = await post({ album: '台风', artist: '野外合作社' });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('Retry-After'), '60');

    const simultaneous = await Promise.all([
      post({ album: '台风', artist: '野外合作社' }, '192.0.2.2'),
      post({ album: '冀西南林路行', artist: '万能青年旅店' }, '192.0.2.2'),
    ]);
    assert.deepEqual(simultaneous.map((response) => response.status).sort(), [201, 429]);

    await db.batch(Array.from({ length: 13 }, (_, index) => db.prepare(
      'INSERT INTO recommendations (album, artist, note, name, created_at, visitor_hash) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(`Test record ${index}`, 'Test artist', '', '', Date.now(), `test-${index}`)));
    const pageOne = await (await worker.dispatchFetch(url)).json();
    assert.equal(pageOne.items.length, 12);
    assert.equal(pageOne.next, pageOne.items.at(-1).id);
    const pageTwo = await (await worker.dispatchFetch(`${url}?before=${pageOne.next}`)).json();
    assert.equal(pageTwo.items.length, 3);
    assert.equal(pageTwo.next, null);
    assert.equal(new Set([...pageOne.items, ...pageTwo.items].map((row) => row.id)).size, 15);
    assert.equal((await worker.dispatchFetch(`${url}?before=abc`)).status, 400);

    await worker.dispose();
    worker = new Miniflare(options);
    const reloaded = await (await worker.dispatchFetch(`${url}?before=${pageOne.next}`)).json();
    assert.deepEqual(reloaded.items.find((row) => row.id === item.id), item);
    assert.equal(JSON.stringify(reloaded).includes('visitor_hash'), false);
  } finally {
    await worker.dispose();
    await rm(storage, { recursive: true, force: true });
  }
});
