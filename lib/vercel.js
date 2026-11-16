// Utilidades para las funciones serverless de Vercel.
import { createPushService, HttpError } from './push-core.js';
import { redisStore } from './stores.js';

let servicePromise = null;

export function getService() {
  if (!servicePromise) {
    servicePromise = (async () => {
      const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
      if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (genéralas con `npm run vapid`)');
      const store = await redisStore();
      const service = createPushService({ store, vapid: { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY }, subject: VAPID_SUBJECT });
      return { service, store };
    })().catch((e) => { servicePromise = null; throw e; });
  }
  return servicePromise;
}

/** Envuelve un handler: método permitido, JSON y errores. */
export function route(method, fn) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== method) { res.setHeader('Allow', method); return res.status(405).json({ error: 'Método no permitido' }); }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const result = await fn(req, body);
      return res.status(200).json(result);
    } catch (err) {
      if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
      console.error(err);
      return res.status(500).json({ error: 'Error interno' });
    }
  };
}

let feedbackPromise = null;

/** Servicio del buzón de mejoras (no depende de las claves VAPID). */
export function getFeedback() {
  if (!feedbackPromise) {
    feedbackPromise = (async () => {
      const { createFeedbackService, feedbackRedisStore } = await import('./feedback.js');
      const { redis } = await redisStore();
      return createFeedbackService({ store: feedbackRedisStore(redis), adminKey: process.env.FEEDBACK_ADMIN_KEY });
    })().catch((e) => { feedbackPromise = null; throw e; });
  }
  return feedbackPromise;
}

export const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || '';
