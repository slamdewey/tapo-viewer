import 'dotenv/config';
import { loadCameras } from './cameras.js';

export const config = {
  server: {
    port: Number(process.env.SERVER_PORT ?? 8080),
  },
  go2rtcUrl: process.env.GO2RTC_URL ?? 'http://127.0.0.1:1984',
  webDist: process.env.WEB_DIST ?? '../web/dist/tapo-viewer-web/browser',
};

// Loaded once at startup. Server restart picks up cameras.yaml edits.
export const cameras = loadCameras();
export const camerasById = new Map(cameras.map((c) => [c.id, c]));
