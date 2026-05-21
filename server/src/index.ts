import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { move, gotoPreset, listPresets, type Direction } from './ptz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

app.post('/api/ptz/move', async (req, res) => {
  try {
    await move(req.body.direction as Direction);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/ptz/presets', async (_req, res) => {
  try {
    res.json(await listPresets());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ptz/preset/:token', async (req, res) => {
  try {
    await gotoPreset(req.params.token);
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
  console.log(`Server listening on http://0.0.0.0:${config.server.port}`);
});
