(() => {
  const section = document.querySelector('[data-recommendations-api]');
  if (!section) return;

  const form = section.querySelector('[data-recommendation-form]');
  const submit = form.querySelector('[type="submit"]');
  const status = section.querySelector('[data-recommendation-status]');
  const listStatus = section.querySelector('[data-recommendation-list-status]');
  const list = section.querySelector('[data-recommendation-list]');
  const refresh = section.querySelector('[data-recommendation-refresh]');
  const more = section.querySelector('[data-recommendation-more]');
  const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const api = local ? 'http://127.0.0.1:8787/api/recommendations' : section.dataset.recommendationsApi;
  let next = null;
  let loadVersion = 0;
  let posting = false;
  let selectedSpotifyId = '';

  const message = (text, state = '') => {
    status.textContent = text;
    status.dataset.state = state;
  };

  const request = async (url, options = {}) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options.signal?.aborted) abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'omit' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please try again in a moment.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) {
        throw new Error('Could not reach the service. Please try again in a moment.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  };

  const searchBox = section.querySelector('[data-album-search]');
  const searchInput = searchBox.querySelector('input');
  const suggestions = searchBox.querySelector('[role="listbox"]');
  const searchHelp = searchBox.querySelector('[role="status"]');
  const selection = searchBox.querySelector('[data-album-selection]');
  const searchHint = searchHelp.textContent;
  let searchTimer;
  let searchController;
  let searchVersion = 0;
  let composing = false;
  let albums = [];
  let activeAlbum = -1;

  const dismissSearch = () => {
    ++searchVersion;
    window.clearTimeout(searchTimer);
    searchController?.abort();
    suggestions.hidden = true;
    suggestions.replaceChildren();
    searchInput.setAttribute('aria-expanded', 'false');
    searchInput.removeAttribute('aria-activedescendant');
    searchInput.removeAttribute('aria-busy');
    albums = [];
    activeAlbum = -1;
  };
  const clearSelection = () => {
    selectedSpotifyId = '';
    selection.hidden = true;
    selection.removeAttribute('href');
  };
  const chooseAlbum = (index) => {
    const item = albums[index];
    if (!item) return;
    form.elements.album.value = item.album;
    form.elements.artist.value = item.artist;
    selectedSpotifyId = item.id;
    selection.href = `https://open.spotify.com/album/${item.id}`;
    selection.textContent = `${item.album} · Open on Spotify ↗`;
    selection.hidden = false;
    searchInput.value = `${item.artist} — ${item.album}`;
    dismissSearch();
    searchHelp.textContent = 'Record selected. Add a thought below and pass it along.';
    form.elements.note.focus();
  };
  const highlightAlbum = (index) => {
    activeAlbum = index;
    [...suggestions.children].forEach((option, i) => option.setAttribute('aria-selected', String(i === index)));
    const option = suggestions.children[index];
    searchInput.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  };
  const scheduleSearch = () => {
    dismissSearch();
    clearSelection();
    const query = searchInput.value.trim();
    if (composing || query.length < 2) {
      searchHelp.textContent = searchHint;
      return;
    }
    const version = searchVersion;
    searchHelp.textContent = 'Searching Spotify…';
    searchInput.setAttribute('aria-busy', 'true');
    searchTimer = window.setTimeout(async () => {
      searchController = new AbortController();
      try {
        const url = new URL('/api/spotify/search', api);
        url.searchParams.set('q', query);
        const data = await request(url, { signal: searchController.signal });
        if (version !== searchVersion) return;
        if (!Array.isArray(data.items)) throw new Error('Could not read Spotify results. You can enter the record below.');
        albums = data.items.filter((item) => /^[A-Za-z0-9]{22}$/.test(item.id)
          && typeof item.album === 'string' && typeof item.artist === 'string');
        suggestions.replaceChildren(...albums.map((item, index) => {
          const option = document.createElement('li');
          option.id = `album-option-${version}-${index}`;
          option.setAttribute('role', 'option');
          option.setAttribute('aria-selected', 'false');
          if (/^https:\/\/(i\.scdn\.co|[a-z0-9-]+\.spotifycdn\.com)\//.test(item.image || '')) {
            const cover = document.createElement('img');
            cover.src = item.image;
            cover.alt = '';
            cover.width = 48;
            cover.height = 48;
            option.append(cover);
          }
          const details = document.createElement('span');
          const title = document.createElement('strong');
          title.textContent = item.album;
          const credit = document.createElement('small');
          credit.textContent = `${item.artist}${item.year ? ` · ${item.year}` : ''}`;
          details.append(title, credit);
          option.append(details);
          option.addEventListener('pointerdown', (event) => event.preventDefault());
          option.addEventListener('click', () => chooseAlbum(index));
          return option;
        }));
        suggestions.hidden = albums.length === 0;
        searchInput.setAttribute('aria-expanded', String(albums.length > 0));
        searchHelp.textContent = albums.length
          ? `${albums.length} albums from Spotify. Choose one, or use ↑ ↓ and Enter.`
          : 'No albums found. Try another spelling, or enter the record below.';
      } catch (error) {
        if (version === searchVersion) searchHelp.textContent = `${error.message} You can fill in the fields below.`;
      } finally {
        if (version === searchVersion) searchInput.removeAttribute('aria-busy');
      }
    }, 350);
  };
  searchInput.addEventListener('input', scheduleSearch);
  searchInput.addEventListener('compositionstart', () => { composing = true; dismissSearch(); });
  searchInput.addEventListener('compositionend', () => { composing = false; scheduleSearch(); });
  searchInput.addEventListener('focus', () => { if (!selectedSpotifyId) scheduleSearch(); });
  searchInput.addEventListener('blur', () => {
    dismissSearch();
    if (!selectedSpotifyId) searchHelp.textContent = searchHint;
  });
  searchInput.addEventListener('keydown', (event) => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { dismissSearch(); searchHelp.textContent = searchHint; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeAlbum >= 0) chooseAlbum(activeAlbum);
    }
    if (albums.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      highlightAlbum(activeAlbum < 0 ? (event.key === 'ArrowDown' ? 0 : albums.length - 1)
        : (activeAlbum + (event.key === 'ArrowDown' ? 1 : -1) + albums.length) % albums.length);
    }
  });
  for (const field of ['album', 'artist']) form.elements[field].addEventListener('input', clearSelection);
  form.addEventListener('reset', () => { dismissSearch(); clearSelection(); searchHelp.textContent = searchHint; });

  // Keep the manual form available while the owner connects Spotify.
  const enableSearch = async () => {
    try {
      const data = await request(new URL('/api/spotify/status', api));
      searchBox.hidden = data.enabled !== true;
    } catch { /* The manual form remains usable if Spotify cannot be reached. */ }
  };

  const recordElement = (item) => {
    const article = document.createElement('article');
    article.className = 'visitor-record';
    article.dataset.recordId = item.id;
    const append = (tag, className, text) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = text;
      article.append(element);
    };
    append('h4', 'visitor-record-title', item.album);
    append('p', 'visitor-record-artist', item.artist);
    if (/^[A-Za-z0-9]{22}$/.test(item.spotifyId || '')) {
      const link = document.createElement('a');
      link.className = 'visitor-record-spotify';
      link.href = `https://open.spotify.com/album/${item.spotifyId}`;
      link.textContent = 'Open on Spotify ↗';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      article.append(link);
    }
    if (item.note) append('p', 'visitor-record-note', item.note);
    const date = new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    append('p', 'visitor-record-credit', `${item.name || 'Anonymous listener'} · ${date}`);
    return article;
  };

  const load = async (append = false) => {
    const version = ++loadVersion;
    refresh.disabled = true;
    more.disabled = true;
    listStatus.textContent = 'Loading recommendations…';
    try {
      const url = new URL(api);
      if (append && next !== null) url.searchParams.set('before', next);
      const data = await request(url);
      if (version !== loadVersion) return;
      if (!Array.isArray(data.items)) throw new Error('Could not read the listening list. Please try again.');
      if (!append) list.replaceChildren();
      const existing = new Set([...list.children].map((element) => Number(element.dataset.recordId)));
      for (const item of data.items) {
        if (!existing.has(item.id)) list.append(recordElement(item));
      }
      next = data.next;
      more.hidden = next === null;
      listStatus.textContent = list.children.length ? '' : 'The next discovery could be yours. Leave the first recommendation.';
    } catch (error) {
      if (version === loadVersion) listStatus.textContent = error.message;
    } finally {
      if (version === loadVersion) {
        refresh.disabled = false;
        more.disabled = false;
      }
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (posting || !form.reportValidity()) return;
    const fields = new FormData(form);
    const body = Object.fromEntries(['album', 'artist', 'note', 'name', 'website'].map((key) => [key, String(fields.get(key) || '').trim()]));
    if (selectedSpotifyId) body.spotifyId = selectedSpotifyId;
    if (!body.album || !body.artist) {
      message('Please add both the album and its artist.', 'error');
      form.elements[!body.album ? 'album' : 'artist'].focus();
      return;
    }
    posting = true;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message('Adding your record…');
    try {
      const data = await request(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!data.item?.id) throw new Error('Could not confirm your recommendation. Please refresh the list before trying again.');
      // Cancel the effect of an older list request so it cannot erase the newly saved record.
      ++loadVersion;
      refresh.disabled = false;
      more.disabled = false;
      list.prepend(recordElement(data.item));
      listStatus.textContent = '';
      form.reset();
      message('Your record is on the list. Thanks for passing it along.', 'success');
    } catch (error) {
      message(error.message, 'error');
    } finally {
      posting = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });

  refresh.addEventListener('click', () => load());
  more.addEventListener('click', () => load(true));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      enableSearch();
      load();
    }, { rootMargin: '500px' });
    observer.observe(section);
  } else {
    enableSearch();
    load();
  }
})();
