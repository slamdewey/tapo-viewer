import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';

export interface Preset {
  name: string;
  token: string;
}

@Injectable({ providedIn: 'root' })
export class PtzService {
  private http = inject(HttpClient);

  move(cameraId: string, direction: Direction): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(`/api/cameras/${encodeURIComponent(cameraId)}/ptz/move`, {
        direction,
      }),
    );
  }

  presets(cameraId: string): Promise<Preset[]> {
    return firstValueFrom(
      this.http.get<Preset[]>(`/api/cameras/${encodeURIComponent(cameraId)}/ptz/presets`),
    );
  }

  gotoPreset(cameraId: string, token: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `/api/cameras/${encodeURIComponent(cameraId)}/ptz/preset/${encodeURIComponent(token)}`,
        {},
      ),
    );
  }
}
