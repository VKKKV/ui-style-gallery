(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const progress = document.getElementById('scroll-progress');
  const progressValue = document.getElementById('progress-value');
  const motionState = document.getElementById('motion-state');
  const revealItems = [...document.querySelectorAll('[data-scroll-reveal]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supportsScrollTimeline = CSS.supports('animation-timeline: scroll()');
  const supportsViewTimeline = CSS.supports('animation-timeline: view()');
  let ticking = false;

  function setProgress(value) {
    const bounded = Math.max(0, Math.min(1, value));
    const percent = Math.round(bounded * 100);
    progressValue.textContent = `${percent}%`;
    progress.setAttribute('aria-valuenow', String(percent));
    progress.setAttribute('aria-valuetext', `${percent} percent`);
    root.style.setProperty('--scroll-progress', String(bounded));
    root.style.setProperty('--satellite-angle', `${bounded * 540}deg`);
    const rail = document.querySelector('.motion-rail');
    if (rail) root.style.setProperty('--satellite-y', `${bounded * rail.getBoundingClientRect().height}px`);
  }

  function updateRailDistance() {
    const rail = document.querySelector('.motion-rail');
    if (!rail) return;
    const height = Math.max(1, rail.getBoundingClientRect().height);
    root.style.setProperty('--rail-distance', `${height}px`);
    if (body.dataset.motionMode === 'fallback') updateFallbackProgress();
  }

  function updateFallbackProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
    ticking = false;
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateFallbackProgress);
  }

  // Native timelines own the visual motion; JS still updates the accessible text value.
  // If either timeline is missing, switch to explicit fallback rules for all enhanced parts.
  const needsFallback = !supportsScrollTimeline || !supportsViewTimeline;
  if (needsFallback) {
    body.dataset.motionMode = 'fallback';
    motionState.textContent = 'JS fallback active';
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateRailDistance, { passive: true });
    updateFallbackProgress();

    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const observer = new IntersectionObserver((entries, currentObserver) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            currentObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }
  } else {
    motionState.textContent = 'CSS timelines active';
    // Reading progress is semantic state, not a second animation implementation.
    const updateAccessibleProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? window.scrollY / scrollable : 0);
    };
    window.addEventListener('scroll', updateAccessibleProgress, { passive: true });
    window.addEventListener('resize', updateAccessibleProgress, { passive: true });
    updateAccessibleProgress();
  }

  updateRailDistance();
  reduceMotion.addEventListener?.('change', () => {
    if (reduceMotion.matches) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      setProgress(0);
    }
  });
})();
