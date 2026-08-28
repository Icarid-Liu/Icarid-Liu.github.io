const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const copyEmailButton = document.querySelector('[data-copy-email]');
const cursorGlow = document.querySelector('.cursor-glow');
const portalTransition = document.querySelector('[data-portal-transition]');
const portalLinks = document.querySelectorAll('[data-portal-link]');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const albumButtons = document.querySelectorAll('[data-spotify-id], [data-bandcamp-album]');
const albumPlayer = document.querySelector('[data-album-player]');
const spotifyFrame = document.querySelector('[data-spotify-frame]');
const playerTitle = albumPlayer?.querySelector('[data-player-title]');
const playerLink = albumPlayer?.querySelector('[data-player-link]');
const spotifyStatusText = albumPlayer?.querySelector('[data-spotify-status-text]');
const spotifyRetryButton = albumPlayer?.querySelector('[data-spotify-retry]');
const spotifyFallback = albumPlayer?.querySelector('[data-spotify-fallback]');

document.querySelector('#current-year').textContent = new Date().getFullYear();

if (menuToggle && siteNav) {
  menuToggle.addEventListener('click', () => {
    const open = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!open));
    siteNav.classList.toggle('is-open', !open);
  });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      siteNav.classList.remove('is-open');
    });
  });
}

if (portalTransition) {
  let portalNavigating = false;

  const clearPortalArrival = () => {
    document.documentElement.classList.remove('portal-arrival');
    portalTransition.classList.remove('is-departing');
    document.body.classList.remove('portal-traveling');
    portalNavigating = false;

    try {
      window.sessionStorage.removeItem('soundness-portal');
    } catch {}
  };

  if (document.documentElement.classList.contains('portal-arrival')) {
    window.setTimeout(clearPortalArrival, 760);
  }

  if (!reducedMotionQuery.matches) {
    portalLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (
          portalNavigating
          || event.defaultPrevented
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
        ) return;

        event.preventDefault();
        portalNavigating = true;

        const rect = link.getBoundingClientRect();
        portalTransition.style.setProperty('--portal-x', `${rect.left + rect.width / 2}px`);
        portalTransition.style.setProperty('--portal-y', `${rect.top + rect.height / 2}px`);
        portalTransition.classList.add('is-departing');
        document.body.classList.add('portal-traveling');

        try {
          window.sessionStorage.setItem('soundness-portal', '1');
        } catch {}

        window.setTimeout(() => window.location.assign(link.href), 700);
      });
    });
  }

  window.addEventListener('pageshow', (event) => {
    if (event.persisted) clearPortalArrival();
  });
}

