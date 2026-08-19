const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const copyEmailButton = document.querySelector('[data-copy-email]');
const cursorGlow = document.querySelector('.cursor-glow');
const portalIntro = document.querySelector('[data-portal-intro]');
const albumButtons = document.querySelectorAll('[data-spotify-id]');
const albumPlayer = document.querySelector('[data-album-player]');
const spotifyFrame = document.querySelector('[data-spotify-frame]');
const playerTitle = albumPlayer?.querySelector('[data-player-title]');
const playerLink = albumPlayer?.querySelector('[data-player-link]');

document.querySelector('#current-year').textContent = new Date().getFullYear();

if (portalIntro) {
  const removePortal = () => portalIntro.remove();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    removePortal();
  } else {
    portalIntro.addEventListener('animationend', (event) => {
      if (event.target === portalIntro) removePortal();
    });
    window.setTimeout(removePortal, 2600);
  }
}

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

if (albumPlayer && spotifyFrame && playerTitle && playerLink) {
  spotifyFrame.addEventListener('load', () => albumPlayer.classList.remove('is-loading'));

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
      playerTitle.textContent = albumTitle;
      playerLink.href = `https://open.spotify.com/album/${albumId}`;

      if (spotifyFrame.dataset.albumId !== albumId) {
        albumPlayer.classList.add('is-loading');
        spotifyFrame.dataset.albumId = albumId;
        spotifyFrame.title = `Spotify album player: ${albumTitle}`;
        spotifyFrame.src = `https://open.spotify.com/embed/album/${albumId}?utm_source=generator&theme=0`;
      }

      albumPlayer.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
  });
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
  });
} else if (cursorGlow) {
  cursorGlow.style.display = 'none';
}
