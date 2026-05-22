export type CameraQuality = 'hd' | 'sd';

export interface CameraCapabilities {
  ptz: boolean;
  audio: boolean;
}

export interface CameraStreamInfo {
  name: string;
  quality: CameraQuality;
  label: string;
}

export interface Camera {
  id: string;
  label: string;
  model: string;
  capabilities: CameraCapabilities;
  streams: CameraStreamInfo[];
  defaultStream: string;
}
