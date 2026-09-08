const origins = new Set([
  'https://icarid-liu.me', 'https://www.icarid-liu.me',
  'http://icarid-liu.me', 'http://www.icarid-liu.me',
  'https://icarid-liu.github.io',
]);
const columns = 'id, album, artist, note, name, created_at AS createdAt';
const pageSize = 12;

function database(env) {
  if (!env.DB) throw new Error('Database is unavailable');
  return env.DB;
}

function allowedOrigin(origin, url, env) {
  return origins.has(origin) || origin === url.origin || (
    env.ALLOW_LOCAL_ORIGINS === 'true'
    && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  );
}

function field(body, key, max, required = false) {
  const value = body[key] ?? '';
  if (typeof value !== 'string') throw new Error(`Please check the ${key} field.`);
  const trimmed = value.trim();
  if ((required && !trimmed) || trimmed.length > max) {
    throw new Error(`Please enter ${required ? '1' : '0'}–${max} characters for ${key}.`);
  }
  return trimmed;
}

async function visitorHash(request, secret, now) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const day = new Date(now).toISOString().slice(0, 10);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${day}:${ip}`));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readBody(request) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    bytes += value.byteLength;
    if (bytes > 4096) {
      await reader.cancel();
      throw new RangeError('Your recommendation is too long.');
    }
    text += decoder.decode(value, { stream: true });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const isAllowed = allowedOrigin(origin, url, env);
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin',
      ...(isAllowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const reply = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });

    if (url.pathname === '/' && request.method === 'GET') {
      return Response.redirect('https://icarid-liu.me/soundness.html#recommendations', 302);
    }
    if (url.pathname !== '/api/recommendations') return reply({ error: 'Not found.' }, 404);
    if (origin && !isAllowed) return reply({ error: 'Please use the Soundness page to share a record.' }, 403);
    if (request.method === 'OPTIONS') {
      if (!isAllowed) return reply({ error: 'Origin not allowed.' }, 403);
      return new Response(null, { status: 204, headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      } });
    }

    try {
      const db = database(env);
      if (request.method === 'GET') {
        const cursor = url.searchParams.get('before');
        if (cursor !== null && (!/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor)) || Number(cursor) < 1)) {
          return reply({ error: 'Invalid page.' }, 400);
        }
        const query = cursor === null
          ? db.prepare(`SELECT ${columns} FROM recommendations ORDER BY id DESC LIMIT ?`).bind(pageSize + 1)
          : db.prepare(`SELECT ${columns} FROM recommendations WHERE id < ? ORDER BY id DESC LIMIT ?`).bind(Number(cursor), pageSize + 1);
        const { results } = await query.all();
        const items = results.slice(0, pageSize);
        return reply({ items, next: results.length > pageSize ? items.at(-1).id : null });
      }
      if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST, OPTIONS' });
      if (!isAllowed) return reply({ error: 'Please use the Soundness page to share a record.' }, 403);
      if (!env.RATE_LIMIT_SECRET) return reply({ error: 'Recommendations are temporarily unavailable. Please try again later.' }, 503);
      if (!request.headers.get('Content-Type')?.startsWith('application/json')) return reply({ error: 'Please submit the recommendation form.' }, 415);
      if (Number(request.headers.get('Content-Length')) > 4096) return reply({ error: 'Your recommendation is too long.' }, 413);

      let record;
      try {
        const text = await readBody(request);
        const body = JSON.parse(text);
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Please check your recommendation.');
        if (body.website) throw new Error('Please leave the website field empty.');
        record = { album: field(body, 'album', 120, true), artist: field(body, 'artist', 120, true), note: field(body, 'note', 500), name: field(body, 'name', 60) };
      } catch (error) {
        return reply({ error: error instanceof SyntaxError ? 'Please check your recommendation.' : error.message }, error instanceof RangeError ? 413 : 400);
      }

      const now = Date.now();
      const hash = await visitorHash(request, env.RATE_LIMIT_SECRET, now);
      // The conditional insert makes the one-minute cooldown atomic, even for simultaneous requests.
      const item = await db.prepare(`
        INSERT INTO recommendations (album, artist, note, name, created_at, visitor_hash)
        SELECT ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
          SELECT 1 FROM recommendations WHERE visitor_hash = ? AND created_at > ?
        ) RETURNING ${columns}
      `).bind(record.album, record.artist, record.note, record.name, now, hash, hash, now - 60000).first();
      if (!item) return reply({ error: 'Give the last record a moment to spin. Please wait a minute before posting again.' }, 429, { 'Retry-After': '60' });
      return reply({ item }, 201);
    } catch {
      return reply({ error: 'Recommendations are temporarily unavailable. Please try again later.' }, 503);
    }
  },
};
