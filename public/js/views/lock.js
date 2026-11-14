import { getState } from '../store.js';
import { sha256, toast } from '../ui.js';

let entered = '';

export function render({ onUnlock }) {
  const dots = Array.from({ length: 6 }, (_, i) => `<i class="${i < entered.length ? 'on' : ''}"></i>`).join('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  return {
    html: `
    <div class="lock">
      <div class="ob-hero">🔒</div>
      <h1>Introduce tu PIN</h1>
      <div class="pin-dots">${dots}</div>
      <div class="keypad">${keys.map((k) => (k ? `<button type="button" data-k="${k}">${k}</button>` : '<span></span>')).join('')}</div>
      <button class="btn primary" data-act="ok">Desbloquear</button>
    </div>`,
    bind(root) {
      const redraw = () => window.dispatchEvent(new Event('rerender'));
      const tryUnlock = async () => {
        if ((await sha256(`lunara:${entered}`)) === getState().settings.pinHash) { entered = ''; onUnlock(); }
        else if (entered.length >= 6) { entered = ''; toast('PIN incorrecto'); redraw(); }
      };
      root.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', async () => {
        const k = b.dataset.k;
        if (k === '⌫') entered = entered.slice(0, -1);
        else if (entered.length < 6) entered += k;
        if (entered.length >= 4) await tryUnlock();
        redraw();
      }));
      root.querySelector('[data-act=ok]').addEventListener('click', async () => {
        if ((await sha256(`lunara:${entered}`)) === getState().settings.pinHash) { entered = ''; onUnlock(); }
        else { entered = ''; toast('PIN incorrecto'); redraw(); }
      });
    },
  };
}
