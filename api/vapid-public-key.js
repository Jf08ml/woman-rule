import { route } from '../lib/vercel.js';

export default route('GET', async () => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) throw new Error('VAPID_PUBLIC_KEY no configurada');
  return { key };
});
