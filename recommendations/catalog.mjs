const normalized = (text) => text.normalize('NFKC').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
const unavailable = (message, status = 503) => Object.assign(new Error(message), { status });

// iTunes Search needs no key or subscription. Keep its small public quota in mind:
// cache artist results so refining a title usually requires no new upstream call.
export function createAlbumSearch(fetcher = fetch, now = Date.now) {
  const cache = new Map();
  const pending = new Map();
  let calls = [];
  let retryAt = 0;
  const busy = () => unavailable('Album search is busy. Please try again shortly, or enter the record below.', 429);

  const cached = (key) => {
    const value = cache.get(key);
    return value?.expires > now() ? value.items : null;
  };
  const lookup = async (query) => {
    const key = normalized(query);
    const hit = cached(key);
    if (hit) return hit;
    if (pending.has(key)) return pending.get(key);
    calls = calls.filter((time) => time > now() - 60000);
    if (retryAt > now() || calls.length >= 18) throw busy();
    calls.push(now());
    const task = (async () => {
      const url = new URL('https://itunes.apple.com/search');
      url.search = new URLSearchParams({ term: query, entity: 'album', media: 'music', country: 'HK', limit: '50' }).toString();
      const response = await fetcher(url, { signal: AbortSignal.timeout(6000) });
      if (response.status === 429) {
        const seconds = Number(response.headers.get('Retry-After'));
        retryAt = now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 60) * 1000;
        throw busy();
      }
      if (!response.ok) throw unavailable('Album search is unavailable. You can still enter the record below.');
      const data = await response.json();
      if (!Array.isArray(data.results)) throw unavailable('Could not read the album catalog. Please try again.');
      const seen = new Set();
      const items = data.results.filter((item) => {
        if (!item || item.collectionType !== 'Album' || !Number.isSafeInteger(item.collectionId) || item.collectionId < 1
          || typeof item.collectionName !== 'string' || !item.collectionName.trim()
          || typeof item.artistName !== 'string' || !item.artistName.trim() || seen.has(item.collectionId)) return false;
        seen.add(item.collectionId);
        return true;
      }).slice(0, 50).map((item) => ({
        id: String(item.collectionId), album: item.collectionName, artist: item.artistName,
        year: typeof item.releaseDate === 'string' ? item.releaseDate.slice(0, 4) : '',
      }));
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      cache.set(key, { items, expires: now() + 600000 });
      return items;
    })();
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  };

  return async (query) => {
    const key = normalized(query);
    const words = key.split(' ');
    // Use an already fetched artist's catalog for Chinese one-character prefixes
    // as well as multiword titles such as "Radiohead in ra".
    for (let split = words.length - 1; split > 0; split--) {
      const artistAlbums = cached(words.slice(0, split).join(' '));
      const matching = artistAlbums?.filter((item) => words.slice(split).every((word) => normalized(item.album).includes(word)));
      if (matching?.length) return matching.slice(0, 8);
    }
    const items = await lookup(query);
    if (words.length < 2) return items.slice(0, 8);
    const titlePart = words.at(-1);
    const matching = items.filter((item) => normalized(item.album).includes(titlePart));
    if (matching.length) return matching.slice(0, 8);
    // A combined iTunes query can miss "王菲 寓" even though searching the
    // artist returns 寓言. Broaden once, then filter the returned album titles.
    const artistAlbums = await lookup(words.slice(0, -1).join(' '));
    const refined = artistAlbums.filter((item) => normalized(item.album).includes(titlePart));
    return (refined.length ? refined : items).slice(0, 8);
  };
}
