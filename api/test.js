import { waitUntil } from '@vercel/functions';
import { route, getService } from '../lib/vercel.js';

// Responde de inmediato y envía el push tras el retraso, aunque el cliente cierre la app.
export default route('POST', async (_req, body) => {
  const { service } = await getService();
  const { delayMs, run } = service.prepareTest(body);
  waitUntil(new Promise((r) => setTimeout(r, delayMs)).then(run));
  return { ok: true, delay: delayMs / 1000 };
});
