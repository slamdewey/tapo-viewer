import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CameraService } from '../services/camera.service';
import { Camera } from '../types/camera';

@Component({
  selector: 'app-camera-list',
  imports: [RouterLink],
  templateUrl: './camera-list.html',
  styleUrl: './camera-list.scss',
})
export class CameraList implements OnInit {
  private cameras = inject(CameraService);

  list = signal<Camera[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  thumbErrors = signal<Set<string>>(new Set());

  async ngOnInit() {
    try {
      this.list.set(await this.cameras.list());
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load cameras');
    } finally {
      this.loading.set(false);
    }
  }

  thumbnailUrl(cam: Camera): string {
    const sd = cam.streams.find((s) => s.quality === 'sd');
    const name = sd?.name ?? cam.defaultStream;
    return `/stream/api/frame.jpeg?src=${encodeURIComponent(name)}`;
  }

  hasThumbError(id: string): boolean {
    return this.thumbErrors().has(id);
  }

  onThumbError(id: string) {
    this.thumbErrors.update((s) => {
      const next = new Set(s);
      next.add(id);
      return next;
    });
  }
}
