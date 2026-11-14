// Guía de uso: explica cada parte de la app en secciones desplegables.
import { getState, update } from '../store.js';
import { icon, badge } from '../icons.js';

const S = [
  {
    id: 'start', ic: 'sparkles', title: 'Primeros pasos',
    body: `
      <p>Lo más importante es <b>registrar cuándo empieza tu periodo</b>. Con eso Lunara calcula tus próximas fechas.</p>
      <ol class="guide-steps">
        <li>El día que te baje, ve a <b>Hoy</b> y toca <b>“Mi periodo empezó hoy”</b>.</li>
        <li>¿Fue otro día? Ve a <b>Calendario → Editar fechas del periodo</b> y toca el primer día. Se completan solos los días siguientes según tu duración habitual; toca un día marcado para quitarlo.</li>
        <li>Si recuerdas periodos anteriores, márcalos también: cuantos más registres, mejores serán las predicciones.</li>
      </ol>`,
  },
  {
    id: 'today', ic: 'moon', title: 'La pantalla Hoy',
    body: `
      <ul class="tips">
        <li><b>El anillo</b> muestra tu ciclo completo. El punto marca el día de hoy y el centro te dice cuánto falta para tu periodo.</li>
        <li><b>Probabilidad de embarazo</b> (baja, media o alta) según la fase en la que estás.</li>
        <li><b>La semana</b> de arriba te deja abrir el registro de cualquier día cercano.</li>
        <li><b>Próximas fechas</b>: siguiente periodo, ventana fértil y ovulación.</li>
        <li><b>Tu fase</b> con una breve explicación y consejos para esos días.</li>
      </ul>`,
  },
  {
    id: 'log', ic: 'notebook-pen', title: 'Registrar tu día',
    body: `
      <p>Toca el botón <span class="guide-plus">${icon('plus')}</span> del centro de la barra inferior. Puedes anotar:</p>
      <ul class="tips">
        <li>Periodo e intensidad del flujo.</li>
        <li>Síntomas y estado de ánimo (puedes elegir varios).</li>
        <li>Flujo vaginal, pruebas de ovulación y de embarazo.</li>
        <li><b>Hicimos el amor</b> ${icon('heart', 'fill guide-heart')} y, si quieres, si fue con o sin protección.</li>
        <li>Píldora anticonceptiva, temperatura basal, peso, sueño, agua y notas.</li>
      </ul>
      <p class="muted small">Todo se guarda al instante, no hay que pulsar “Guardar”. Usa las flechas de arriba para cambiar de día; también puedes completar días pasados.</p>`,
  },
  {
    id: 'calendar', ic: 'calendar', title: 'El calendario',
    body: `
      <div class="guide-legend">
        <span><i class="lg lg-period"></i>Días de periodo registrados</span>
        <span><i class="lg lg-predicted"></i>Periodo previsto</span>
        <span><i class="lg lg-fertile"></i>Ventana fértil</span>
        <span><i class="lg lg-ovulation"></i>Ovulación estimada</span>
        <span class="lg-love">${icon('heart', 'fill')}Hicieron el amor ese día</span>
        <span><i class="lg lg-dot"></i>Día con algo registrado</span>
      </div>
      <p>Toca cualquier día para ver su resumen debajo del calendario y editarlo. Cambia de mes con las flechas y vuelve al día actual con <b>Hoy</b>.</p>`,
  },
  {
    id: 'predict', ic: 'target', title: 'Cómo se calculan las predicciones',
    body: `
      <ul class="tips">
        <li>Con <b>2 o más periodos</b> registrados, Lunara usa el promedio real de tus ciclos. Antes de eso usa los datos de tu perfil.</li>
        <li>La <b>ovulación</b> se estima unos 14 días antes del siguiente periodo (tu fase lútea, ajustable en Perfil).</li>
        <li>La <b>ventana fértil</b> va de 5 días antes de la ovulación hasta 1 día después.</li>
        <li>La temperatura basal y las pruebas de ovulación te ayudan a confirmar lo que pasa en tu cuerpo.</li>
      </ul>
      <p class="status warn">${icon('triangle-alert')} Son estimaciones: no uses Lunara como método anticonceptivo.</p>`,
  },
  {
    id: 'insights', ic: 'activity', title: 'Análisis',
    body: `
      <ul class="tips">
        <li>Duración media de tu ciclo y de tu periodo, y si tus ciclos son regulares.</li>
        <li>Historial de tus últimos ciclos, síntomas y ánimos más frecuentes.</li>
        <li>Gráficas de temperatura basal y peso.</li>
        <li>Avisos “Para comentar con tu médico” si algo se sale de lo habitual.</li>
        <li><b>Compartir resumen para mi médico</b>: genera un texto con tus datos para enviarlo o llevarlo a consulta.</li>
      </ul>`,
  },
  {
    id: 'reminders', ic: 'bell', title: 'Recordatorios',
    body: `
      <p>En <b>Perfil → Notificaciones</b> activa los avisos y elige cuáles quieres: periodo próximo, retraso, ventana fértil, ovulación, píldora, agua, temperatura o registrar tu día.</p>
      <ul class="tips">
        <li>Usa <b>“Probar notificación”</b> para comprobar que te llegan.</li>
        <li>El <b>modo discreto</b> oculta el contenido: solo verás “Tienes un recordatorio nuevo”.</li>
        <li>En iPhone primero debes instalar la app en la pantalla de inicio.</li>
      </ul>`,
  },
  {
    id: 'goals', ic: 'flower-2', title: 'Tu objetivo',
    body: `
      <p>En <b>Perfil → Mi objetivo</b> puedes cambiar en cualquier momento:</p>
      <ul class="tips">
        <li><b>Seguir mi ciclo</b>: predicciones del periodo y de tus días fértiles.</li>
        <li><b>Quedar embarazada</b>: lo mismo, poniendo el foco en tu ventana fértil.</li>
        <li><b>Estoy embarazada</b>: indica la fecha de tu última regla y verás la semana de embarazo, el tamaño del bebé y la fecha probable de parto.</li>
      </ul>`,
  },
  {
    id: 'privacy', ic: 'lock', title: 'Privacidad y copias de seguridad',
    body: `
      <ul class="tips">
        <li>Tus registros se guardan <b>solo en este dispositivo</b>. No hay cuentas ni contraseñas.</li>
        <li>Protege la app con un <b>PIN</b> en Perfil → Privacidad. Se vuelve a pedir si sales más de un minuto.</li>
        <li>Si borras los datos del navegador o cambias de móvil, tus registros se pierden. Usa <b>Perfil → Mis datos → Exportar copia</b> de vez en cuando y, en el nuevo dispositivo, <b>Importar copia</b>.</li>
      </ul>`,
  },
  {
    id: 'install', ic: 'smartphone', title: 'Instalar la app',
    body: `
      <ul class="tips">
        <li><b>Android / Chrome</b>: toca “Instalar app” en Hoy o en el menú ⋮ → “Instalar aplicación”.</li>
        <li><b>iPhone / iPad</b>: en Safari toca Compartir ${icon('share')} → “Añadir a pantalla de inicio”.</li>
        <li>Una vez instalada funciona sin conexión y puede enviarte notificaciones.</li>
      </ul>`,
  },
];

