import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';

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
}
