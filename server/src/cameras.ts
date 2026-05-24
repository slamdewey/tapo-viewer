import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import {
  Camera,
  ModelDefinition,
  ModelRegistry,
  ResolvedCamera,
} from './types.js';

interface RawCamera {
  id: string;
  label: string;
  model: string;
  network: {
    ip: string;
    user: string;
    pass: string;
    onvifPort?: number;
  };
}

interface RawCamerasFile {
  cameras: RawCamera[];
}

const FALLBACK_MODEL = 'generic';

// Resolve paths relative to the server working directory's parent (the repo root).
// In production, server runs from /home/jared/scry/server, so ../cameras.yaml.
// In dev, same shape (cwd=server when launched via npm scripts).
const REPO_ROOT = resolve(process.cwd(), '..');
const CAMERAS_PATH = resolve(REPO_ROOT, 'cameras.yaml');
const MODELS_PATH = resolve(REPO_ROOT, 'models.yaml');

export function loadCameras(): ResolvedCamera[] {
  const cameras = parseYaml<RawCamerasFile>(CAMERAS_PATH);
  const models = parseYaml<ModelRegistry>(MODELS_PATH);

  if (!cameras?.cameras?.length) {
    throw new Error(`No cameras defined in ${CAMERAS_PATH}`);
  }

  const seenIds = new Set<string>();
  return cameras.cameras.map((raw) => resolveCamera(raw, models, seenIds));
}

export function toPublicCamera(c: ResolvedCamera): Camera {
  const { network: _net, rtspPathByStream: _r, ...pub } = c;
  return pub;
}

function resolveCamera(
  raw: RawCamera,
  models: ModelRegistry,
  seenIds: Set<string>,
): ResolvedCamera {
  if (!raw.id || !/^[a-z0-9_]+$/.test(raw.id)) {
    throw new Error(
      `Camera id "${raw.id}" must be snake_case ([a-z0-9_]+)`,
    );
  }
  if (seenIds.has(raw.id)) {
    throw new Error(`Duplicate camera id: ${raw.id}`);
  }
  seenIds.add(raw.id);

  const model: ModelDefinition =
    models[raw.model] ?? models[FALLBACK_MODEL] ?? throwMissingFallback();

  const streams = model.qualities.map((q) => ({
    name: `${raw.id}_${q.quality}`,
    quality: q.quality,
    label: q.label,
  }));
  const rtspPathByStream: Record<string, string> = {};
  for (const q of model.qualities) {
    rtspPathByStream[`${raw.id}_${q.quality}`] = q.rtspPath;
  }

  return {
    id: raw.id,
    label: raw.label ?? raw.id,
    model: raw.model,
    capabilities: model.capabilities,
    streams,
    defaultStream: streams[0].name,
    network: {
      ip: raw.network.ip,
      user: raw.network.user,
      pass: raw.network.pass,
      onvifPort: raw.network.onvifPort ?? 2020,
    },
    rtspPathByStream,
  };
}

function throwMissingFallback(): never {
  throw new Error(
    `Camera model not found and no "${FALLBACK_MODEL}" fallback in models.yaml`,
  );
}

function parseYaml<T>(path: string): T {
  try {
    return yaml.load(readFileSync(path, 'utf8')) as T;
  } catch (e: any) {
    throw new Error(`Failed to read ${path}: ${e.message ?? e}`);
  }
}
