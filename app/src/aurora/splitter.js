export class AuroraSplitter {
  constructor(element) {
    this.container = element;
    this.handle = this.container.querySelector('.splitter__handle');
    if (!this.handle) return;
    this.orientation = this.container.getAttribute('data-orientation') || 'horizontal';
    this.handle.setAttribute('tabindex', '0');
    this.handle.setAttribute('role', 'separator');
    this.handle.setAttribute('aria-orientation', this.orientation);
    this.isDragging = false;
    this.dragOffset = 0;
    this.currentPosPercent = 50;
    this.minPercent = 5;
    this.maxPercent = 95;
    const initialPos = this.container.getAttribute('data-initial-pos');
    if (initialPos) this.setSplitPosition(parseFloat(initialPos));
    this.bindEvents();
  }

  bindEvents() {
    this.handle.addEventListener('pointerdown', e => this.onPointerDown(e));
    this.handle.addEventListener('keydown', e => this.onKeyDown(e));
  }

  onPointerDown(e) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.isDragging = true;
    this.container.classList.add('is-dragging');
    this.handle.setPointerCapture(e.pointerId);
    const rect = this.handle.getBoundingClientRect();
    this.dragOffset = this.orientation === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
    this.onMoveHandler = e => this.onPointerMove(e);
    this.onUpHandler = e => this.onPointerUp(e);
    this.handle.addEventListener('pointermove', this.onMoveHandler);
    this.handle.addEventListener('pointerup', this.onUpHandler);
    this.handle.addEventListener('pointercancel', this.onUpHandler);
    e.preventDefault();
  }

  onPointerMove(e) {
    if (!this.isDragging) return;
    const cr = this.container.getBoundingClientRect();
    let p;
    if (this.orientation === 'horizontal') {
      p = ((e.clientX - cr.left - this.dragOffset + this.handle.offsetWidth / 2) / cr.width) * 100;
    } else {
      p = ((e.clientY - cr.top - this.dragOffset + this.handle.offsetHeight / 2) / cr.height) * 100;
    }
    this.setSplitPosition(p);
  }

  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.container.classList.remove('is-dragging');
    this.handle.releasePointerCapture(e.pointerId);
    this.handle.removeEventListener('pointermove', this.onMoveHandler);
    this.handle.removeEventListener('pointerup', this.onUpHandler);
    this.handle.removeEventListener('pointercancel', this.onUpHandler);
  }

  onKeyDown(e) {
    const step = 2;
    const h = this.orientation === 'horizontal';
    if      ((h && e.key === 'ArrowLeft')  || (!h && e.key === 'ArrowUp'))   { this.setSplitPosition(this.currentPosPercent - step); e.preventDefault(); }
    else if ((h && e.key === 'ArrowRight') || (!h && e.key === 'ArrowDown')) { this.setSplitPosition(this.currentPosPercent + step); e.preventDefault(); }
  }

  setSplitPosition(p) {
    p = Math.max(this.minPercent, Math.min(this.maxPercent, p));
    this.currentPosPercent = p;
    this.container.style.setProperty('--splitter-pos', `${p}%`);
    this.handle.setAttribute('aria-valuenow', Math.round(p));
  }
}

export function initSplitters(root = document) {
  root.querySelectorAll('[data-splitter]').forEach(el => new AuroraSplitter(el));
}
