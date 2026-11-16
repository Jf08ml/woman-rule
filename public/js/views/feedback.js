// Buzón de mejoras: las usuarias envían sugerencias y ven su estado y la respuesta del equipo.
// Solo se envía lo que escriben aquí (más versión, objetivo y plataforma); nunca sus datos de salud.
import { getState, update } from '../store.js';
import { fmt, toKey } from '../dates.js';
import { esc, toast } from '../ui.js';
import { icon } from '../icons.js';
import { isIOS, isStandalone } from '../push.js';

export const APP_VERSION = '1.6.0';

const CATEGORIES = [
  { id: 'feature', label: 'Nueva función', icon: 'sparkles' },
  { id: 'improve', label: 'Mejora', icon: 'thumbs-up' },
  { id: 'bug', label: 'Algo falla', icon: 'triangle-alert' },
  { id: 'other', label: 'Otro', icon: 'circle-dot' },
];
const STATUS = {
  new: ['Recibida', ''],
  review: ['En revisión', 'mid'],
  planned: ['Planeada', 'ok'],
  done: ['¡Hecha!', 'ok'],
  declined: ['Descartada por ahora', ''],
};

const draft = { category: 'feature', text: '', contact: '' };
let sending = false;
let remote = {}; // id -> { status, reply, updatedAt }
let loadedAt = 0;
const rerender = () => window.dispatchEvent(new Event('rerender'));

async function refreshStatuses(force = false) {
  const mine = getState().feedback || [];
  if (!mine.length || (!force && Date.now() - loadedAt < 60_000)) return;
  loadedAt = Date.now();
  try {
    const res = await fetch(`/api/feedback?ids=${encodeURIComponent(mine.map((f) => f.id).join(','))}`);
    if (!res.ok) return;
    remote = (await res.json()).items || {};
    rerender();
  } catch { /* sin conexión: se muestran como enviadas */ }
}

function platform() {
  if (isIOS()) return isStandalone() ? 'iOS app' : 'iOS web';
  const android = /Android/i.test(navigator.userAgent);
  return `${android ? 'Android' : 'Escritorio'}${isStandalone() ? ' app' : ' web'}`;
}

function mineList(mine) {
  if (!mine.length) return '';
  return `
  <section class="card">
    <div class="card-head"><h2>Mis sugerencias</h2><button class="link" data-act="refresh">Actualizar</button></div>
    <ul class="fb-list">
      ${[...mine].reverse().map((f) => {
        const r = remote[f.id];
        const [label, tone] = STATUS[r?.status || 'new'];
        const cat = CATEGORIES.find((c) => c.id === f.category) || CATEGORIES[3];
        return `<li>
          <div class="fb-meta"><span class="h-ic muted small">${icon(cat.icon)} ${cat.label} · ${fmt(toKey(new Date(f.at)), { day: 'numeric', month: 'short' })}</span>
            <span class="fb-status ${tone}">${label}</span></div>
          <p>${esc(f.text)}</p>
          ${r?.reply ? `<p class="fb-reply">${icon('heart', 'fill')} <span><b>Equipo Lunara:</b> ${esc(r.reply)}</span></p>` : ''}
        </li>`;
      }).join('')}
    </ul>
  </section>`;
}

export function render() {
  const s = getState();
  const mine = s.feedback || [];
  refreshStatuses();
  return {
    html: `
    <header class="topbar">
      <a class="icon-btn" href="#/settings" aria-label="Volver">${icon('chevron-left')}</a>
      <div class="center"><p class="eyebrow">Ayúdanos a mejorar</p><h1 class="h-sm">Mejoras</h1></div>
      <span class="icon-btn ghost"></span>
    </header>

    <section class="card">
      <h2 class="h-ic">${icon('sparkles')} ¿Qué te gustaría en Lunara?</h2>
      <p class="muted small">Cuéntanos qué función te falta, qué cambiarías o si algo no funciona. Leemos todas las sugerencias.</p>
      <p class="field-label">Tipo</p>
      <div class="seg-ctl">${CATEGORIES.map((c) => `<button type="button" data-cat="${c.id}" class="${draft.category === c.id ? 'on' : ''}">${icon(c.icon)} ${c.label}</button>`).join('')}</div>
      <label class="field">Tu sugerencia
        <textarea data-f="text" rows="5" maxlength="1500" placeholder="${draft.category === 'bug' ? 'Qué estabas haciendo, qué esperabas y qué pasó…' : 'Me gustaría que Lunara…'}">${esc(draft.text)}</textarea>
        <small data-count>${draft.text.length}/1500</small></label>
      <label class="field">Contacto (opcional)
        <input type="text" data-f="contact" maxlength="120" value="${esc(draft.contact)}" placeholder="Correo o usuario, por si queremos preguntarte algo"></label>
      <input type="text" name="website" data-f="website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true">
      <p class="muted small">${icon('lock')} No incluyas datos de salud. Solo enviamos lo que escribas aquí, la versión de la app y tu tipo de dispositivo.</p>
      <button class="btn primary block" data-act="send" ${sending ? 'disabled' : ''}>${sending ? 'Enviando…' : 'Enviar sugerencia'}</button>
    </section>

    ${mineList(mine)}
    `,
    bind(root) {
      const text = root.querySelector('[data-f=text]');
      const count = root.querySelector('[data-count]');
      text.addEventListener('input', () => { draft.text = text.value; count.textContent = `${text.value.length}/1500`; });
      root.querySelector('[data-f=contact]').addEventListener('input', (e) => { draft.contact = e.target.value; });
      root.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => { draft.category = b.dataset.cat; rerender(); }));
      root.querySelector('[data-act=refresh]')?.addEventListener('click', () => refreshStatuses(true));
      root.querySelector('[data-act=send]').addEventListener('click', async () => {
        const body = draft.text.trim();
        if (body.length < 10) { toast('Cuéntanos un poco más (mínimo 10 caracteres)'); return; }
        if (!navigator.onLine) { toast('Necesitas conexión a internet para enviar tu sugerencia'); return; }
        sending = true; rerender();
        try {
          const res = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              category: draft.category, text: body, contact: draft.contact.trim(),
              website: root.querySelector('[data-f=website]')?.value || '',
              version: APP_VERSION, goal: getState().profile.goal, platform: platform(),
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || 'No se pudo enviar. Inténtalo más tarde.');
          update((st) => { st.feedback = [...(st.feedback || []), { id: data.id, category: draft.category, text: body, at: Date.now() }].slice(-50); });
          draft.text = ''; draft.contact = '';
          toast('¡Gracias! Hemos recibido tu sugerencia ♥');
        } catch (err) {
          toast(err.message === 'Failed to fetch' ? 'Sin conexión con el servidor. Inténtalo más tarde.' : err.message, 4000);
        } finally {
          sending = false; rerender();
        }
      });
    },
  };
}
