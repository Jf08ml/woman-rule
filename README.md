# Lunara — PWA de seguimiento del ciclo menstrual

PWA instalable (Android, iOS 16.4+, escritorio) con funcionalidades equivalentes a las apps de seguimiento del ciclo tipo Flo, y **notificaciones push reales** que llegan aunque la app esté cerrada.

## Funcionalidades

| Área | Qué incluye |
|---|---|
| **Hoy** | Anillo del ciclo (periodo, ventana fértil, ovulación, día actual), días hasta el periodo / retraso, probabilidad de embarazo, fase del ciclo con consejos, próximas fechas, tira semanal |
| **Calendario** | Periodos registrados, previstos (3 ciclos), ventana fértil y ovulación; edición de fechas con autocompletado de la duración del periodo |
| **Registro diario** | Periodo + intensidad, 18 síntomas, 12 estados de ánimo, flujo vaginal, actividad sexual, píldora, pruebas de ovulación y embarazo, temperatura basal, peso, sueño, agua, notas |
| **Análisis** | Ciclo y periodo promedio, regularidad, historial de ciclos, síntomas y ánimo frecuentes, gráficas de temperatura basal y peso, alertas para comentar con el médico, resumen para compartir |
| **Perfil de salud** | Método anticonceptivo (calendario de blíster/parche/anillo, inyección, implante y DIU; sin ventana fértil con métodos hormonales), actividad sexual, edad, estatura y peso (IMC), regularidad, situación (lactancia, posparto, perimenopausia, tras dejar la píldora), condiciones (SOP, endometriosis, tiroides…). Ajusta predicciones (rangos en ciclos irregulares), avisos y consejos |
| **Objetivos** | Seguir el ciclo · Buscar embarazo · **Modo embarazo** (semana, trimestre, tamaño del bebé, fecha probable de parto) |
| **Notificaciones** | Periodo próximo (N días antes), inicio del periodo, retraso, ventana fértil, ovulación, anticonceptivo (tomas del blíster, descanso, cambio de parche/anillo, inyección, revisión del dispositivo), registrar síntomas, temperatura basal, agua (4 horas), embarazo semana a semana, **modo discreto**, botones de prueba |
| **Mejoras** | Buzón de sugerencias en Perfil → Mejoras; cada usuaria ve el estado y la respuesta de las suyas. Panel privado en `/admin.html` para responder y cambiar estados |
| **Privacidad** | Datos solo en el dispositivo (localStorage), bloqueo con PIN, exportar/importar copia JSON, borrar todo |
| **PWA** | Instalable, funciona sin conexión, atajos, tema claro/oscuro |

## Cómo funcionan las notificaciones

1. El cliente calcula la agenda de recordatorios (fechas/horas + texto) a partir de los datos locales.
2. Se suscribe a Web Push (VAPID) y envía **solo esa agenda** a `/api/sync`; los registros de salud nunca salen del dispositivo.
3. El servidor revisa la agenda cada 30 s y envía el push a su hora (los diarios, en la zona horaria del usuario).
4. Cada vez que cambian los datos, la agenda se vuelve a sincronizar.
5. **Respaldo sin servidor:** si el servidor no responde, el service worker usa Periodic Background Sync (Chrome/Android con la app instalada) y comprueba los recordatorios mientras la app está abierta.

> **iPhone/iPad:** las notificaciones push solo funcionan si la app se añade a la pantalla de inicio (Safari → Compartir → Añadir a inicio) y se abre desde allí (iOS 16.4 o posterior).

## Ejecutar

```bash
npm install
npm start            # http://localhost:3000
```

Las claves VAPID se generan solas la primera vez en `server/data/vapid.json`. Para regenerar los iconos: `npm run icons`.

### Despliegue en Vercel (plan Pro)

En Vercel la app usa funciones serverless (`api/`), **Upstash Redis** para guardar suscripciones y **Vercel Cron** cada minuto (`/api/tick`) para enviar los avisos. El cron por minuto requiere el plan Pro.

1. **Sube el proyecto** a GitHub e impórtalo en Vercel (*Add New → Project*). No hace falta configurar framework ni build: `vercel.json` ya lo define.
2. **Base de datos:** en el proyecto → *Storage* → *Upstash for Redis* (Marketplace) → crear y conectar. Esto añade `KV_REST_API_URL` y `KV_REST_API_TOKEN` (también valen `UPSTASH_REDIS_REST_URL`/`_TOKEN`).
3. **Claves:** ejecuta `npm run vapid` y copia el resultado en *Settings → Environment Variables* (entorno Production):
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (no las cambies después: invalidarían las suscripciones)
   - `VAPID_SUBJECT` = `mailto:tu-correo@dominio.com`
   - `CRON_SECRET` (Vercel lo envía al cron; protege `/api/tick`)
   - `FEEDBACK_ADMIN_KEY`: clave larga y secreta para entrar al panel de mejoras (`/admin.html`)
4. **Redespliega** para que tome las variables. Comprueba en *Settings → Cron Jobs* que aparece `/api/tick` cada minuto.
5. Abre la URL en el móvil, actívalas en *Perfil → Notificaciones* y pulsa **Probar push (10 s)**.

Con la CLI: `npm i -g vercel`, `vercel link`, `vercel env add …`, `vercel --prod`.

### Otros hostings (proceso persistente)

Web Push requiere **HTTPS** (salvo en `localhost`). `npm start` funciona en Render, Railway, Fly.io o un VPS con Caddy/Nginx. Variables:

| Variable | Uso |
|---|---|
| `PORT` | Puerto (por defecto 3000) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Claves fijas (recomendado; si cambian, las suscripciones existentes dejan de valer) |
| `VAPID_SUBJECT` | `mailto:tu-correo@dominio.com` de contacto |
| `FEEDBACK_ADMIN_KEY` | Clave del panel de mejoras (`/admin.html`). Si no se define, se genera en `DATA_DIR/admin-key.txt` y se muestra al arrancar |
| `DATA_DIR` | Carpeta persistente para `db.json` (suscripciones y agenda) |

Para probar en el móvil durante el desarrollo puedes usar un túnel HTTPS (p. ej. `cloudflared tunnel --url http://localhost:3000`).

## Estructura

```
lib/push-core.js        Lógica push compartida (sync, tick, pruebas)
lib/stores.js           Almacenamiento: archivo JSON (local) o Upstash Redis (Vercel)
lib/feedback.js         Buzón de mejoras: validación, límite de envíos y gestión (archivo o Redis)
public/admin.html       Panel privado para gestionar las sugerencias
api/*.js                Funciones serverless de Vercel (+ cron /api/tick)
vercel.json             Salida estática, cron cada minuto y cabeceras
server/server.js        Servidor Express local (mismo núcleo, planificador cada 30 s)
public/index.html       Shell de la app
public/sw.js            Service worker: offline, push, clic en notificación, respaldo local
public/js/cycle.js      Motor de predicción (media ponderada de los últimos 6 ciclos, fase lútea configurable, rangos si es irregular)
public/js/health.js     Perfil de salud: método anticonceptivo y su calendario, IMC, alertas y consejos personalizados
public/js/reminders.js  Construcción de la agenda de notificaciones
public/js/push.js       Suscripción, sincronización y pruebas de notificaciones
public/js/views/*       Pantallas: hoy, calendario, registro, análisis, perfil, onboarding, PIN
scripts/gen-icons.js    Generador de iconos PNG sin dependencias
```

## Aviso

Las predicciones son estimaciones y no sustituyen el consejo médico ni un método anticonceptivo.
