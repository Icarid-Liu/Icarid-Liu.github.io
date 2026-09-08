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

  const message = (text, state = '') => {
    status.textContent = text;
    status.dataset.state = state;
  };

  const request = async (url, options = {}) => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, credentials: 'omit' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Please try again in a moment.');
      return data;
    } catch (error) {
      if (error.name === 'AbortError' || error instanceof TypeError || error instanceof SyntaxError) {
        throw new Error('Could not reach the listening list. Please try again in a moment.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
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
      load();
    }, { rootMargin: '500px' });
    observer.observe(section);
  } else {
    load();
  }
})();
