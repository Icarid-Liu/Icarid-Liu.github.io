const menuToggle = document.querySelector('.menu-toggle');
const siteNav = document.querySelector('.site-nav');
const navLinks = document.querySelectorAll('.site-nav a');
const copyEmailButton = document.querySelector('[data-copy-email]');
const cursorGlow = document.querySelector('.cursor-glow');
const portalTransition = document.querySelector('[data-portal-transition]');
const portalCanvas = document.querySelector('[data-portal-canvas]');
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
const portalRevealDuration = 300;
const portalHoldDuration = 1000;
const portalExpansionDuration = 460;
const portalOpeningDuration = portalRevealDuration + portalHoldDuration + portalExpansionDuration;
const portalArrivalDuration = 820;

document.querySelector('#current-year').textContent = new Date().getFullYear();

const createPortalRenderer = (canvas) => {
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return null;

  const fullCircle = Math.PI * 2;
  let animationFrameId;
  let animationStartTime;
  let animationMode = 'opening';
  let originHorizontal = window.innerWidth / 2;
  let originVertical = window.innerHeight / 2;
  let viewportWidth = window.innerWidth;
  let viewportHeight = window.innerHeight;
  let pixelRatio = 1;

  const clamp = (value, minimum, maximum) => Math.min(Math.max(value, minimum), maximum);
  const interpolate = (start, end, progress) => start + (end - start) * progress;
  const easeOutCubic = (progress) => 1 - ((1 - progress) ** 3);
  const easeInCubic = (progress) => progress ** 3;
  const easeInOutCubic = (progress) => (
    progress < 0.5
      ? 4 * (progress ** 3)
      : 1 - ((-2 * progress + 2) ** 3) / 2
  );
  const seededValue = (seed) => {
    const value = Math.sin(seed * 91.3458) * 47453.5453;
    return value - Math.floor(value);
  };

  const resizeCanvas = () => {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.75);
    const targetWidth = Math.round(viewportWidth * pixelRatio);
    const targetHeight = Math.round(viewportHeight * pixelRatio);

    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  };

  const buildPortalPath = (radius, elapsedSeconds, scale, phaseShift, wobbleStrength = 1) => {
    const path = new Path2D();
    const pointCount = radius < 80 ? 72 : 132;
    const tilt = Math.sin(elapsedSeconds * 0.7 + phaseShift) * 0.035;

    for (let pointIndex = 0; pointIndex <= pointCount; pointIndex += 1) {
      const angle = (pointIndex / pointCount) * fullCircle;
      const edgeWave = (
        Math.sin(angle * 3 + elapsedSeconds * 1.8 + phaseShift) * 0.028
        + Math.sin(angle * 7 - elapsedSeconds * 2.6 + phaseShift * 1.7) * 0.019
        + Math.sin(angle * 13 + elapsedSeconds * 4.1 - phaseShift) * 0.009
      ) * wobbleStrength;
      const pulse = Math.sin(elapsedSeconds * 3.2 + phaseShift) * 0.012;
      const horizontalRadius = radius * 0.76 * scale * (1 + edgeWave + pulse);
      const verticalRadius = radius * scale * (1 + edgeWave * 0.82 - pulse * 0.4);
      const rawHorizontal = Math.cos(angle) * horizontalRadius;
      const rawVertical = Math.sin(angle) * verticalRadius;
      const horizontal = rawHorizontal * Math.cos(tilt) - rawVertical * Math.sin(tilt);
      const vertical = rawHorizontal * Math.sin(tilt) + rawVertical * Math.cos(tilt);

      if (pointIndex === 0) path.moveTo(horizontal, vertical);
      else path.lineTo(horizontal, vertical);
    }

    path.closePath();
    return path;
  };

  const drawEnergyFragments = (radius, elapsedSeconds, opacity) => {
    context.save();
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = 'rgba(112, 255, 62, 0.9)';
    context.shadowBlur = clamp(radius * 0.045, 5, 28);

    for (let fragmentIndex = 0; fragmentIndex < 34; fragmentIndex += 1) {
      const seed = seededValue(fragmentIndex + 17);
      const angle = seed * fullCircle + elapsedSeconds * (0.08 + seededValue(fragmentIndex + 41) * 0.14);
      const orbit = radius * (1.015 + seededValue(fragmentIndex + 73) * 0.18);
      const flutter = Math.sin(elapsedSeconds * (2.2 + seed * 2.8) + fragmentIndex) * radius * 0.025;
      const horizontal = Math.cos(angle) * (orbit + flutter) * 0.76;
      const vertical = Math.sin(angle) * (orbit + flutter);
      const fragmentRadius = clamp(radius * (0.006 + seed * 0.007), 1.2, 8);
      const fragmentOpacity = opacity * (0.32 + seededValue(fragmentIndex + 9) * 0.58);

      context.fillStyle = `rgba(136, 255, 61, ${fragmentOpacity})`;
      context.beginPath();
      context.arc(horizontal, vertical, fragmentRadius, 0, fullCircle);
      context.fill();
    }

    context.lineCap = 'round';
    for (let flareIndex = 0; flareIndex < 15; flareIndex += 1) {
      const angle = (flareIndex / 15) * fullCircle + Math.sin(elapsedSeconds * 1.3 + flareIndex) * 0.08;
      const flareLength = radius * (0.07 + seededValue(flareIndex + 101) * 0.12);
      const startHorizontal = Math.cos(angle) * radius * 0.77;
      const startVertical = Math.sin(angle) * radius * 1.01;
      const endHorizontal = Math.cos(angle) * (radius + flareLength) * 0.77;
      const endVertical = Math.sin(angle) * (radius + flareLength);

      context.strokeStyle = `rgba(112, 255, 55, ${opacity * 0.34})`;
      context.lineWidth = clamp(radius * 0.014, 1.5, 9);
      context.beginPath();
      context.moveTo(startHorizontal, startVertical);
      context.quadraticCurveTo(
        (startHorizontal + endHorizontal) * 0.52 + Math.sin(angle) * flareLength * 0.12,
        (startVertical + endVertical) * 0.52 - Math.cos(angle) * flareLength * 0.12,
        endHorizontal,
        endVertical,
      );
      context.stroke();
    }

    context.restore();
  };

  const drawPortalInterior = (radius, elapsedSeconds, interiorPath, opacity) => {
    context.save();
    context.clip(interiorPath);

    const interiorGradient = context.createRadialGradient(
      -radius * 0.18,
      -radius * 0.2,
      radius * 0.05,
      0,
      0,
      radius * 0.86,
    );
    interiorGradient.addColorStop(0, '#75ff45');
    interiorGradient.addColorStop(0.34, '#31de43');
    interiorGradient.addColorStop(0.72, '#0b8b38');
    interiorGradient.addColorStop(1, '#034c29');
    context.fillStyle = interiorGradient;
    context.fillRect(-radius, -radius * 1.1, radius * 2, radius * 2.2);

    context.globalCompositeOperation = 'multiply';
    for (let eddyIndex = 0; eddyIndex < 8; eddyIndex += 1) {
      const seed = seededValue(eddyIndex + 211);
      const driftAngle = seed * fullCircle + elapsedSeconds * (0.16 + seed * 0.15);
      const driftRadius = radius * (0.16 + seededValue(eddyIndex + 239) * 0.36);
      const eddyHorizontal = Math.cos(driftAngle) * driftRadius * 0.72;
      const eddyVertical = Math.sin(driftAngle) * driftRadius;

      context.save();
      context.translate(eddyHorizontal, eddyVertical);
      context.fillStyle = `rgba(0, 66, 31, ${opacity * (0.18 + seed * 0.19)})`;
      context.fill(buildPortalPath(radius, elapsedSeconds, 0.075 + seed * 0.09, eddyIndex * 0.8, 2.3));
      context.restore();
    }

    context.globalCompositeOperation = 'screen';
    context.lineCap = 'round';
    for (let currentIndex = 0; currentIndex < 8; currentIndex += 1) {
      const currentScale = 0.16 + currentIndex * 0.078;
      const currentPath = buildPortalPath(
        radius,
        elapsedSeconds * (0.86 + currentIndex * 0.035),
        currentScale,
        currentIndex * 0.73,
        1.65,
      );
      context.strokeStyle = currentIndex % 2 === 0
        ? `rgba(185, 255, 61, ${opacity * 0.2})`
        : `rgba(41, 255, 105, ${opacity * 0.16})`;
      context.lineWidth = clamp(radius * (0.018 + currentIndex * 0.0015), 1.2, 14);
      context.shadowColor = 'rgba(121, 255, 53, 0.5)';
      context.shadowBlur = clamp(radius * 0.025, 2, 18);
      context.stroke(currentPath);
    }

    context.globalCompositeOperation = 'source-over';
    context.shadowBlur = 0;
    for (let bubbleIndex = 0; bubbleIndex < 18; bubbleIndex += 1) {
      const horizontalSeed = seededValue(bubbleIndex + 307);
      const verticalSeed = seededValue(bubbleIndex + 337);
      const drift = Math.sin(elapsedSeconds * (0.7 + horizontalSeed) + bubbleIndex) * radius * 0.035;
      const horizontal = (horizontalSeed - 0.5) * radius * 1.05 + drift;
      const vertical = (verticalSeed - 0.5) * radius * 1.5 - drift * 0.7;
      const bubbleRadius = clamp(radius * (0.007 + seededValue(bubbleIndex + 367) * 0.015), 1, 11);

      context.fillStyle = bubbleIndex % 3 === 0
        ? `rgba(205, 255, 77, ${opacity * 0.34})`
        : `rgba(0, 82, 38, ${opacity * 0.26})`;
      context.beginPath();
      context.arc(horizontal, vertical, bubbleRadius, 0, fullCircle);
      context.fill();
    }

    context.restore();
  };

  const drawFluidMark = (width, height, phaseShift) => {
    const upperLeft = 0.56 + Math.sin(phaseShift) * 0.12;
    const upperRight = 0.84 + Math.cos(phaseShift * 1.3) * 0.12;
    const lowerRight = 0.62 + Math.sin(phaseShift * 0.8) * 0.14;
    const lowerLeft = 0.78 + Math.cos(phaseShift * 1.6) * 0.1;

    context.beginPath();
    context.moveTo(-width * 0.5, 0);
    context.bezierCurveTo(
      -width * 0.42,
      -height * upperLeft,
      width * 0.18,
      -height * upperRight,
      width * 0.5,
      0,
    );
    context.bezierCurveTo(
      width * 0.3,
      height * lowerRight,
      -width * 0.28,
      height * lowerLeft,
      -width * 0.5,
      0,
    );
    context.closePath();
    context.fill();
  };

  const drawRimCurrents = (radius, elapsedSeconds, opacity) => {
    context.save();
    context.globalCompositeOperation = 'multiply';

    for (let poolIndex = 0; poolIndex < 23; poolIndex += 1) {
      const seed = seededValue(poolIndex + 419);
      const angle = (poolIndex / 23) * fullCircle + Math.sin(elapsedSeconds * 1.2 + poolIndex) * 0.035;
      const currentRadius = radius * (0.85 + Math.sin(elapsedSeconds * 1.6 + poolIndex * 1.7) * 0.018);
      const horizontal = Math.cos(angle) * currentRadius * 0.76;
      const vertical = Math.sin(angle) * currentRadius;
      const width = clamp(radius * (0.055 + seed * 0.052), 8, 72);
      const height = clamp(radius * (0.024 + seededValue(poolIndex + 443) * 0.025), 4, 34);

      context.save();
      context.translate(horizontal, vertical);
      context.rotate(angle + Math.PI / 2 + Math.sin(elapsedSeconds + poolIndex) * 0.13);
      context.fillStyle = `rgba(2, 106, 40, ${opacity * (0.48 + seed * 0.25)})`;
      drawFluidMark(width, height, elapsedSeconds * 1.7 + poolIndex);
      context.restore();
    }

    context.globalCompositeOperation = 'screen';
    context.shadowColor = 'rgba(174, 255, 56, 0.72)';
    context.shadowBlur = clamp(radius * 0.025, 3, 20);

    for (let highlightIndex = 0; highlightIndex < 17; highlightIndex += 1) {
      const seed = seededValue(highlightIndex + 487);
      const angle = (highlightIndex / 17) * fullCircle - elapsedSeconds * 0.08 + seed * 0.12;
      const currentRadius = radius * (0.945 + Math.sin(elapsedSeconds * 1.9 + highlightIndex) * 0.012);
      const horizontal = Math.cos(angle) * currentRadius * 0.76;
      const vertical = Math.sin(angle) * currentRadius;
      const width = clamp(radius * (0.025 + seed * 0.035), 5, 42);
      const height = clamp(radius * (0.011 + seededValue(highlightIndex + 509) * 0.014), 2.5, 17);

      context.save();
      context.translate(horizontal, vertical);
      context.rotate(angle + Math.PI / 2 + Math.cos(elapsedSeconds * 1.3 + highlightIndex) * 0.1);
      context.fillStyle = `rgba(195, 255, 55, ${opacity * (0.42 + seed * 0.38)})`;
      drawFluidMark(width, height, elapsedSeconds * 2.1 + highlightIndex * 0.7);
      context.restore();
    }

    context.restore();
  };

  const drawPortal = (centerHorizontal, centerVertical, radius, elapsedSeconds, opacity) => {
    if (radius < 1 || opacity <= 0) return;

    context.save();
    context.translate(centerHorizontal, centerVertical);
    drawEnergyFragments(radius, elapsedSeconds, opacity);

    const outerPath = buildPortalPath(radius, elapsedSeconds, 1, 0.2, 1.25);
    const innerPath = buildPortalPath(radius, elapsedSeconds, 0.73, 1.8, 1.85);

    context.save();
    context.globalCompositeOperation = 'lighter';
    context.shadowColor = 'rgba(83, 255, 54, 0.95)';
    context.shadowBlur = clamp(radius * 0.18, 14, 120);
    context.fillStyle = `rgba(44, 255, 57, ${opacity * 0.52})`;
    context.fill(outerPath);
    context.restore();

    context.fillStyle = `rgba(53, 237, 52, ${opacity})`;
    context.fill(outerPath);
    drawRimCurrents(radius, elapsedSeconds, opacity);

    drawPortalInterior(radius, elapsedSeconds, innerPath, opacity);

    context.save();
    context.globalCompositeOperation = 'lighter';
    context.strokeStyle = `rgba(184, 255, 63, ${opacity * 0.9})`;
    context.lineWidth = clamp(radius * 0.018, 2, 16);
    context.shadowColor = 'rgba(113, 255, 54, 0.9)';
    context.shadowBlur = clamp(radius * 0.055, 5, 35);
    context.stroke(outerPath);
    context.strokeStyle = `rgba(83, 255, 67, ${opacity * 0.82})`;
    context.lineWidth = clamp(radius * 0.025, 2, 20);
    context.stroke(innerPath);
    context.restore();

    context.restore();
  };

  const renderFrame = (timestamp) => {
    if (!animationStartTime) animationStartTime = timestamp;
    resizeCanvas();

    const elapsedMilliseconds = timestamp - animationStartTime;
    const duration = animationMode === 'opening' ? portalOpeningDuration : portalArrivalDuration;
    const progress = clamp(elapsedMilliseconds / duration, 0, 1);
    const elapsedSeconds = timestamp / 1000;
    const screenCenterHorizontal = viewportWidth / 2;
    const screenCenterVertical = viewportHeight / 2;
    const showcaseRadius = clamp(Math.min(viewportWidth, viewportHeight) * 0.23, 155, 245);
    const maximumHorizontalDistance = Math.max(screenCenterHorizontal, viewportWidth - screenCenterHorizontal) / 0.7;
    const maximumVerticalDistance = Math.max(screenCenterVertical, viewportHeight - screenCenterVertical);
    const coverRadius = Math.hypot(maximumHorizontalDistance, maximumVerticalDistance) * 1.25;
    let centerHorizontal = screenCenterHorizontal;
    let centerVertical = screenCenterVertical;
    let radius;
    let opacity = 1;

    if (animationMode === 'opening') {
      if (elapsedMilliseconds < portalRevealDuration) {
        const revealProgress = clamp(elapsedMilliseconds / portalRevealDuration, 0, 1);
        const centerProgress = easeOutCubic(revealProgress);
        centerHorizontal = interpolate(originHorizontal, screenCenterHorizontal, centerProgress);
        centerVertical = interpolate(originVertical, screenCenterVertical, centerProgress);
        radius = interpolate(5, showcaseRadius, easeOutCubic(revealProgress));
        opacity = clamp(revealProgress / 0.2, 0, 1);
      } else if (elapsedMilliseconds < portalRevealDuration + portalHoldDuration) {
        radius = showcaseRadius * (1 + Math.sin(elapsedSeconds * 3.6) * 0.012);
      } else {
        const expansionProgress = clamp(
          (elapsedMilliseconds - portalRevealDuration - portalHoldDuration) / portalExpansionDuration,
          0,
          1,
        );
        radius = interpolate(showcaseRadius, coverRadius, easeInCubic(expansionProgress));
      }
    } else if (progress < 0.44) {
      radius = interpolate(coverRadius, showcaseRadius, easeOutCubic(progress / 0.44));
    } else {
      radius = interpolate(showcaseRadius, 3, easeInOutCubic((progress - 0.44) / 0.56));
      opacity = clamp((1 - progress) / 0.07, 0, 1);
    }

    context.clearRect(0, 0, viewportWidth, viewportHeight);
    drawPortal(centerHorizontal, centerVertical, radius, elapsedSeconds, opacity);

    if (progress < 1) {
      animationFrameId = window.requestAnimationFrame(renderFrame);
    } else if (animationMode === 'closing') {
      context.clearRect(0, 0, viewportWidth, viewportHeight);
      animationFrameId = undefined;
    }
  };

  const stop = () => {
    if (animationFrameId) window.cancelAnimationFrame(animationFrameId);
    animationFrameId = undefined;
    animationStartTime = undefined;
    context.clearRect(0, 0, viewportWidth, viewportHeight);
  };

  const start = (mode, horizontal, vertical) => {
    stop();
    resizeCanvas();
    animationMode = mode;
    originHorizontal = horizontal;
    originVertical = vertical;
    animationFrameId = window.requestAnimationFrame(renderFrame);
  };

  return { start, stop };
};

const portalRenderer = portalCanvas ? createPortalRenderer(portalCanvas) : null;

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
    portalRenderer?.stop();
    document.documentElement.classList.remove('portal-arrival');
    portalTransition.classList.remove('is-departing');
    document.body.classList.remove('portal-traveling');
    portalNavigating = false;

    try {
      window.sessionStorage.removeItem('page-portal');
    } catch {}
  };

  if (document.documentElement.classList.contains('portal-arrival')) {
    if (reducedMotionQuery.matches) {
      clearPortalArrival();
    } else {
      portalRenderer?.start('closing', window.innerWidth / 2, window.innerHeight / 2);
      window.setTimeout(clearPortalArrival, portalArrivalDuration + 40);
    }
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
        portalTransition.classList.add('is-departing');
        document.body.classList.add('portal-traveling');
        portalRenderer?.start(
          'opening',
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );

        try {
          window.sessionStorage.setItem('page-portal', '1');
        } catch {}

        window.setTimeout(() => window.location.assign(link.href), portalOpeningDuration + 30);
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
