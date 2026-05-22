#!/usr/bin/env node
// Local go2rtc runner for development.
// - Downloads the platform-appropriate binary to tools/ on first run
// - Generates a dev go2rtc.yaml from cameras.yaml + models.yaml
// - Spawns go2rtc, forwarding stdio
// - Watches cameras.yaml / models.yaml and restarts go2rtc on change

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  chmodSync,
  renameSync,
  readdirSync,
  watch,
} from 'node:fs';
import { spawnSync, spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOOLS = resolve(ROOT, 'tools');
const VERSION = 'v1.9.4';

const TARGETS = {
  'win32-x64':    { asset: 'go2rtc_win64.zip',     exe: 'go2rtc.exe', zip: true },
  'win32-arm64':  { asset: 'go2rtc_win_arm64.zip', exe: 'go2rtc.exe', zip: true },
  'linux-x64':    { asset: 'go2rtc_linux_amd64',   exe: 'go2rtc',     zip: false },
  'linux-arm64':  { asset: 'go2rtc_linux_arm64',   exe: 'go2rtc',     zip: false },
  'darwin-x64':   { asset: 'go2rtc_mac_amd64.zip', exe: 'go2rtc',     zip: true },
  'darwin-arm64': { asset: 'go2rtc_mac_arm64.zip', exe: 'go2rtc',     zip: true },
};
const key = `${process.platform}-${process.arch}`;
const target = TARGETS[key];
if (!target) {
  console.error(`Unsupported platform: ${key}.`);
  process.exit(1);
}

const binaryPath = join(TOOLS, target.exe);
const cfgPath = join(TOOLS, 'go2rtc.dev.yaml');

async function ensureBinary() {
  if (existsSync(binaryPath)) return;
  mkdirSync(TOOLS, { recursive: true });
  const url = `https://github.com/AlexxIT/go2rtc/releases/download/${VERSION}/${target.asset}`;
  console.log(`==> Downloading go2rtc ${VERSION} (${target.asset})`);

  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${url}`);
  const buf = Buffer.from(await resp.arrayBuffer());

  if (target.zip) {
    const zipPath = join(TOOLS, target.asset);
    writeFileSync(zipPath, buf);
    console.log('==> Extracting');
    const r = spawnSync('tar', ['-xf', zipPath, '-C', TOOLS], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error('tar extract failed');
    unlinkSync(zipPath);
    if (!existsSync(binaryPath)) {
      const fallback = findExe(TOOLS, target.exe);
      if (!fallback) throw new Error(`Could not locate ${target.exe} after extraction`);
      renameSync(fallback, binaryPath);
    }
  } else {
    writeFileSync(binaryPath, buf);
  }
  if (process.platform !== 'win32') chmodSync(binaryPath, 0o755);
}

function findExe(dir, name) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name === name) return join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = join(dir, entry.name, name);
      if (existsSync(sub)) return sub;
    }
  }
  return null;
}

function regenerateConfig() {
  const r = spawnSync('node', [resolve(__dirname, 'gen-go2rtc.mjs'), '--dev']);
  if (r.status !== 0) {
    console.error(r.stderr?.toString() ?? 'gen-go2rtc failed');
    return false;
  }
  writeFileSync(cfgPath, r.stdout);
  return true;
}

let child = null;
let restarting = false;

function startGo2rtc() {
  if (!regenerateConfig()) {
    process.exit(1);
  }
  console.log(`==> go2rtc starting (config ${cfgPath})`);
  const c = spawn(binaryPath, ['-config', cfgPath], { stdio: 'inherit' });
  c.on('exit', (code) => {
    if (restarting) {
      restarting = false;
      child = startGo2rtc();
    } else {
      process.exit(code ?? 0);
    }
  });
  return c;
}

let debounce = null;
function onYamlChange(label) {
  return () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`==> ${label} changed; restarting go2rtc`);
      restarting = true;
      if (child) child.kill();
    }, 250);
  };
}

await ensureBinary();
child = startGo2rtc();

watch(resolve(ROOT, 'cameras.yaml'), onYamlChange('cameras.yaml'));
watch(resolve(ROOT, 'models.yaml'), onYamlChange('models.yaml'));

const shutdown = () => {
  restarting = false;
  if (child) child.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
