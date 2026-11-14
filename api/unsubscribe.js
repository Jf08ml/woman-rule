import { route, getService } from '../lib/vercel.js';

export default route('POST', async (_req, body) => {
  const { service } = await getService();
  return service.unsubscribe(body.endpoint);
});
