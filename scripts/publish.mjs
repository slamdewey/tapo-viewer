#!/usr/bin/env node
// Deploy server + web bundle + camera config to the Pi.
// Cross-platform (no bash required). Invoked via `npm run deploy`.

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const IS_WIN = process.platform === 'win32';
const NPM = IS_WIN ? 'npm.cmd' : 'npm';

let piHost = 'wormhole.local';
let piUser = 'jared';
let remoteDir = '/home/jared/tapo-viewer';
let skipBuild = false;

const envPath = resolve(ROOT, 'deploy.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k === 'PiHost') piHost = v.trim();
    else if (k === 'PiUser') piUser = v.trim();
    else if (k === 'RemoteDir') remoteDir = v.trim();
  }
}

const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--skip-build') skipBuild = true;
  else if (a === '--host') piHost = argv[++i];
  else if (a === '--user') piUser = argv[++i];
  else if (a === '--dir') remoteDir = argv[++i];
  else {
    console.error(`Unknown arg: ${a}`);
    process.exit(1);
  }
}

const target = `${piUser}@${piHost}`;
const hasWeb = existsSync(resolve(ROOT, 'web/package.json'));

function run(cmd, args, opts = {}) {
  // Node 20+ requires shell:true to invoke .cmd files on Windows.
  const needsShell = IS_WIN && cmd.endsWith('.cmd');
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: needsShell, ...opts });
  if (r.status !== 0) {
    console.error(`!! ${cmd} ${args.join(' ')} exited ${r.status}`);
    process.exit(r.status ?? 1);
  }
}

function step(msg) {
  console.log(`\n==> ${msg}`);
}

if (!skipBuild) {
  step('Building server');
  run(NPM, ['ci'], { cwd: resolve(ROOT, 'server') });
  run(NPM, ['run', 'build'], { cwd: resolve(ROOT, 'server') });

  if (hasWeb) {
    step('Building web');
    run(NPM, ['ci'], { cwd: resolve(ROOT, 'web') });
    run(NPM, ['run', 'build', '--', '--configuration=production'], {
      cwd: resolve(ROOT, 'web'),
    });
  } else {
    step('Skipping web build (web/ not present)');
  }
}

step(`Preparing remote dirs on ${target}`);
run('ssh', [
  target,
  `mkdir -p ${remoteDir}/server ${remoteDir}/web ${remoteDir}/scripts`,
]);

step('Syncing server artifacts');
run('scp', ['-r', resolve(ROOT, 'server/dist'), `${target}:${remoteDir}/server/`]);
run('scp', [resolve(ROOT, 'server/package.json'), `${target}:${remoteDir}/server/`]);
run('scp', [resolve(ROOT, 'server/package-lock.json'), `${target}:${remoteDir}/server/`]);

if (existsSync(resolve(ROOT, 'server/.env'))) {
  step('Syncing server/.env');
  run('scp', [resolve(ROOT, 'server/.env'), `${target}:${remoteDir}/server/.env`]);
} else {
  step(`No local server/.env to sync (create ${remoteDir}/server/.env on Pi manually)`);
}

if (hasWeb) {
  step('Syncing web build');
  run('scp', ['-r', resolve(ROOT, 'web/dist'), `${target}:${remoteDir}/web/`]);
} else {
  step('Skipping web sync (web/ not present)');
}

step('Generating go2rtc.yaml');
const tmpYaml = join(tmpdir(), `go2rtc.${process.pid}.yaml`);
const gen = spawnSync('node', [resolve(ROOT, 'scripts/gen-go2rtc.mjs')]);
if (gen.status !== 0) {
  console.error(gen.stderr?.toString() ?? 'gen-go2rtc failed');
  process.exit(gen.status ?? 1);
}
writeFileSync(tmpYaml, gen.stdout);

try {
  step('Syncing camera config, go2rtc.yaml, and systemd units');
  run('scp', [resolve(ROOT, 'cameras.yaml'), `${target}:${remoteDir}/cameras.yaml`]);
  run('scp', [resolve(ROOT, 'models.yaml'), `${target}:${remoteDir}/models.yaml`]);
  run('scp', [tmpYaml, `${target}:${remoteDir}/go2rtc.yaml`]);
  run('scp', [
    resolve(ROOT, 'scripts/tapo-server.service'),
    `${target}:${remoteDir}/scripts/`,
  ]);
  run('scp', [resolve(ROOT, 'scripts/go2rtc.service'), `${target}:${remoteDir}/scripts/`]);
  run('scp', [resolve(ROOT, 'scripts/install-pi.sh'), `${target}:${remoteDir}/scripts/`]);
  run('scp', [
    resolve(ROOT, 'scripts/dnsmasq.scry.conf'),
    `${target}:${remoteDir}/scripts/`,
  ]);
  run('scp', [resolve(ROOT, 'scripts/Caddyfile'), `${target}:${remoteDir}/scripts/`]);

  step('Installing server prod deps on Pi');
  run('ssh', [target, `cd ${remoteDir}/server && npm ci --omit=dev`]);

  step('Running install-pi.sh (idempotent system setup)');
  run('ssh', ['-t', target, `bash ${remoteDir}/scripts/install-pi.sh`]);

  step('Restarting user services');
  run('ssh', [target, 'systemctl --user restart go2rtc tapo-server']);

  step(`Done. http://${piHost}:8080`);
} finally {
  try {
    unlinkSync(tmpYaml);
  } catch {}
}
