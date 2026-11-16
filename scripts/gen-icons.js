// Genera el logo (SVG + PNG) y el sprite de iconos Lucide usados por la app.
// Uso: npm run icons   (requiere las devDependencies: sharp, lucide-static)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'icons');
fs.mkdirSync(OUT, { recursive: true });

// ---------- Logo ----------
// Luna creciente que acuna una gota: ciclo + periodo.
const GLYPH = (fill = '#fff', drop = 'url(#drop)') => `
  <mask id="moon"><rect width="512" height="512" fill="#fff"/><circle cx="306" cy="208" r="128" fill="#000"/></mask>
  <circle cx="242" cy="262" r="152" fill="${fill}" mask="url(#moon)"/>
  <path d="M318 166C318 166 272 222 272 263a46 46 0 0 0 92 0C364 222 318 166 318 166Z" fill="${drop}"/>`;
const DEFS = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#F6869F"/><stop offset=".55" stop-color="#DB4B76"/><stop offset="1" stop-color="#A9285D"/>
    </linearGradient>
    <radialGradient id="glow" cx=".28" cy=".2" r=".75">
      <stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="drop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FFE1E9"/><stop offset="1" stop-color="#FFFFFF"/>
    </linearGradient>
  </defs>`;
// Desplazamiento para centrar ópticamente el conjunto
const centered = (scale = 1, inner = GLYPH()) =>
  `<g transform="translate(256 256) scale(${scale}) translate(-240 -260)">${inner}</g>`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${DEFS}${body}</svg>`;
const LOGO_ROUNDED = svg(`<rect width="512" height="512" rx="116" fill="url(#bg)"/><rect width="512" height="512" rx="116" fill="url(#glow)"/>${centered(1)}`);
const LOGO_SQUARE = svg(`<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>${centered(1)}`);
const LOGO_MASKABLE = svg(`<rect width="512" height="512" fill="url(#bg)"/><rect width="512" height="512" fill="url(#glow)"/>${centered(0.78)}`);
const BADGE = svg(centered(1.3, GLYPH('#fff', '#fff')));

fs.writeFileSync(path.join(OUT, 'logo.svg'), LOGO_ROUNDED);
fs.writeFileSync(path.join(OUT, 'favicon.svg'), LOGO_ROUNDED);

const png = async (src, size, name) => {
  await sharp(Buffer.from(src), { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(OUT, name));
  console.log('Icono:', name);
};
await png(LOGO_ROUNDED, 192, 'icon-192.png');
await png(LOGO_ROUNDED, 512, 'icon-512.png');
await png(LOGO_MASKABLE, 512, 'maskable-512.png');
await png(LOGO_SQUARE, 180, 'apple-touch-icon.png');
await png(BADGE, 96, 'badge-96.png');

// ---------- Sprite de iconos (Lucide, licencia ISC) ----------
const ICONS = [
  // interfaz
  'calendar', 'calendar-days', 'bell', 'bell-ring', 'smartphone', 'download', 'monitor-down', 'chevron-left', 'chevron-right',
  'check', 'circle-check', 'pencil', 'lock', 'palette', 'database', 'share-2', 'copy', 'eye-off', 'wifi-off', 'zap', 'info',
  'triangle-alert', 'plus', 'minus', 'user', 'clipboard-list', 'notebook-pen', 'square-plus', 'ellipsis', 'ellipsis-vertical', 'menu', 'share', 'delete', 'circle-help', 'book-open',
  // ciclo y salud
  'droplet', 'droplets', 'dot', 'flower-2', 'sparkles', 'egg', 'baby', 'hourglass', 'thermometer', 'weight', 'bed', 'glass-water',
  'pill', 'moon', 'moon-star', 'heart', 'heart-pulse', 'test-tube-diagonal', 'sprout', 'target',
  // perfil de salud
  'syringe', 'stethoscope', 'milk', 'shield-check', 'scale', 'user-round',
  // síntomas y ánimo
  'brain', 'activity', 'wind', 'scan-face', 'bone', 'person-standing', 'battery-low', 'battery-full', 'waves', 'cookie', 'orbit',
  'flame', 'thumbs-up', 'smile', 'leaf', 'badge-check', 'heart-crack', 'shuffle', 'angry', 'cloud-lightning', 'frown', 'meh',
  'circle', 'circle-dot', 'cloud', 'shield', 'circle-dashed', 'circle-gauge', 'annoyed', 'feather', 'circle-slash',
];
const dir = path.join(ROOT, 'node_modules', 'lucide-static', 'icons');
const symbols = ICONS.map((name) => {
  const src = fs.readFileSync(path.join(dir, `${name}.svg`), 'utf8');
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/\s+/g, ' ').trim();
  return `<symbol id="${name}" viewBox="0 0 24 24">${inner}</symbol>`;
});
fs.writeFileSync(path.join(OUT, 'sprite.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg"><!-- Lucide icons (ISC License) https://lucide.dev -->${symbols.join('')}</svg>\n`);
console.log(`Sprite: ${ICONS.length} iconos`);
