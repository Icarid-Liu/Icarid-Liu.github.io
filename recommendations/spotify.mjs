export const spotifyConfigured = (env) => Boolean(env.SPOTIFY_CLIENT_ID && env.SPOTIFY_CLIENT_SECRET);

export function createSpotifySearch(fetcher = fetch) {
  let token;
  let tokenRequest;
  let credentials;
  let retryAt = 0;
  const results = new Map();

  const unavailable = (message, status = 503) => Object.assign(new Error(message), { status });
  const limited = (response) => {
    const seconds = Number(response.headers.get('Retry-After'));
    retryAt = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 86400) : 30) * 1000;
    return unavailable('Spotify is busy. Please try again shortly, or enter the record manually.', 429);
  };
  const accessToken = async (env) => {
    if (token && token.expires > Date.now()) return token.value;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const response = await fetcher('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 429) throw limited(response);
      if (!response.ok) throw unavailable('Spotify search is unavailable. You can still enter the album and artist manually.');
      const data = await response.json();
      if (typeof data.access_token !== 'string' || !Number.isFinite(data.expires_in)) throw unavailable('Spotify search is unavailable. Please try again later.');
      token = { value: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
      return token.value;
    })();
    try { return await tokenRequest; } finally { tokenRequest = null; }
  };

  return async (query, env) => {
    if (!spotifyConfigured(env)) throw unavailable('Spotify search is not available yet. You can still enter the album and artist manually.');
    const currentCredentials = `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`;
    if (credentials !== currentCredentials) {
      credentials = currentCredentials;
      token = null;
      results.clear();
      retryAt = 0;
    }
    const market = /^[A-Z]{2}$/.test(env.SPOTIFY_MARKET || '') ? env.SPOTIFY_MARKET : 'HK';
    const key = `${market}:${query.toLocaleLowerCase()}`;
    const cached = results.get(key);
    if (cached?.expires > Date.now()) return cached.items;
    if (retryAt > Date.now()) throw unavailable('Spotify is busy. Please try again shortly, or enter the record manually.', 429);

    const url = new URL('https://api.spotify.com/v1/search');
    url.search = new URLSearchParams({ q: query, type: 'album', limit: '8', market }).toString();
    const search = async () => fetcher(url, {
      headers: { Authorization: `Bearer ${await accessToken(env)}` },
      signal: AbortSignal.timeout(8000),
    });
    let response = await search();
    if (response.status === 401) {
      token = null;
      response = await search();
    }
    if (response.status === 429) throw limited(response);
    if (!response.ok) throw unavailable('Spotify search is unavailable. You can still enter the album and artist manually.');
    const data = await response.json();
    if (!Array.isArray(data.albums?.items)) throw unavailable('Spotify did not return album results. Please try again.');
    const seen = new Set();
    const items = data.albums.items.filter((album) => {
      if (!album || !/^[A-Za-z0-9]{22}$/.test(album.id) || typeof album.name !== 'string' || !Array.isArray(album.artists) || seen.has(album.id)) return false;
      seen.add(album.id);
      return true;
    }).slice(0, 8).map((album) => ({
      id: album.id,
      album: album.name,
      artist: album.artists.map((artist) => artist?.name).filter((name) => typeof name === 'string').join(', '),
      year: typeof album.release_date === 'string' ? album.release_date.slice(0, 4) : '',
      image: (Array.isArray(album.images) ? album.images : []).find((image) => /^https:\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\//.test(image?.url || ''))?.url || null,
      url: `https://open.spotify.com/album/${album.id}`,
    }));
    if (results.size >= 100) results.delete(results.keys().next().value);
    results.set(key, { items, expires: Date.now() + 60000 });
    return items;
  };
}