if (
  albumPlayer
  && spotifyFrame
  && playerTitle
  && playerLink
  && spotifyStatusText
  && spotifyRetryButton
  && spotifyFallback
) {
  let playerLoadTimer;
  let currentProvider = 'Spotify';

  const setPlayerSlow = () => {
    window.clearTimeout(playerLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-loading', 'is-ready');
    albumPlayer.classList.add('is-slow');
    albumPlayer.setAttribute('aria-busy', 'false');
    spotifyStatusText.textContent = `${currentProvider} is taking longer than usual.`;
  };

  const setPlayerReady = () => {
    if (!spotifyFrame.dataset.playerKey) return;

    window.clearTimeout(playerLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-loading', 'is-slow');
    albumPlayer.classList.add('is-ready');
    albumPlayer.setAttribute('aria-busy', 'false');
  };

  const getAlbumSource = (button) => {
    const albumTitle = button.dataset.playerTitle;
    const bandcampAlbum = button.dataset.bandcampAlbum;

    if (bandcampAlbum) {
      return {
        albumTitle,
        albumUrl: button.dataset.playerUrl,
        embedUrl: `https://bandcamp.com/EmbeddedPlayer/album=${bandcampAlbum}/size=large/bgcol=121212/linkcol=d7ff52/tracklist=false/artwork=small/transparent=true/`,
        key: `bandcamp:${bandcampAlbum}`,
        provider: 'Bandcamp',
      };
    }

    const spotifyId = button.dataset.spotifyId;
    return {
      albumTitle,
      albumUrl: `https://open.spotify.com/album/${spotifyId}`,
      embedUrl: `https://open.spotify.com/embed/album/${spotifyId}?theme=0`,
      key: `spotify:${spotifyId}`,
      provider: 'Spotify',
    };
  };

  const loadAlbum = (button, force = false) => {
    const source = getAlbumSource(button);
    if (!source.albumTitle || !source.albumUrl || !source.key) return;

    currentProvider = source.provider;
    playerTitle.textContent = source.albumTitle;
    playerLink.href = source.albumUrl;
    playerLink.textContent = `${source.provider} ↗`;
    spotifyFallback.href = source.albumUrl;
    spotifyFallback.textContent = `Open ${source.provider} ↗`;

    if (!force && spotifyFrame.dataset.playerKey === source.key && spotifyFrame.getAttribute('src')) {
      return;
    }

    window.clearTimeout(playerLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-ready', 'is-slow');
    albumPlayer.classList.add('is-loading');
    albumPlayer.setAttribute('aria-busy', 'true');
    spotifyStatusText.textContent = `Preparing ${source.provider} player…`;
    spotifyFrame.dataset.playerKey = source.key;
    spotifyFrame.title = `${source.provider} album player: ${source.albumTitle}`;
    spotifyFrame.src = `${source.embedUrl}${force ? `${source.embedUrl.includes('?') ? '&' : '?'}retry=${Date.now()}` : ''}`;
    playerLoadTimer = window.setTimeout(setPlayerSlow, 10000);
  };

  spotifyFrame.addEventListener('load', setPlayerReady);
  spotifyFrame.addEventListener('error', setPlayerSlow);

  albumButtons.forEach((button) => {
    button.addEventListener('click', () => {
      albumButtons.forEach((albumButton) => {
        albumButton.setAttribute('aria-pressed', 'false');
        albumButton.closest('.shelf-album')?.classList.remove('is-active');
      });

      button.setAttribute('aria-pressed', 'true');
      button.closest('.shelf-album')?.classList.add('is-active');
      loadAlbum(button, albumPlayer.classList.contains('is-slow'));

      albumPlayer.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
  });

  spotifyRetryButton.addEventListener('click', () => {
    const activeAlbum = [...albumButtons].find((button) => button.getAttribute('aria-pressed') === 'true');
    if (activeAlbum) loadAlbum(activeAlbum, true);
  });

  const initialAlbum = [...albumButtons].find((button) => button.getAttribute('aria-pressed') === 'true');
  if (initialAlbum) {
    const loadInitialAlbum = () => {
      loadAlbum(initialAlbum);
    };

    if ('IntersectionObserver' in window) {
      const spotifyObserver = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          loadInitialAlbum();
          spotifyObserver.disconnect();
        },
        { rootMargin: '900px 0px', threshold: 0 },
      );
      spotifyObserver.observe(albumPlayer);
    } else {
      loadInitialAlbum();
    }
  }
}

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 },
);

document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));

if (copyEmailButton) {
  copyEmailButton.addEventListener('click', async () => {
    const email = copyEmailButton.dataset.copyEmail;

    try {
      await navigator.clipboard.writeText(email);
      copyEmailButton.textContent = 'Copied — nice.';
    } catch {
      copyEmailButton.textContent = email;
    }

    window.setTimeout(() => {
      copyEmailButton.textContent = 'Copy email';
    }, 2200);
  });
}

if (cursorGlow && window.matchMedia('(pointer: fine)').matches) {
  window.addEventListener('pointermove', (event) => {
    cursorGlow.style.left = `${event.clientX}px`;
    cursorGlow.style.top = `${event.clientY}px`;
    cursorGlow.classList.add('is-visible');
  });
  window.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) cursorGlow.classList.remove('is-visible');
  });
} else if (cursorGlow) {
  cursorGlow.style.display = 'none';
}
