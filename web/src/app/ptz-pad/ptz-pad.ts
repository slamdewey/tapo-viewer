import { Component, inject, input, signal } from '@angular/core';
import { Direction, PtzService } from '../services/ptz.service';

@Component({
  selector: 'app-ptz-pad',
  templateUrl: './ptz-pad.html',
  styleUrl: './ptz-pad.scss',
})
export class PtzPad {
  private ptz = inject(PtzService);

  cameraId = input.required<string>();

  error = signal<string | null>(null);

  private activeDir: Direction | null = null;

  onPointerDown(ev: PointerEvent, dir: Direction) {
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    this.activeDir = dir;
    void this.sendMove(dir);
  }

  onPointerUp() {
    if (this.activeDir === null) return;
    this.activeDir = null;
    void this.sendMove('stop');
  }

  pressStop() {
    this.activeDir = null;
    void this.sendMove('stop');
  }

  private async sendMove(dir: Direction) {
    try {
      await this.ptz.move(this.cameraId(), dir);
    } catch (e: any) {
      this.error.set(e?.message ?? 'PTZ move failed');
    }
  }
}
