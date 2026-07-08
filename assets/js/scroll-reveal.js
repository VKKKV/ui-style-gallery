/**
 * ScrollReveal — IntersectionObserver-based scroll animations
 * Lightweight, no dependencies
 */
class ScrollReveal {
  constructor(opts = {}) {
    this.selector = opts.selector || '[data-reveal]';
    this.threshold = opts.threshold || 0.15;
    this.rootMargin = opts.rootMargin || '0px 0px -60px 0px';
    this.activeClass = opts.activeClass || 'is-visible';
    this._init();
  }

  _init() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.dataset.revealDelay) || 0;
          setTimeout(() => {
            entry.target.classList.add(this.activeClass);
          }, delay);
          observer.unobserve(entry.target); // one-shot
        }
      });
    }, {
      threshold: this.threshold,
      rootMargin: this.rootMargin,
    });

    document.querySelectorAll(this.selector).forEach(el => observer.observe(el));
  }
}
