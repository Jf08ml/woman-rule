import { icon } from './icons.js';

export const esc =(s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/** Abre un diálogo modal. bind(root, close) recibe el contenedor. */
export function modal(html, bind, onClose) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    wrap.classList.remove('open'); setTimeout(() => wrap.remove(), 200); onClose?.();
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));
  bind?.(wrap.querySelector('.modal'), close);
  return close;
}

export function confirmDialog(message, okText = 'Aceptar', danger = false) {
  return new Promise((resolve) => {
    let result = false;
    modal(`
      <p class="modal-text">${esc(message)}</p>
      <div class="row-end">
        <button class="btn ghost" data-close>Cancelar</button>
        <button class="btn ${danger ? 'danger' : 'primary'}" data-act="yes">${esc(okText)}</button>
      </div>`, (root, close) => {
      root.querySelector('[data-act=yes]').onclick = () => { result = true; close(); };
    }, () => resolve(result));
  });
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function chips(list, selected, name, multi = true) {
  const sel = new Set(Array.isArray(selected) ? selected : selected ? [selected] : []);
  return `<div class="chips" data-name="${name}" data-multi="${multi}">${list.map((o) =>
    `<button type="button" class="chip ${sel.has(o.id) ? 'on' : ''}" data-id="${o.id}" aria-pressed="${sel.has(o.id)}"><span class="chip-ic">${icon(o.icon).repeat(o.n || 1)}</span>${esc(o.label)}</button>`).join('')}</div>`;
}
