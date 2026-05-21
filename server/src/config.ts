import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  camera: {
    ip: required('CAMERA_IP'),
    user: required('CAMERA_USER'),
    pass: required('CAMERA_PASS'),
    onvifPort: Number(process.env.CAMERA_ONVIF_PORT ?? 2020),
  },
  server: {
    port: Number(process.env.SERVER_PORT ?? 8080),
  },
  go2rtcUrl: process.env.GO2RTC_URL ?? 'http://127.0.0.1:1984',
  webDist: process.env.WEB_DIST ?? '../../web/dist/tapo-viewer-web/browser',
};
