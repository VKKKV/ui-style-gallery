(() => {
  'use strict';

  const root = document.documentElement;
  const body = document.body;
  const progress = document.getElementById('scroll-progress');
  const progressValue = document.getElementById('progress-value');
  const motionState = document.getElementById('motion-state');
  const rail = document.querySelector('.motion-rail');
  const revealItems = [...document.querySelectorAll('[data-scroll-reveal]')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const supports = value => !!window.CSS?.supports(value);
  const needsFallback = !supports('animation-timeline: scroll()') ||
    !supports('animation-timeline: view()') || !supports('animation-range: entry 8% cover 35%');
  let frame = 0;
  let observer;

  function updateProgress() {
    frame = 0;
    const scrollable = root.scrollHeight - window.innerHeight;
    const bounded = Math.max(0, Math.min(1, scrollable > 0 ? window.scrollY / scrollable : 0));
    const percent = Math.round(bounded * 100);
    progressValue.textContent = `${percent}%`;
    progress.setAttribute('aria-valuenow', String(percent));
    progress.setAttribute('aria-valuetext', `${percent} percent`);
    root.style.setProperty('--scroll-progress', String(bounded));
    if (needsFallback && rail) {
      root.style.setProperty('--satellite-angle', `${bounded * 540}deg`);
      root.style.setProperty('--satellite-y', `${bounded * rail.getBoundingClientRect().height}px`);
    }
  }

  function scheduleProgress() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(updateProgress);
  }

  function updateMotion() {
    motionState.textContent = reduceMotion.matches ? 'Reduced motion on' :
      (needsFallback ? 'JS fallback active' : 'CSS timelines active');
    if (reduceMotion.matches) {
      observer?.disconnect();
      revealItems.forEach(item => item.classList.add('is-visible'));
    }
    updateProgress();
  }

  body.dataset.motionMode = needsFallback ? 'fallback' : 'native';
  if (needsFallback) {
    if (typeof IntersectionObserver === 'function' && !reduceMotion.matches) {
      observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });
      revealItems.forEach(item => observer.observe(item));
    } else {
      revealItems.forEach(item => item.classList.add('is-visible'));
    }
  }
  window.addEventListener('scroll', scheduleProgress, { passive: true });
  window.addEventListener('resize', scheduleProgress, { passive: true });
  window.addEventListener('pageshow', updateMotion);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    frame = 0;
  });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!document.hidden) updateProgress();
  });
  reduceMotion.addEventListener?.('change', updateMotion);
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleProgress).observe(body);
  updateMotion();
})();
