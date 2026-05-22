#!/usr/bin/env node
// Generates the live go2rtc.yaml from cameras.yaml + models.yaml.
// Reads from repo root, writes to stdout. Invoked by scripts/publish.sh.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const isDev = process.argv.includes('--dev');

const cameras = readYaml(resolve(ROOT, 'cameras.yaml'));
const models = readYaml(resolve(ROOT, 'models.yaml'));

if (!cameras?.cameras?.length) {
  fail(`No cameras defined in cameras.yaml`);
}

// In dev, go2rtc runs on the same machine as the browser — let it auto-detect
// local interfaces. In prod, advertise the Pi's hostname so remote browsers
// can establish WebRTC.
let publicHost = 'wormhole.local';
if (!isDev) {
  try {
    const env = readFileSync(resolve(ROOT, 'deploy.env'), 'utf8');
    const m = env.match(/^\s*PiHost\s*=\s*(\S+)/m);
    if (m) publicHost = m[1].trim();
  } catch {
    // no deploy.env, use default
  }
}

const streams = {};
const seen = new Set();
for (const cam of cameras.cameras) {
  if (seen.has(cam.id)) fail(`Duplicate camera id: ${cam.id}`);
  seen.add(cam.id);
  const model = models[cam.model] ?? models.generic;
  if (!model) fail(`Unknown camera model "${cam.model}" and no generic fallback`);
  const { ip, user, pass } = cam.network;
  for (const q of model.qualities) {
    streams[`${cam.id}_${q.quality}`] = `rtsp://${user}:${pass}@${ip}:554${q.rtspPath}`;
  }
}

const out = {
  streams,
  api: { listen: ':1984', origin: '*' },
  webrtc: isDev
    ? { listen: ':8555' }
    : { listen: ':8555', candidates: [`${publicHost}:8555`] },
};

process.stdout.write(yaml.dump(out, { lineWidth: 200 }));

function readYaml(path) {
  try {
    return yaml.load(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`Cannot read ${path}: ${e.message ?? e}`);
  }
}

function fail(msg) {
  process.stderr.write(`gen-go2rtc: ${msg}\n`);
  process.exit(1);
}
