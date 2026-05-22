import { Cam } from 'onvif';
import { camerasById } from './config.js';
import { ResolvedCamera } from './types.js';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';

const SPEED = 0.5;

// One ONVIF connection per camera, kept warm.
const camCache = new Map<string, Promise<any>>();

function getCam(id: string): Promise<any> {
  const cached = camCache.get(id);
  if (cached) return cached;
  const cam = lookup(id);
  const p = new Promise<any>((resolve, reject) => {
    const conn = new Cam(
      {
        hostname: cam.network.ip,
        username: cam.network.user,
        password: cam.network.pass,
        port: cam.network.onvifPort,
      },
      (err: Error | null) => {
        if (err) {
          camCache.delete(id);
          reject(err);
        } else {
          resolve(conn);
        }
      },
    );
  });
  camCache.set(id, p);
  return p;
}

function lookup(id: string): ResolvedCamera {
  const cam = camerasById.get(id);
  if (!cam) throw new Error(`Unknown camera id: ${id}`);
  if (!cam.capabilities.ptz) {
    throw new Error(`Camera ${id} does not support PTZ`);
  }
  return cam;
}

export async function move(id: string, direction: Direction): Promise<void> {
  const cam = await getCam(id);
  if (direction === 'stop') {
    await new Promise<void>((res, rej) =>
      cam.stop({ panTilt: true, zoom: true }, (e: Error | null) => (e ? rej(e) : res())),
    );
    return;
  }
  const vec = {
    up:    { x: 0,      y:  SPEED },
    down:  { x: 0,      y: -SPEED },
    left:  { x: -SPEED, y: 0 },
    right: { x:  SPEED, y: 0 },
  }[direction];
  await new Promise<void>((res, rej) =>
    cam.continuousMove({ ...vec, zoom: 0 }, (e: Error | null) => (e ? rej(e) : res())),
  );
}

export async function gotoPreset(id: string, token: string): Promise<void> {
  const cam = await getCam(id);
  await new Promise<void>((res, rej) =>
    cam.gotoPreset({ preset: token }, (e: Error | null) => (e ? rej(e) : res())),
  );
}

export async function listPresets(
  id: string,
): Promise<Array<{ name: string; token: string }>> {
  const cam = await getCam(id);
  return new Promise((res, rej) =>
    cam.getPresets((err: Error | null, presets: Record<string, string>) => {
      if (err) return rej(err);
      res(Object.entries(presets).map(([name, token]) => ({ name, token })));
    }),
  );
}
