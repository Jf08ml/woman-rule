// Lógica de notificaciones compartida entre el servidor local (Express) y Vercel.
// `store` es un adaptador con: all() -> [[id, sub]], get(id), put(id, sub), del(id).
import webpush from 'web-push';
import crypto from 'node:crypto';

const DAILY_WINDOW_MIN = 30; // un diario se envía si estamos dentro de 30 min de su hora
const ONE_OFF_GRACE_MS = 6 * 60 * 60 * 1000; // un puntual atrasado se envía hasta 6 h después

export const subId = (endpoint) => crypto.createHash('sha256').update(endpoint).digest('hex').slice(0, 24);

function isValidTz(tz) {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}
export function localParts(tz, date = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
const toMinutes = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + m; };
const str = (v, max) => String(v ?? '').slice(0, max);
function sanitizeItem(it) {
  const url = str(it.url || '/', 200);
  return { id: str(it.id, 80), title: str(it.title, 120), body: str(it.body, 300), tag: str(it.tag, 60), url: url.startsWith('/') ? url : '/' };
}
const validSub = (s) => !!(s?.endpoint && /^https:\/\//.test(s.endpoint) && s?.keys?.p256dh && s?.keys?.auth);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createPushService({ store, vapid, subject }) {
  webpush.setVapidDetails(subject || 'mailto:admin@example.com', vapid.publicKey, vapid.privateKey);

  /** Envía un push; si la suscripción expiró la elimina. Devuelve true si se entregó. */
  async function send(id, subscription, payload) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: 'high' });
      return true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log('Suscripción expirada, eliminada:', id);
        await store.del(id);
      } else {
        console.error('Error enviando push:', err.statusCode || '', err.body || err.message);
      }
      return false;
    }
  }

  async function sync(body) {
    const { subscription, tz, oneOff = [], daily = [] } = body || {};
    if (!validSub(subscription)) throw new HttpError(400, 'Suscripción inválida');
    const id = subId(subscription.endpoint);
    const prev = await store.get(id);
    const zone = isValidTz(tz) ? tz : 'UTC';
    const { date, minutes } = localParts(zone);
    const cleanDaily = (Array.isArray(daily) ? daily : []).slice(0, 50)
      .filter((it) => /^\d{2}:\d{2}$/.test(it?.time))
      .map((it) => ({ ...sanitizeItem(it), time: it.time }));
    // No disparar de inmediato un diario cuya hora ya pasó hoy
    const dailySent = {};
    for (const it of cleanDaily) {
      if (prev?.dailySent?.[it.id]) dailySent[it.id] = prev.dailySent[it.id];
      else if (minutes - toMinutes(it.time) > 1) dailySent[it.id] = date;
    }
    const sub = {
      subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth } },
      tz: zone,
      oneOff: (Array.isArray(oneOff) ? oneOff : []).slice(0, 300)
        .filter((it) => Number.isFinite(it?.at))
        .map((it) => ({ ...sanitizeItem(it), at: it.at }))
        .sort((a, b) => a.at - b.at),
      daily: cleanDaily,
      dailySent,
      updatedAt: Date.now(),
    };
    await store.put(id, sub);
    return { ok: true, scheduled: sub.oneOff.length, daily: cleanDaily.length };
  }

  async function unsubscribe(endpoint) {
    if (endpoint) await store.del(subId(endpoint));
    return { ok: true };
  }

  /** Prepara un push de prueba. Devuelve { delayMs, run } para que el entorno decida cómo esperar. */
  function prepareTest(body) {
    const { subscription, delay = 0, title, body: text } = body || {};
    if (!validSub(subscription)) throw new HttpError(400, 'Suscripción inválida');
    const payload = {
      title: str(title || 'Lunara 🌙', 120),
      body: str(text || '¡Las notificaciones push funcionan correctamente!', 300),
      tag: 'test', url: '/#/today',
    };
    const delayMs = Math.min(Math.max(Number(delay) || 0, 0), 30) * 1000;
    return { delayMs, run: () => send(subId(subscription.endpoint), subscription, payload) };
  }

  /** Revisa todas las agendas y envía lo que toque. Llamar cada ~30-60 s. */
  async function tick(nowDate = new Date()) {
    const now = nowDate.getTime();
    let sent = 0;
    for (const [id, sub] of await store.all()) {
      if (!sub) continue;
      let changed = false;
      let alive = true;
      const due = sub.oneOff.filter((it) => it.at <= now);
      if (due.length) {
        sub.oneOff = sub.oneOff.filter((it) => it.at > now);
        changed = true;
        for (const it of due) {
          if (now - it.at > ONE_OFF_GRACE_MS) continue;
          if (await send(id, sub.subscription, it)) sent++;
          else if (!(await store.get(id))) { alive = false; break; }
        }
      }
      if (alive) {
        const { date, minutes } = localParts(sub.tz, nowDate);
        for (const it of sub.daily) {
          const diff = minutes - toMinutes(it.time);
          if (diff >= 0 && diff <= DAILY_WINDOW_MIN && sub.dailySent[it.id] !== date) {
            sub.dailySent[it.id] = date;
            changed = true;
            if (await send(id, sub.subscription, it)) sent++;
            else if (!(await store.get(id))) { alive = false; break; }
          }
        }
      }
      if (alive && changed) await store.put(id, sub);
    }
    return { sent };
  }

  return { publicKey: vapid.publicKey, sync, unsubscribe, prepareTest, tick };
}
