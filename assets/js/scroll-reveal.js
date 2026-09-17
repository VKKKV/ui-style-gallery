/** One-shot scroll reveals with cancellable delays. */
class ScrollReveal {
  constructor(opts = {}) {
    this.selector = opts.selector || '[data-reveal]';
    this.threshold = opts.threshold ?? 0.15;
    this.rootMargin = opts.rootMargin ?? '0px 0px -60px 0px';
    this.activeClass = opts.activeClass || 'is-visible';
    this.elements = [...document.querySelectorAll(this.selector)];
    this._timers = new Set();
    this._motion = matchMedia('(prefers-reduced-motion: reduce)');
    this._onMotion = () => { if (this._motion.matches) this.revealAll(); };
    this._motion.addEventListener('change', this._onMotion);
    if (this._motion.matches || !('IntersectionObserver' in window)) {
      this.revealAll();
      return;
    }
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const delay = Math.max(0, Number(entry.target.dataset.revealDelay) || 0);
        const timer = setTimeout(() => {
          this._timers.delete(timer);
          entry.target.classList.add(this.activeClass);
        }, delay);
        this._timers.add(timer);
        this.observer.unobserve(entry.target);
      });
    }, { threshold: this.threshold, rootMargin: this.rootMargin });
    this.elements.forEach(el => this.observer.observe(el));
  }

  revealAll() {
    this.observer?.disconnect();
    this._timers.forEach(clearTimeout);
    this._timers.clear();
    this.elements.forEach(el => el.classList.add(this.activeClass));
  }

  destroy() {
    this.revealAll(); // Do not leave content hidden when enhancement is removed.
    this._motion.removeEventListener('change', this._onMotion);
  }
}
