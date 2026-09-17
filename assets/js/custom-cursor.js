/** Custom cursor — an on-demand magnetic follower with native-cursor fallback. */
class CustomCursor {
  constructor(opts = {}) {
    this.cursor = document.querySelector(opts.cursor || '.cursor');
    this.follower = document.querySelector(opts.follower || '.cursor-follower');
    this.hoverTargets = opts.hoverTargets || '[data-cursor-hover]';
    this.expandClass = opts.expandClass || 'is-hover';
    this.speed = Math.min(1, Math.max(0.01, Number(opts.speed) || 0.15));
    this.followerSpeed = Math.min(1, Math.max(0.01, Number(opts.followerSpeed) || 0.08));
    this.pos = { x: 0, y: 0 };
    this.followerPos = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0 };
    this.visible = false;
    this._raf = null;
    this._listeners = [];
    this._motion = matchMedia('(prefers-reduced-motion: reduce)');
    this._pointer = matchMedia('(hover: hover) and (pointer: fine)');
    const listen = (target, type, fn) => {
      target.addEventListener(type, fn);
      this._listeners.push(() => target.removeEventListener(type, fn));
    };
    const sync = () => {
      this.enabled = !!(this.cursor || this.follower) && !this._motion.matches && this._pointer.matches && !document.hidden;
      if (!this.enabled) this._hide();
    };
    listen(this._motion, 'change', sync);
    listen(this._pointer, 'change', sync);
    listen(document, 'visibilitychange', sync);
    listen(window, 'blur', () => this._hide());
    listen(document, 'mouseleave', () => this._hide());
    listen(document, 'keydown', e => { if (e.key === 'Tab') this._hide(); });
    listen(document, 'pointermove', e => {
      if (!this.enabled || e.pointerType === 'touch') return;
      this.mouse = { x: e.clientX, y: e.clientY };
      if (!this.visible) {
        this.visible = true;
        this.pos = { ...this.mouse };
        this.followerPos = { ...this.mouse };
        document.documentElement.classList.add('custom-cursor-active');
        [this.cursor, this.follower].forEach(el => { if (el) el.style.opacity = '1'; });
      }
      const hover = !!e.target.closest(this.hoverTargets);
      [this.cursor, this.follower].forEach(el => el?.classList.toggle(this.expandClass, hover));
      if (this._raf === null) this._raf = requestAnimationFrame(() => this._render());
    });
    sync();
  }

  _hide() {
    this.visible = false;
    cancelAnimationFrame(this._raf);
    this._raf = null;
    document.documentElement.classList.remove('custom-cursor-active');
    [this.cursor, this.follower].forEach(el => {
      if (!el) return;
      el.style.opacity = '0';
      el.classList.remove(this.expandClass);
    });
  }

  _render() {
    this._raf = null;
    if (!this.enabled || !this.visible) return;
    let moving = false;
    [[this.cursor, this.pos, this.speed], [this.follower, this.followerPos, this.followerSpeed]].forEach(([el, pos, speed]) => {
      if (!el) return;
      for (const axis of ['x', 'y']) {
        pos[axis] += (this.mouse[axis] - pos[axis]) * speed;
        if (Math.abs(this.mouse[axis] - pos[axis]) < 0.1) pos[axis] = this.mouse[axis];
        else moving = true;
      }
      el.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
    });
    if (moving) this._raf = requestAnimationFrame(() => this._render());
  }

  destroy() {
    this.enabled = false;
    this._hide();
    this._listeners.forEach(remove => remove());
    this._listeners = [];
  }
}
