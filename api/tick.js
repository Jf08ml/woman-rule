// Ejecutado cada minuto por Vercel Cron (ver vercel.json).
// Vercel envía `Authorization: Bearer <CRON_SECRET>` cuando la variable CRON_SECRET existe.
import { getService } from '../lib/vercel.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const { service, store } = await getService();
    // Evita ejecuciones solapadas
    const lock = await store.redis.set('lunara:tick-lock', Date.now(), { nx: true, ex: 55 });
    if (!lock) return res.status(200).json({ ok: true, skipped: 'en curso' });
    try {
      const result = await service.tick();
      return res.status(200).json({ ok: true, ...result });
    } finally {
      await store.redis.del('lunara:tick-lock');
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno' });
  }
}
