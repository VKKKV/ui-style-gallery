/** Character scramble animation with a stable accessible text alternative. */
class ShuffleText {
  constructor(el, opts = {}) {
    this.el = typeof el === 'string' ? document.querySelector(el) : el;
    if (!this.el) throw new TypeError('ShuffleText requires an element');
    this.originalText = this.el.textContent;
    this.sourceChars = Array.from(opts.sourceChars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*');
    this.delay = opts.delay ?? 0;
    this.frameInterval = opts.frameInterval ?? 35;
    this._animating = false;
    this._destroyed = false;
    this._motion = matchMedia('(prefers-reduced-motion: reduce)');
    this._visual = document.createElement('span');
    this._visual.setAttribute('aria-hidden', 'true');
    this._accessible = document.createElement('span');
    this._accessible.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0';
    this.el.replaceChildren(this._visual, this._accessible);
    this._restore();
    this._onMotion = () => { if (this._motion.matches) this.stop(); };
    this._onHide = () => { if (document.hidden) this.stop(); };
    this._motion.addEventListener('change', this._onMotion);
    document.addEventListener('visibilitychange', this._onHide);
  }

  _restore() {
    this._visual.textContent = this.originalText;
    this._accessible.textContent = this.originalText;
  }

  stop() {
    clearTimeout(this._timer);
    this._timer = null;
    this._animating = false;
    this._restore();
  }

  start() {
    if (this._destroyed) return;
    this.stop(); // Cancel stale frames before replay or input changes.
    if (this._motion.matches || document.hidden || !this.originalText) return;
    this._animating = true;
    const chars = Array.from(this.originalText);
    let index = 0;
    let randomFrame = 0;
    let accumulated = '';
    const tick = () => {
      if (!this.el.isConnected) { this.stop(); return; }
      const maxRand = index < 3 ? 3 : index < 6 ? 2 : 1;
      if (randomFrame++ < maxRand) {
        this._visual.textContent = accumulated + this.sourceChars[Math.floor(Math.random() * this.sourceChars.length)];
      } else {
        accumulated += chars[index++];
        this._visual.textContent = accumulated;
        randomFrame = 0;
      }
      if (index === chars.length) { this.stop(); return; }
      this._timer = setTimeout(tick, Math.max(0, this.frameInterval));
    };
    this._timer = setTimeout(tick, Math.max(0, this.delay) + Math.max(0, this.frameInterval));
  }

  destroy() {
    this.stop();
    this._destroyed = true;
    this._motion.removeEventListener('change', this._onMotion);
    document.removeEventListener('visibilitychange', this._onHide);
    this.el.removeEventListener('mouseenter', this._onTrigger);
    this.el.removeEventListener('focus', this._onTrigger);
    this.el.removeEventListener('click', this._onTrigger);
    this.el.textContent = this.originalText;
    if (this.el._shuffleText === this) delete this.el._shuffleText;
  }
}

function initShuffleText() {
  document.querySelectorAll('[data-shuffle], [data-shuffle-auto], [data-shuffle-hover]').forEach(el => {
    if (el._shuffleText) return;
    const st = new ShuffleText(el, {
      frameInterval: Number(el.dataset.shuffleSpeed) || 35,
      delay: Number(el.dataset.shuffleDelay) || 0,
      sourceChars: el.dataset.shuffleChars || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    });
    el._shuffleText = st;
    if (el.hasAttribute('data-shuffle-auto')) st.start();
    if (el.hasAttribute('data-shuffle-hover')) {
      st._onTrigger = () => st.start();
      el.addEventListener('mouseenter', st._onTrigger);
      el.addEventListener('focus', st._onTrigger);
      el.addEventListener('click', st._onTrigger);
    }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initShuffleText, { once: true });
else initShuffleText();
