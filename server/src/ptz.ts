import { Cam } from 'onvif';
import { config } from './config.js';

export type Direction = 'up' | 'down' | 'left' | 'right' | 'stop';

let camPromise: Promise<any> | null = null;

function getCam(): Promise<any> {
  if (camPromise) return camPromise;
  camPromise = new Promise((resolve, reject) => {
    const cam = new Cam(
      {
        hostname: config.camera.ip,
        username: config.camera.user,
        password: config.camera.pass,
        port: config.camera.onvifPort,
      },
      (err: Error | null) => {
        if (err) {
          camPromise = null;
          reject(err);
        } else {
          resolve(cam);
        }
      },
    );
  });
  return camPromise;
}

const SPEED = 0.5;

export async function move(direction: Direction): Promise<void> {
  const cam = await getCam();
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

export async function gotoPreset(token: string): Promise<void> {
  const cam = await getCam();
  await new Promise<void>((res, rej) =>
    cam.gotoPreset({ preset: token }, (e: Error | null) => (e ? rej(e) : res())),
  );
}

export async function listPresets(): Promise<Array<{ name: string; token: string }>> {
  const cam = await getCam();
  return new Promise((res, rej) =>
    cam.getPresets((err: Error | null, presets: Record<string, string>) => {
      if (err) return rej(err);
      res(Object.entries(presets).map(([name, token]) => ({ name, token })));
    }),
  );
}
