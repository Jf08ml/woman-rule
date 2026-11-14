// Genera un par de claves VAPID para configurarlas como variables de entorno en Vercel.
import webpush from 'web-push';
import crypto from 'node:crypto';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log('Añade estas variables en Vercel (Settings → Environment Variables):\n');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log('VAPID_SUBJECT=mailto:tu-correo@dominio.com');
console.log(`CRON_SECRET=${crypto.randomBytes(24).toString('base64url')}`);
