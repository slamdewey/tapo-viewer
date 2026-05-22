import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Camera } from '../types/camera';

@Injectable({ providedIn: 'root' })
export class CameraService {
  private http = inject(HttpClient);

  list(): Promise<Camera[]> {
    return firstValueFrom(this.http.get<Camera[]>('/api/cameras'));
  }

  get(id: string): Promise<Camera> {
    return firstValueFrom(this.http.get<Camera>(`/api/cameras/${encodeURIComponent(id)}`));
  }
}
