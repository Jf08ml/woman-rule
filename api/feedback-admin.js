// Gestión del buzón de mejoras: cambiar estado, responder o borrar. Requiere FEEDBACK_ADMIN_KEY.
import { route, getFeedback } from '../lib/vercel.js';

export default route('POST', async (req, body) => (await getFeedback()).admin(req.headers.authorization, body));
