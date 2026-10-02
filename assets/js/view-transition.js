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
  let activeTransition = null;

  apiStatus.textContent = supportsViewTransition ? 'Native API ready' : 'CSS fallback active';
  apiStatus.classList.toggle('is-fallback', !supportsViewTransition);

  function setArt(element, project) {
    element.className = `detail-art ${project.art}`;
    element.style.setProperty('--detail-accent', project.accent);
    element.style.viewTransitionName = 'detail-art';
  }

  function render(project, index) {
    selected = index;
    cards.forEach((card, cardIndex) => {
      card.setAttribute('aria-current', String(cardIndex === index));
      card.setAttribute('aria-expanded', String(cardIndex === index));
    });
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

  function clearNames() {
    cards.forEach(card => card.querySelector('.card-art')?.style.removeProperty('view-transition-name'));
  }

  function runUpdate(update, done, prepare) {
    const token = ++transitionToken;
    activeTransition?.skipTransition();
    activeTransition = null;
    clearNames();
    const apply = () => {
      if (token !== transitionToken) return;
      update();
    };
    const finish = () => {
      if (token !== transitionToken) return;
      clearNames();
      activeTransition = null;
      done?.();
    };
    if (supportsViewTransition && !reduceMotion.matches && !document.hidden) {
      prepare?.();
      try {
        const transition = document.startViewTransition(apply);
        activeTransition = transition;
        transition.ready.catch(() => {});
        transition.finished.then(finish, finish);
        return;
      } catch {
        clearNames();
      }
    }
    apply();
    finish();
  }

  function openDetail(index, trigger = cards[index]) {
    const project = projects[index];
    if (!project) return;
    lastTrigger = trigger;
    selected = index;
    const cardArt = trigger?.querySelector('.card-art');
    runUpdate(() => {
      render(project, index);
      panel.hidden = false;
      clearNames();
      panel.classList.remove('is-fallback-entry', 'is-replaying');
      if (!supportsViewTransition && !reduceMotion.matches) {
        void panel.offsetWidth;
        panel.classList.add('is-fallback-entry');
      }
    }, () => {
      if (!document.hidden) detailTitle.focus();
    }, () => {
      if (cardArt && panel.hidden) cardArt.style.viewTransitionName = 'detail-art';
    });
  }

  function closeDetail() {
    if (selected < 0 && panel.hidden) return;
    const trigger = lastTrigger || cards[selected];
    selected = -1;
    runUpdate(() => {
      const cardArt = trigger?.querySelector('.card-art');
      if (cardArt) cardArt.style.viewTransitionName = 'detail-art';
      panel.hidden = true;
      cards.forEach(card => {
        card.setAttribute('aria-current', 'false');
        card.setAttribute('aria-expanded', 'false');
      });
    }, () => {
      if (!document.hidden) trigger?.focus();
    });
  }

  function replay() {
    if (panel.hidden || selected < 0) return;
    const index = selected;
    runUpdate(() => {
      render(projects[index], index);
      panel.classList.remove('is-fallback-entry', 'is-replaying');
      if (!supportsViewTransition && !reduceMotion.matches) {
        void panel.offsetWidth;
        panel.classList.add('is-replaying');
      }
    });
  }

  cards.forEach((card, index) => {
    card.setAttribute('aria-controls', 'detailPanel');
    card.setAttribute('aria-expanded', 'false');
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
    if (event.key === 'Escape' && (selected >= 0 || !panel.hidden)) {
      event.preventDefault();
      closeDetail();
    }
  });
  function updateMotion() {
    apiStatus.textContent = reduceMotion.matches ? 'Reduced motion on' : (supportsViewTransition ? 'Native API ready' : 'CSS fallback active');
    if (reduceMotion.matches) activeTransition?.skipTransition();
  }
  reduceMotion.addEventListener?.('change', updateMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) activeTransition?.skipTransition();
  });
  window.addEventListener('pagehide', () => activeTransition?.skipTransition());
  window.addEventListener('pageshow', updateMotion);
  updateMotion();
})();
