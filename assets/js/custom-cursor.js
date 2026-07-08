/**
 * Custom Cursor — magnetic follower with lerp
 */
class CustomCursor {
  constructor(opts = {}) {
    this.cursor = document.querySelector(opts.cursor || '.cursor');
    this.follower = document.querySelector(opts.follower || '.cursor-follower');
    this.hoverTargets = opts.hoverTargets || '[data-cursor-hover]';
    this.expandClass = opts.expandClass || 'is-hover';
    this.speed = opts.speed || 0.15;
    this.followerSpeed = opts.followerSpeed || 0.08;
    this.pos = { x: 0, y: 0 };
    this.followerPos = { x: 0, y: 0 };
    this.mouse = { x: 0, y: 0 };
    this.visible = false;
    this._init();
  }

  _lerp(a, b, t) { return a + (b - a) * t; }

  _init() {
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      if (!this.visible) {
        this.visible = true;
        this.pos.x = e.clientX;
        this.pos.y = e.clientY;
        this.followerPos.x = e.clientX;
        this.followerPos.y = e.clientY;
        if (this.cursor) this.cursor.style.opacity = '1';
        if (this.follower) this.follower.style.opacity = '1';
      }
    });

    document.addEventListener('mouseleave', () => {
      this.visible = false;
      if (this.cursor) this.cursor.style.opacity = '0';
      if (this.follower) this.follower.style.opacity = '0';
    });

    // Hover targets
    document.querySelectorAll(this.hoverTargets).forEach(el => {
      el.addEventListener('mouseenter', () => {
        if (this.follower) this.follower.classList.add(this.expandClass);
        if (this.cursor) this.cursor.classList.add(this.expandClass);
      });
      el.addEventListener('mouseleave', () => {
        if (this.follower) this.follower.classList.remove(this.expandClass);
        if (this.cursor) this.cursor.classList.remove(this.expandClass);
      });
    });

    this._render();
  }

  _render() {
    this.pos.x = this._lerp(this.pos.x, this.mouse.x, this.speed);
    this.pos.y = this._lerp(this.pos.y, this.mouse.y, this.speed);
    this.followerPos.x = this._lerp(this.followerPos.x, this.mouse.x, this.followerSpeed);
    this.followerPos.y = this._lerp(this.followerPos.y, this.mouse.y, this.followerSpeed);

    if (this.cursor) {
      this.cursor.style.transform = `translate(${this.pos.x}px, ${this.pos.y}px)`;
    }
    if (this.follower) {
      this.follower.style.transform = `translate(${this.followerPos.x}px, ${this.followerPos.y}px)`;
    }

    requestAnimationFrame(() => this._render());
  }
}
