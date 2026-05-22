import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Stream } from '../stream/stream';
import { PtzPad } from '../ptz-pad/ptz-pad';
import { CameraService } from '../services/camera.service';
import { Camera } from '../types/camera';

@Component({
  selector: 'app-camera-viewer',
  imports: [Stream, PtzPad],
  templateUrl: './camera-viewer.html',
  styleUrl: './camera-viewer.scss',
})
export class CameraViewer implements OnInit {
  private route = inject(ActivatedRoute);
  private cameras = inject(CameraService);

  private params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  camera = signal<Camera | null>(null);
  selectedStream = signal<string>('');
  error = signal<string | null>(null);

  hasMultipleQualities = computed(() => (this.camera()?.streams.length ?? 0) > 1);
  hasPtz = computed(() => !!this.camera()?.capabilities.ptz);

  async ngOnInit() {
    try {
      const requestedId = this.params().get('id');
      const list = await this.cameras.list();
      if (!list.length) {
        this.error.set('No cameras configured');
        return;
      }
      const cam = requestedId
        ? list.find((c) => c.id === requestedId) ?? list[0]
        : list[0];
      this.camera.set(cam);
      this.selectedStream.set(cam.defaultStream);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load cameras');
    }
  }

  onQualityChange(name: string) {
    this.selectedStream.set(name);
  }
}