export function render(params = []) {
  const open = params[0];
  return {
    html: `
    <header class="topbar">
      <a class="icon-btn" href="#/settings" data-act="back" aria-label="Volver">${icon('chevron-left')}</a>
      <div class="center"><p class="eyebrow">Ayuda</p><h1 class="h-sm">Guía de uso</h1></div>
      <span class="icon-btn ghost"></span>
    </header>
    <section class="card accent guide-intro">
      ${badge('book-open')}
      <p>Todo lo que necesitas para sacarle partido a Lunara. Toca un tema para desplegarlo.</p>
    </section>
    <div class="guide">
      ${S.map((x) => `
      <details class="card guide-item" id="g-${x.id}" ${open === x.id ? 'open' : ''}>
        <summary>${badge(x.ic)}<span>${x.title}</span>${icon('chevron-right', 'guide-chev')}</summary>
        <div class="guide-body">${x.body}</div>
      </details>`).join('')}
    </div>
    <div class="center-actions"><a class="btn primary" href="#/today">Empezar a usar Lunara</a></div>
    <p class="disclaimer">Lunara no sustituye el consejo médico. Si algo te preocupa, consulta con un profesional de salud.</p>
    `,
    bind(root) {
      if (!getState().settings.guideSeen) setTimeout(() => update((s) => { s.settings.guideSeen = true; }), 0);
      root.querySelector('[data-act=back]').addEventListener('click', (e) => {
        if (history.length > 1) { e.preventDefault(); history.back(); }
      });
      // Solo una sección abierta a la vez para que la lectura sea cómoda
      root.querySelectorAll('.guide-item').forEach((d) => d.addEventListener('toggle', () => {
        if (!d.open) return;
        root.querySelectorAll('.guide-item[open]').forEach((o) => { if (o !== d) o.open = false; });
      }));
    },
  };
}
