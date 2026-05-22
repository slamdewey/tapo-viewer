import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { Go2rtcConnection, Go2rtcWebrtcService } from '../services/go2rtc-webrtc.service';
import { ZoomDirective } from '../zoom.directive';

@Component({
  selector: 'app-stream',
  imports: [ZoomDirective],
  templateUrl: './stream.html',
  styleUrl: './stream.scss',
})
export class Stream implements OnDestroy {
  private webrtc = inject(Go2rtcWebrtcService);

  streamName = input.required<string>();

  videoRef = viewChild.required<ElementRef<HTMLVideoElement>>('video');

  error = signal<string | null>(null);
  connecting = signal(true);
  needsTap = signal(false);
  muted = signal(true);

  private connection: Go2rtcConnection | null = null;

  constructor() {
    effect(() => {
      const name = this.streamName();
      if (!name) return;
      void this.reconnect(name);
    });
  }

  ngOnDestroy() {
    this.connection?.close();
    this.connection = null;
  }

  private async reconnect(name: string) {
    this.connection?.close();
    this.connection = null;
    this.error.set(null);
    this.needsTap.set(false);
    this.connecting.set(true);
    try {
      this.connection = await this.webrtc.connect(name);
      const v = this.videoRef().nativeElement;
      v.muted = this.muted();
      v.srcObject = this.connection.stream;
      await new Promise((r) => setTimeout(r, 0));
      await this.tryPlay();
    } catch (e: any) {
      this.error.set(e?.message ?? 'Connection failed');
    } finally {
      this.connecting.set(false);
    }
  }

  async tryPlay() {
    try {
      await this.videoRef().nativeElement.play();
      this.needsTap.set(false);
    } catch {
      this.needsTap.set(true);
    }
  }

  manualPlay() {
    void this.tryPlay();
  }

  toggleMute() {
    const v = this.videoRef().nativeElement;
    v.muted = !v.muted;
    this.muted.set(v.muted);
  }
}
