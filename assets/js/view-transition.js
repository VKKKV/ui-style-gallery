(() => {
  'use strict';

  const projects = [
    { name: 'Tidal signal', title: 'Gradient as horizon', description: 'A study in soft layers, where a small shift in position can carry the same visual object into a new context.', meta: ['shared element', 'circular reveal', 'no dependency'], art: 'art-one', mark: '01', accent: 'oklch(79% .16 175)' },
    { name: 'Orbit index', title: 'Signal in motion', description: 'A radial composition that keeps its center while the surrounding field opens into a more focused reading surface.', meta: ['radial focus', 'shared image', 'native css'], art: 'art-two', mark: '02', accent: 'oklch(76% .13 246)' },
    { name: 'Amber field', title: 'Warmth, indexed', description: 'Warm color and a compact detail view demonstrate how a familiar card can become a calm editorial moment.', meta: ['color study', 'reversible', 'keyboard ready'], art: 'art-three', mark: '03', accent: 'oklch(80% .12 62)' },
    { name: 'Chromatic fold', title: 'Edges in tension', description: 'Hard edges fold toward the panel while the content changes in place, preserving context instead of cutting away.', meta: ['geometry', 'clip-path', 'replayable'], art: 'art-four', mark: '04', accent: 'oklch(78% .13 335)' },
    { name: 'Green room', title: 'Quiet repetition', description: 'An organic interval shows that a shared element can feel measured and quiet, not only fast or spectacular.', meta: ['organic', 'reduced motion', 'responsive'], art: 'art-five', mark: '05', accent: 'oklch(81% .15 140)' },
    { name: 'Crossfade', title: 'Meet at the center', description: 'Two axes meet in a compact reveal that is legible at every viewport and still useful when motion is disabled.', meta: ['alignment', 'fallback', 'zero build'], art: 'art-six', mark: '06', accent: 'oklch(78% .15 350)' },
  ];

  const cards = [...document.querySelectorAll('.project-card')];
  const panel = document.getElementById('detailPanel');
  const detailArt = document.getElementById('detailArt');
  const detailMark = document.getElementById('detailMark');
  const detailKicker = document.getElementById('detailKicker');
  const detailTitle = document.getElementById('detailTitle');
  const detailDescription = document.getElementById('detailDescription');
  const detailMeta = document.getElementById('detailMeta');
  const closeButton = document.getElementById('closeButton');
  const replayButton = document.getElementById('replayButton');
  const apiStatus = document.getElementById('apiStatus');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!cards.length || !panel) return;

  const supportsViewTransition = typeof document.startViewTransition === 'function';
  let selected = -1;
  let lastTrigger = null;
  let transitionToken = 0;

  apiStatus.textContent = supportsViewTransition ? 'Native API ready' : 'CSS fallback active';
  apiStatus.classList.toggle('is-fallback', !supportsViewTransition);

  function setArt(element, project) {
    element.className = `detail-art ${project.art}`;
    element.style.setProperty('--detail-accent', project.accent);
    element.style.viewTransitionName = 'detail-art';
  }

  function render(project, index) {
    selected = index;
    cards.forEach((card, cardIndex) => card.setAttribute('aria-current', String(cardIndex === index)));
    panel.style.setProperty('--detail-accent', project.accent);
    setArt(detailArt, project);
    detailMark.textContent = project.mark;
    detailKicker.textContent = `${project.mark} / ${project.name}`;
    detailTitle.textContent = project.title;
    detailDescription.textContent = project.description;
    detailMeta.replaceChildren(...project.meta.map(item => {
      const span = document.createElement('span');
      span.textContent = item;
      return span;
    }));
  }

  function focusPanel() {
    closeButton.focus({ preventScroll: true });
  }

  function runUpdate(update, done) {
    if (supportsViewTransition && !reduceMotion.matches) {
      const transition = document.startViewTransition(update);
      transition.finished.then(() => done?.()).catch(() => done?.());
      return transition.finished;
    }
    update();
    return Promise.resolve().then(() => done?.());
  }

  function openDetail(index, trigger = cards[index]) {
    const project = projects[index];
    if (!project) return;
    lastTrigger = trigger;
    const token = ++transitionToken;
    cards.forEach(card => card.querySelector('.card-art')?.style.removeProperty('view-transition-name'));
    const cardArt = trigger?.querySelector('.card-art');
    if (cardArt && panel.hidden) cardArt.style.viewTransitionName = 'detail-art';
    runUpdate(() => {
      render(project, index);
      panel.hidden = false;
      cardArt?.style.removeProperty('view-transition-name');
      panel.classList.remove('is-fallback-entry');
      if (!supportsViewTransition || reduceMotion.matches) void panel.offsetWidth;
      panel.classList.add('is-fallback-entry');
    }, () => {
      if (token === transitionToken) focusPanel();
    });
  }

  function closeDetail() {
    if (selected < 0) return;
    const trigger = lastTrigger || cards[selected];
    const token = ++transitionToken;
    runUpdate(() => {
      const cardArt = trigger?.querySelector('.card-art');
      if (cardArt) cardArt.style.viewTransitionName = 'detail-art';
      panel.hidden = true;
      cards.forEach(card => card.setAttribute('aria-current', 'false'));
    }, () => {
      trigger?.querySelector('.card-art')?.style.removeProperty('view-transition-name');
      if (trigger && token === transitionToken) trigger.focus({ preventScroll: true });
      selected = -1;
    });
  }

  function replay() {
    if (panel.hidden) return;
    panel.classList.remove('is-replaying');
    void panel.offsetWidth;
    panel.classList.add('is-replaying');
    if (supportsViewTransition && !reduceMotion.matches) {
      const active = projects[selected];
      document.startViewTransition(() => {
        render(active, selected);
      }).finished.catch(() => {});
    }
  }

  cards.forEach((card, index) => {
    card.addEventListener('click', () => openDetail(index, card));
    card.addEventListener('keydown', event => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowDown' && event.key !== 'ArrowLeft' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
      cards[(index + direction + cards.length) % cards.length].focus();
    });
  });

  closeButton.addEventListener('click', closeDetail);
  replayButton.addEventListener('click', replay);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) {
      event.preventDefault();
      closeDetail();
    }
  });
  reduceMotion.addEventListener?.('change', () => {
    apiStatus.textContent = reduceMotion.matches ? 'Reduced motion on' : (supportsViewTransition ? 'Native API ready' : 'CSS fallback active');
  });
})();
