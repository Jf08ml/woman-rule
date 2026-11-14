// Servidor local de Lunara (desarrollo o hosting con proceso persistente).
// En Vercel se usan las funciones de /api y el cron de vercel.json en su lugar.
import express from 'express';
import webpush from 'web-push';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPushService, HttpError } from '../lib/push-core.js';
import { fileStore } from '../lib/stores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });

// Claves VAPID: variables de entorno o archivo generado automáticamente
const vapidFile = path.join(DATA_DIR, 'vapid.json');
let vapid;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  vapid = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
} else if (fs.existsSync(vapidFile)) {
  vapid = JSON.parse(fs.readFileSync(vapidFile, 'utf8'));
} else {
  vapid = webpush.generateVAPIDKeys();
  fs.writeFileSync(vapidFile, JSON.stringify(vapid, null, 2));
  console.log('Claves VAPID generadas en', vapidFile);
}

const service = createPushService({ store: fileStore(DATA_DIR), vapid, subject: process.env.VAPID_SUBJECT });
setInterval(() => service.tick().catch((e) => console.error(e)), 30_000);

const app = express();
app.use(express.json({ limit: '200kb' }));

const handle = (fn) => async (req, res) => {
  try { res.json(await fn(req.body || {})); } catch (err) {
    if (err instanceof HttpError) res.status(err.status).json({ error: err.message });
    else { console.error(err); res.status(500).json({ error: 'Error interno' }); }
  }
};

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/vapid-public-key', (_req, res) => res.json({ key: service.publicKey }));
app.post('/api/sync', handle((b) => service.sync(b)));
app.post('/api/unsubscribe', handle((b) => service.unsubscribe(b.endpoint)));
app.post('/api/test', handle(async (b) => {
  const { delayMs, run } = service.prepareTest(b);
  setTimeout(run, delayMs);
  return { ok: true, delay: delayMs / 1000 };
}));

app.use((req, res, next) => {
  if (req.path === '/sw.js' || req.path.endsWith('.webmanifest') || req.path === '/' || req.path.endsWith('.html')) {
    res.set('Cache-Control', 'no-cache');
  }
  next();
});
app.use(express.static(PUBLIC_DIR, {
  setHeaders: (res, file) => { if (file.endsWith('.webmanifest')) res.set('Content-Type', 'application/manifest+json'); },
}));

app.listen(PORT, () => console.log(`Lunara escuchando en http://localhost:${PORT}`));
