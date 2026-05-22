import { Directive, ElementRef, HostListener, inject, signal } from '@angular/core';

@Directive({
  selector: '[appZoom]',
})
export class ZoomDirective {
  private host = inject(ElementRef<HTMLElement>);

  private readonly minScale = 1;
  private readonly maxScale = 8;
  private scale = signal(1);
  private tx = signal(0);
  private ty = signal(0);

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  // Pinch state
  private pinchStartDist = 0;
  private pinchStartScale = 1;

  constructor() {
    const el = this.host.nativeElement;
    el.style.transformOrigin = 'center center';
    el.style.touchAction = 'none';
    this.apply();
  }

  @HostListener('wheel', ['$event'])
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomAround(e.clientX, e.clientY, this.scale() * factor);
  }

  @HostListener('pointerdown', ['$event'])
  onPointerDown(e: PointerEvent) {
    if (this.scale() <= this.minScale) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  @HostListener('pointermove', ['$event'])
  onPointerMove(e: PointerEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.tx.update((v) => v + dx);
    this.ty.update((v) => v + dy);
    this.clampTranslation();
    this.apply();
  }

  @HostListener('pointerup', ['$event'])
  @HostListener('pointercancel', ['$event'])
  onPointerUp(_e: PointerEvent) {
    this.dragging = false;
  }

  @HostListener('dblclick')
  onDoubleClick() {
    this.scale.set(1);
    this.tx.set(0);
    this.ty.set(0);
    this.apply();
  }

  @HostListener('touchstart', ['$event'])
  onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      this.pinchStartDist = this.touchDistance(e);
      this.pinchStartScale = this.scale();
    }
  }

  @HostListener('touchmove', ['$event'])
  onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = this.touchDistance(e);
      if (this.pinchStartDist > 0) {
        const newScale = this.pinchStartScale * (dist / this.pinchStartDist);
        const mid = this.touchMidpoint(e);
        this.zoomAround(mid.x, mid.y, newScale);
      }
    }
  }

  private touchDistance(e: TouchEvent): number {
    const [a, b] = [e.touches[0], e.touches[1]];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  private touchMidpoint(e: TouchEvent): { x: number; y: number } {
    const [a, b] = [e.touches[0], e.touches[1]];
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
  }

  private zoomAround(clientX: number, clientY: number, newScale: number) {
    const clamped = Math.max(this.minScale, Math.min(this.maxScale, newScale));
    const rect = this.host.nativeElement.getBoundingClientRect();
    const cx = clientX - rect.left - rect.width / 2;
    const cy = clientY - rect.top - rect.height / 2;
    const ratio = clamped / this.scale();
    this.tx.update((v) => v - (cx - v) * (ratio - 1));
    this.ty.update((v) => v - (cy - v) * (ratio - 1));
    this.scale.set(clamped);
    if (clamped === this.minScale) {
      this.tx.set(0);
      this.ty.set(0);
    } else {
      this.clampTranslation();
    }
    this.apply();
  }

  private clampTranslation() {
    const el = this.host.nativeElement;
    const w = el.clientWidth;
    const h = el.clientHeight;
    const s = this.scale();
    const maxX = (w * (s - 1)) / 2;
    const maxY = (h * (s - 1)) / 2;
    this.tx.update((v) => Math.max(-maxX, Math.min(maxX, v)));
    this.ty.update((v) => Math.max(-maxY, Math.min(maxY, v)));
  }

  private apply() {
    const el = this.host.nativeElement;
    el.style.transform = `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`;
    el.style.cursor = this.scale() > this.minScale ? 'grab' : 'default';
  }
}
