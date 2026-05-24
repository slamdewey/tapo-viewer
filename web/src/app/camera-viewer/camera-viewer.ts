import {
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Title } from '@angular/platform-browser';
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
  private titleService = inject(Title);

  private params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  playerRef = viewChild<ElementRef<HTMLElement>>('player');
  streamRef = viewChild<Stream>('streamCmp');

  camera = signal<Camera | null>(null);
  selectedStream = signal<string>('');
  error = signal<string | null>(null);
  isFullscreen = signal(false);
  qualityMenuOpen = signal(false);
  overlayVisible = signal(true);

  hasMultipleQualities = computed(() => (this.camera()?.streams.length ?? 0) > 1);
  hasPtz = computed(() => !!this.camera()?.capabilities.ptz);
  selectedStreamLabel = computed(() => {
    const cam = this.camera();
    if (!cam) return '';
    return cam.streams.find((s) => s.name === this.selectedStream())?.label ?? '';
  });

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
      this.titleService.setTitle(`${cam.label} · scry`);
    } catch (e: any) {
      this.error.set(e?.message ?? 'Failed to load cameras');
    }
  }

  onQualityChange(name: string) {
    this.selectedStream.set(name);
    this.qualityMenuOpen.set(false);
  }

  toggleQualityMenu() {
    this.qualityMenuOpen.update((v) => !v);
  }

  onPlayerClick(ev: MouseEvent) {
    const target = ev.target as HTMLElement;
    if (target.closest('.overlay-top, .overlay-ptz, .overlay-controls')) return;
    this.overlayVisible.update((v) => !v);
    if (!this.overlayVisible()) this.qualityMenuOpen.set(false);
  }

  toggleMute() {
    this.streamRef()?.toggleMute();
  }

  muted() {
    return this.streamRef()?.muted() ?? false;
  }

  async toggleFullscreen() {
    const el = this.playerRef()?.nativeElement;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await el.requestFullscreen();
    }
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.isFullscreen.set(!!document.fullscreenElement);
  }
}
