import { Component, effect, inject, input, signal } from '@angular/core';
import { Direction, Preset, PtzService } from '../services/ptz.service';

@Component({
  selector: 'app-ptz-pad',
  templateUrl: './ptz-pad.html',
  styleUrl: './ptz-pad.scss',
})
export class PtzPad {
  private ptz = inject(PtzService);

  cameraId = input.required<string>();

  presets = signal<Preset[]>([]);
  selectedPreset = signal<string>('');
  error = signal<string | null>(null);

  private activeDir: Direction | null = null;

  constructor() {
    // Reload presets whenever the camera changes.
    effect(async () => {
      const id = this.cameraId();
      try {
        const list = await this.ptz.presets(id);
        this.presets.set(list);
      } catch (e: any) {
        this.error.set(e?.message ?? 'Failed to load presets');
      }
    });
  }

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

  async onPresetChange(token: string) {
    this.selectedPreset.set(token);
    if (!token) return;
    try {
      await this.ptz.gotoPreset(this.cameraId(), token);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Goto preset failed');
    }
  }

  private async sendMove(dir: Direction) {
    try {
      await this.ptz.move(this.cameraId(), dir);
    } catch (e: any) {
      this.error.set(e?.message ?? 'PTZ move failed');
    }
  }
}
