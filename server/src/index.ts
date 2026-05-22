import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cameras, camerasById, config } from './config.js';
import { toPublicCamera } from './cameras.js';
import { move, type Direction } from './ptz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`);
  });
  next();
});

app.get('/api/cameras', (_req, res) => {
  res.json(cameras.map(toPublicCamera));
});

app.get('/api/cameras/:id', (req, res) => {
  const cam = camerasById.get(req.params.id);
  if (!cam) return res.status(404).json({ error: 'not found' });
  res.json(toPublicCamera(cam));
});

app.post('/api/cameras/:id/ptz/move', async (req, res) => {
  try {
    await move(req.params.id, req.body.direction as Direction);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.use(
  '/stream',
  createProxyMiddleware({
    target: config.go2rtcUrl,
    changeOrigin: true,
    ws: true,
    pathRewrite: { '^/stream': '' },
  }),
);

const webDist = path.resolve(__dirname, '..', config.webDist);
app.use(express.static(webDist));
app.get('*', (_req, res) => res.sendFile(path.join(webDist, 'index.html')));

app.listen(config.server.port, () => {
  console.log(
    `Server listening on http://0.0.0.0:${config.server.port}; loaded ${cameras.length} camera(s): ${cameras.map((c) => c.id).join(', ')}`,
  );
});
