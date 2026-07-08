/**
 * ShuffleText — character scramble animation
 * Pure JS, no dependencies
 */
class ShuffleText {
  constructor(el, opts = {}) {
    this.el = typeof el === 'string' ? document.querySelector(el) : el;
    this.originalText = this.el.textContent;
    this.sourceChars = opts.sourceChars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    this.duration = opts.duration || 600;      // ms per character
    this.delay = opts.delay || 0;
    this.emptyChar = opts.emptyChar || ' ';
    this.frameInterval = opts.frameInterval || 35;
    this._animating = false;
  }

  start() {
    if (this._animating) return;
    this._animating = true;
    const chars = this.originalText.split('');
    const timeline = []; // array of string states

    let accumulated = '';
    for (let i = 0; i < chars.length; i++) {
      const target = chars[i];
      // number of random frames before settling
      const maxRand = i < 3 ? 3 : i < 6 ? 2 : 1;
      let count = 0;
      while (count < maxRand) {
        const randChar = this.sourceChars[Math.floor(Math.random() * this.sourceChars.length)];
        timeline.push(accumulated + randChar);
        count++;
      }
      accumulated += target;
      timeline.push(accumulated);
    }

    let frame = 0;
    setTimeout(() => {
      const interval = setInterval(() => {
        if (frame >= timeline.length) {
          this.el.textContent = this.originalText;
          this._animating = false;
          clearInterval(interval);
          return;
        }
        this.el.textContent = timeline[frame];
        frame++;
      }, this.frameInterval);
    }, this.delay);
  }
}

// Auto-init elements with [data-shuffle]
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-shuffle]').forEach(el => {
    const st = new ShuffleText(el, {
      frameInterval: parseInt(el.dataset.shuffleSpeed) || 35,
      sourceChars: el.dataset.shuffleChars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    el._shuffleText = st;

    // If data-shuffle-auto, run on load
    if (el.dataset.shuffleAuto !== undefined) {
      setTimeout(() => st.start(), parseInt(el.dataset.shuffleDelay) || 0);
    }

    // If data-shuffle-hover, run on hover
    if (el.dataset.shuffleHover !== undefined) {
      el.addEventListener('mouseenter', () => st.start());
    }
  });
});
