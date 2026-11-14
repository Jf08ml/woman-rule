// Iconos SVG (Lucide, licencia ISC) servidos desde un sprite local: funcionan sin conexión
// y toman el color del texto (currentColor). Regenerar el sprite: npm run icons
export const icon = (name, cls = '') =>
  `<svg class="i${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="/icons/sprite.svg#${name}"/></svg>`;

/** Icono dentro de un círculo de color (cabeceras, listas). */
export const badge = (name, tone = 'primary') => `<span class="ib ib-${tone}">${icon(name)}</span>`;
