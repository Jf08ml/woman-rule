// Adaptadores de almacenamiento para las suscripciones push.
import fs from 'node:fs';
import path from 'node:path';

/** Archivo JSON local (servidor Express). */
export function fileStore(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'db.json');
  let db = { subs: {} };
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* primera ejecución */ }
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.writeFileSync(file + '.tmp', JSON.stringify(db));
      fs.renameSync(file + '.tmp', file);
    }, 300);
  };
  return {
    async all() { return Object.entries(db.subs); },
    async get(id) { return db.subs[id] || null; },
    async put(id, sub) { db.subs[id] = sub; save(); },
    async del(id) { delete db.subs[id]; save(); },
  };
}

/** Upstash Redis (Vercel). Acepta las variables de la integración de Vercel o las de Upstash. */
export async function redisStore() {
  const { Redis } = await import('@upstash/redis');
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error('Faltan las variables de Upstash Redis (UPSTASH_REDIS_REST_URL/TOKEN o KV_REST_API_URL/TOKEN)');
  const redis = new Redis({ url, token });
  const SET = 'lunara:subs';
  const key = (id) => `lunara:sub:${id}`;
  return {
    redis,
    async all() {
      const ids = await redis.smembers(SET);
      const out = [];
      for (let i = 0; i < ids.length; i += 100) {
        const chunk = ids.slice(i, i + 100);
        const vals = await redis.mget(...chunk.map(key));
        chunk.forEach((id, j) => { if (vals[j]) out.push([id, vals[j]]); else redis.srem(SET, id); });
      }
      return out;
    },
    async get(id) { return (await redis.get(key(id))) || null; },
    async put(id, sub) {
      // Caduca si el dispositivo no vuelve a sincronizar en 400 días
      await redis.multi().set(key(id), sub, { ex: 400 * 86400 }).sadd(SET, id).exec();
    },
    async del(id) { await redis.multi().del(key(id)).srem(SET, id).exec(); },
  };
}
