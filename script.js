const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const copyEmailButton = document.querySelector('[data-copy-email]');
const cursorGlow = document.querySelector('.cursor-glow');
const albumButtons = document.querySelectorAll('[data-spotify-id]');
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

if (
  albumPlayer
  && spotifyFrame
  && playerTitle
  && playerLink
  && spotifyStatusText
  && spotifyRetryButton
  && spotifyFallback
) {
  let spotifyLoadTimer;

  const setSpotifySlow = () => {
    window.clearTimeout(spotifyLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-loading', 'is-ready');
    albumPlayer.classList.add('is-slow');
    albumPlayer.setAttribute('aria-busy', 'false');
    spotifyStatusText.textContent = 'Spotify is taking longer than usual.';
  };

  const setSpotifyReady = () => {
    if (!spotifyFrame.dataset.albumId) return;

    window.clearTimeout(spotifyLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-loading', 'is-slow');
    albumPlayer.classList.add('is-ready');
    albumPlayer.setAttribute('aria-busy', 'false');
  };

  const loadSpotifyAlbum = (albumId, albumTitle, force = false) => {
    if (!albumId || !albumTitle) return;

    const albumUrl = `https://open.spotify.com/album/${albumId}`;
    playerTitle.textContent = albumTitle;
    playerLink.href = albumUrl;
    spotifyFallback.href = albumUrl;

    if (!force && spotifyFrame.dataset.albumId === albumId && spotifyFrame.getAttribute('src')) {
      return;
    }

    window.clearTimeout(spotifyLoadTimer);
    albumPlayer.classList.remove('is-idle', 'is-ready', 'is-slow');
    albumPlayer.classList.add('is-loading');
    albumPlayer.setAttribute('aria-busy', 'true');
    spotifyStatusText.textContent = 'Preparing Spotify player…';
    spotifyFrame.dataset.albumId = albumId;
    spotifyFrame.title = `Spotify album player: ${albumTitle}`;
    spotifyFrame.src = `https://open.spotify.com/embed/album/${albumId}?theme=0${force ? `&retry=${Date.now()}` : ''}`;
    spotifyLoadTimer = window.setTimeout(setSpotifySlow, 10000);
  };

  spotifyFrame.addEventListener('load', setSpotifyReady);
  spotifyFrame.addEventListener('error', setSpotifySlow);

  albumButtons.forEach((button) => {
    button.addEventListener('click', () => {
      albumButtons.forEach((albumButton) => {
        albumButton.setAttribute('aria-pressed', 'false');
        albumButton.closest('.shelf-album')?.classList.remove('is-active');
      });

      const albumId = button.dataset.spotifyId;
      const albumTitle = button.dataset.playerTitle;

      button.setAttribute('aria-pressed', 'true');
      button.closest('.shelf-album')?.classList.add('is-active');
      loadSpotifyAlbum(albumId, albumTitle, albumPlayer.classList.contains('is-slow'));

      albumPlayer.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
  });

  spotifyRetryButton.addEventListener('click', () => {
    const activeAlbum = document.querySelector('[data-spotify-id][aria-pressed="true"]');
    if (activeAlbum) loadSpotifyAlbum(activeAlbum.dataset.spotifyId, activeAlbum.dataset.playerTitle, true);
  });

  const initialAlbum = document.querySelector('[data-spotify-id][aria-pressed="true"]');
  if (initialAlbum) {
    const loadInitialAlbum = () => {
      loadSpotifyAlbum(initialAlbum.dataset.spotifyId, initialAlbum.dataset.playerTitle);
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
