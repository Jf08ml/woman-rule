// Buzón de mejoras.
// POST: enviar sugerencia · GET ?ids=a,b: estado de las propias · GET ?admin=1 (Authorization: Bearer <FEEDBACK_ADMIN_KEY>): todas
import { route, getFeedback, clientIp } from '../lib/vercel.js';

const post = route('POST', async (req, body) => (await getFeedback()).submit(body, clientIp(req)));
const get = route('GET', async (req) => {
  const fb = await getFeedback();
  if (req.query.admin) return fb.list(req.headers.authorization);
  return fb.statuses(String(req.query.ids || '').split(',').filter(Boolean));
});

export default function handler(req, res) {
  return req.method === 'GET' ? get(req, res) : post(req, res);
}
