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

// Public shape returned by /api/cameras. No credentials, no host info.
export interface Camera {
  id: string;
  label: string;
  model: string;
  capabilities: CameraCapabilities;
  streams: CameraStreamInfo[];
  defaultStream: string;
}

// Server-side only: includes the data needed to actually talk to the camera.
export interface CameraNetwork {
  ip: string;
  user: string;
  pass: string;
  onvifPort: number;
}

export interface ResolvedCamera extends Camera {
  network: CameraNetwork;
  // Per-quality rtsp paths from the model definition, indexed by stream name.
  rtspPathByStream: Record<string, string>;
}

export interface ModelQuality {
  quality: CameraQuality;
  label: string;
  rtspPath: string;
}

export interface ModelDefinition {
  capabilities: CameraCapabilities;
  qualities: ModelQuality[];
}

export type ModelRegistry = Record<string, ModelDefinition>;
