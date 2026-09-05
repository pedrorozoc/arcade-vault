# 03 — Página «Acerca de» y formulario de contacto con Resend

**Estado:** Implementado
**Depende de:** SPEC 01, SPEC 02
**Fecha:** 2026-09-05

**Objetivo:** Crear la ruta `/acerca-de` portada de `references/resources/templates/home-about/about.jsx` y su CSS, con un formulario de contacto que envía el mensaje por correo mediante un Route Handler `app/api/contact/route.ts` que usa el servicio Resend.

## Por qué este spec existe

El SPEC 02 portó la landing del template `home-about` a `/` pero dejó fuera, de forma explícita, la parte «Acerca de» (`about.jsx` y el bloque `/* ===== ABOUT PAGE ===== */` de `styles.css`). Este spec cierra esa parte pendiente. A diferencia del resto del proyecto —que hasta ahora es 100% cliente con datos ficticios—, el formulario de contacto sí necesita servidor: una llamada real a la API de Resend para enviar el correo. Es la primera pieza de backend del proyecto (`app/api/`), por eso se acota al mínimo.

## Alcance

**Dentro:**

- Nueva ruta `app/acerca-de/page.tsx`, client component portado de `references/resources/templates/home-about/about.jsx`: sección `about-hero` (kicker, título, misión, `highlight-row` con 3 `HighlightIcon` — `HEART`, `BROWSER`, `PLANT`—), banner `about-divider` (24 píxeles), y sección `about-contact` con `contact-intro` (kicker, título, subtítulo, 3 `contact-tips`) y `contact-form`.
- El hook reveal-on-scroll con `IntersectionObserver` dentro de `useEffect` (mismo patrón que la landing del SPEC 02) para los elementos `.reveal` de esta página.
- Estado del formulario con `useState`: `{ name, email, msg }`, más el honeypot `company` y estados `status` (`idle` | `sending` | `sent` | `error`) y `shake`.
- Validación en cliente igual que el template: si `name`, `email` o `msg` están vacíos (tras `trim`), dispara la animación `shake` 400 ms y no envía.
- Envío: `fetch("/api/contact", { method: "POST", body: JSON.stringify(payload) })`. Mientras `status === "sending"` el botón se deshabilita y muestra texto de progreso.
- Pantalla de éxito `terminal-success` del template (líneas `[OK]` + `> MENSAJE RECIBIDO…` con el nombre en mayúsculas) cuando la respuesta es `200`, con botón «ENVIAR OTRO MENSAJE» que resetea el formulario a `idle`.
- Estado de error visible cuando la respuesta no es `2xx` o el `fetch` rechaza: bloque con estética de terminal que muestra una línea `[ERROR]` en rojo y un botón «REINTENTAR»; el formulario conserva `name`, `email` y `msg` para reintentar.
- Route Handler `app/api/contact/route.ts` con `export async function POST(request: Request)`:
  - Lee el JSON del body.
  - Descarta silenciosamente (responde `200 { ok: true }` sin enviar) si el honeypot `company` viene con contenido.
  - Revalida en servidor: `name`, `email`, `msg` presentes y no vacíos tras `trim`; `email` con formato válido; longitudes máximas (`name` ≤ 100, `email` ≤ 150, `msg` ≤ 5000). Si falla, responde `400 { ok: false, error }`.
  - Llama a Resend con `from: "onboarding@resend.dev"`, `to: process.env.CONTACT_TO_EMAIL`, `replyTo:` el email del formulario, `subject: "Arcade Vault — Mensaje de {name}"`, y cuerpo `html` con maquetación básica de los tres campos.
  - Si Resend responde con error o falta `RESEND_API_KEY` / `CONTACT_TO_EMAIL`, responde `500 { ok: false, error }`. En éxito, `200 { ok: true }`.
- `lib/contact.ts`: tipo `ContactPayload` y función `validateContact(payload): string | null` (devuelve el mensaje de error o `null`), compartida por el cliente y el Route Handler para no duplicar reglas.
- Dependencia nueva: `resend` (npm), instanciada dentro del Route Handler.
- Config de entorno: `.env.local` (ignorado por git) con `RESEND_API_KEY` y `CONTACT_TO_EMAIL=pedro.rozo@gmail.com`; `.env.template` **versionado** con las mismas claves y valores de ejemplo vacíos; añadir `!.env.template` a `.gitignore` (que hoy ignora `.env*`).
- Portar a `app/globals.css` el bloque `/* ===== ABOUT PAGE ===== */` de `styles.css` (líneas 1071–1149, hasta antes de `/* ===== GAMEPAD ===== */`): `.about*`, `.highlight*`, `.about-divider`, `.div-*`, `@keyframes pxblink`, `.about-contact`, `.contact-*`, `.btn.press`, `.terminal-success`, `.term-*`. Reutilizar el `@keyframes blink` ya existente en `globals.css` (línea 288) y **no** volver a portar `.divider` (ya está en la línea 941, idéntico).
- Actualizar `components/Nav.tsx`: añadir enlace «Acerca de» → `/acerca-de` como último de la lista (después de «Salón de la Fama»), tanto en `.links` como en el panel móvil; extender el tipo `NavSection` con `"acerca-de"` y `isActive` para que se resalte cuando `pathname === "/acerca-de"`.

**Fuera:**

- Rate limiting, CAPTCHA o cualquier anti-abuso más allá del honeypot y la validación de servidor.
- Persistir los mensajes enviados (base de datos, log, `localStorage`).
- Página de administración o bandeja de entrada dentro de la app para leer los mensajes.
- Verificación de un dominio propio en Resend y remitente personalizado: se usa `onboarding@resend.dev` (Resend solo entrega al correo de la cuenta en ese modo).
- Correo de auto-respuesta o confirmación al visitante que rellena el formulario.
- Plantilla de correo elaborada (React Email, imágenes, branding): el cuerpo es HTML mínimo inline.
- Tests automatizados (no hay test runner en el proyecto).
- Internacionalización: la página está solo en español.

## Modelo de datos

Este spec no introduce estructuras persistidas. Define un único tipo de transporte para la petición del formulario, en `lib/contact.ts`:

```ts
export interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  company?: string; // honeypot: siempre vacío en envíos legítimos
}

// Devuelve el primer mensaje de error de validación, o null si el payload es válido.
export function validateContact(payload: Partial<ContactPayload>): string | null;
```

Respuesta del Route Handler (JSON):

```ts
// 200
{ ok: true }
// 400 (validación) | 500 (Resend o env faltante)
{ ok: false, error: string }
```

Variables de entorno (no versionadas salvo `.env.template`):

- `RESEND_API_KEY` — API key de Resend.
- `CONTACT_TO_EMAIL` — destinatario de los mensajes (`pedro.rozo@gmail.com`).

## Plan de implementación

1. Instalar la dependencia: `npm install resend`. Crear `.env.local` con `RESEND_API_KEY=` (valor real, local) y `CONTACT_TO_EMAIL=pedro.rozo@gmail.com`. Crear `.env.template` con ambas claves y valores vacíos. Añadir la línea `!.env.template` a `.gitignore`. Prueba: `git status` muestra `.env.template` como archivo a añadir y **no** muestra `.env.local`.
2. Crear `lib/contact.ts` con `ContactPayload` y `validateContact` (campos presentes y no vacíos tras `trim`, formato de email por regex simple, longitudes máximas 100 / 150 / 5000). Prueba: `npm run build` compila.
3. Portar el bloque CSS `/* ===== ABOUT PAGE ===== */` (líneas 1071–1149 de `references/resources/templates/home-about/styles.css`) al final de `app/globals.css`. Omitir la regla `.divider` (ya presente en la línea 941) y no redefinir `@keyframes blink`. Conservar `@keyframes pxblink` y `@keyframes shake` (no existen aún en `globals.css`; verificar antes de pegar). Prueba: `npm run build` compila; no hay `@keyframes` ni selectores duplicados nuevos respecto a los ya presentes.
4. Crear `app/api/contact/route.ts` con el `POST`: parseo del body, cortocircuito del honeypot (`company` con contenido → `200 { ok: true }`), `validateContact` en servidor (fallo → `400`), comprobación de `RESEND_API_KEY` y `CONTACT_TO_EMAIL` (falta alguna → `500`), llamada a `new Resend(key).emails.send({...})` con `from`, `to`, `replyTo`, `subject` y `html`, y mapeo de resultado a `200` / `500`. Prueba: `curl -X POST localhost:3000/api/contact -H 'content-type: application/json' -d '{"name":"Kai","email":"kai@vault.gg","msg":"hola"}'` devuelve `{"ok":true}` y llega un correo a `CONTACT_TO_EMAIL`; un body sin `msg` devuelve `400`; un body con `company:"x"` devuelve `{"ok":true}` y **no** envía correo.
5. Crear `app/acerca-de/page.tsx` (`"use client"`) portando `about.jsx`: `useEffect` con `IntersectionObserver` para `.reveal`, sub-componente `HighlightIcon` con los tres SVG (`HEART`, `BROWSER`, `PLANT`), y el JSX de `about-hero`, `about-divider` y `about-contact`. El formulario usa `useState` para `{ name, email, msg, company }`, `status` y `shake`; `onSubmit` valida en cliente (vacíos → `shake`), pone `status="sending"`, hace `fetch("/api/contact", …)`, y según la respuesta pasa a `"sent"` o `"error"`. Renderizado condicional: formulario (`idle`/`sending`/`error`, con el bloque de error y botón «REINTENTAR» cuando `status==="error"`) vs `terminal-success` (`sent`) con «ENVIAR OTRO MENSAJE» que vuelve a `idle` y limpia los campos. Prueba manual: `/acerca-de` renderiza las dos secciones sin warnings de hidratación; enviar el formulario con datos válidos muestra `terminal-success`.
6. Actualizar `components/Nav.tsx`: extender `NavSection` con `"acerca-de"`; añadir en `isActive` el caso `pathname === "/acerca-de"`; añadir `<Link href="/acerca-de">Acerca de</Link>` como último enlace en `.links` y en el panel móvil (antes del enlace de auth), con `onClick={close}` en el móvil. Prueba manual: el menú muestra, en orden, «Inicio», «Biblioteca», «Salón de la Fama», «Acerca de»; «Acerca de» se resalta solo en `/acerca-de`; el enlace también aparece en el menú móvil.
7. Verificación de punta a punta: `npm run lint`, `npm run build`, y prueba manual en el navegador — navegar a `/acerca-de` desde el Nav (desktop y móvil); enviar el formulario con datos válidos (éxito → `terminal-success`, llega el correo); enviar con un campo vacío (`shake`, no hay petición); forzar un fallo (p. ej. `RESEND_API_KEY` inválida) y comprobar el estado de error con «REINTENTAR» conservando los datos.

## Criterios de aceptación

- [x] `npm run lint` pasa sin errores.
- [x] `npm run build` compila sin errores.
- [x] `/acerca-de` muestra la sección «Acerca de» (kicker «▸ ACERCA DE», título «ACERCA DE ARCADE VAULT», texto de misión, y la `highlight-row` con las 3 tarjetas con icono).
- [x] `/acerca-de` muestra el banner divisor con los píxeles animados.
- [x] `/acerca-de` muestra la sección «Contacto» con el texto intro, las 3 pistas (`contact-tips`) y el formulario (Nombre, Correo electrónico, Mensaje, botón «▶ ENVIAR MENSAJE»).
- [x] El efecto reveal-on-scroll anima `.about-divider` y `.about-contact` al entrar en el viewport.
- [x] Enviar el formulario con un campo vacío dispara la animación `shake` y **no** hace ninguna petición a `/api/contact`.
- [x] Enviar el formulario con nombre, email y mensaje válidos hace `POST /api/contact`, y al recibir `200` muestra la pantalla `terminal-success` con el nombre en mayúsculas.
- [x] Un envío válido entrega un correo a la dirección de `CONTACT_TO_EMAIL` con asunto «Arcade Vault — Mensaje de {nombre}» y `Reply-To` igual al email introducido.
- [x] El botón «ENVIAR OTRO MENSAJE» de la pantalla de éxito vuelve a mostrar el formulario vacío.
- [x] Si `/api/contact` responde con error o el `fetch` falla, se muestra el bloque de error con línea `[ERROR]` y botón «REINTENTAR», y los campos escritos se conservan.
- [x] `POST /api/contact` con el campo honeypot `company` no vacío responde `200 { ok: true }` y **no** envía correo.
- [x] `POST /api/contact` sin `name`, `email` o `msg` (o con email mal formado) responde `400 { ok: false, error }`.
- [x] `POST /api/contact` sin `RESEND_API_KEY` o sin `CONTACT_TO_EMAIL` configurada responde `500 { ok: false, error }` y no lanza una excepción sin capturar.
- [x] El Nav muestra, en orden: «Inicio», «Biblioteca», «Salón de la Fama», «Acerca de», en desktop y en el menú móvil.
- [x] «Acerca de» se resalta como activo solo en `/acerca-de`.
- [x] `.env.local` no aparece en `git status`; `.env.template` sí está versionado con las dos claves.
- [x] No hay warnings de hidratación en la consola al cargar `/acerca-de`.
- [x] La página está en español y usa el theme visual existente sin romper la paleta de `app/globals.css`.

## Decisiones tomadas y descartadas

- **Sí:** ruta `/acerca-de` — coherente con las rutas en español ya existentes (`/juego`, `/salon`, `/auth`). Descartado `/about` por romper esa convención.
- **Sí:** el envío se hace por un Route Handler `app/api/contact/route.ts` al que el formulario llama con `fetch` — patrón explícito, probable con `curl`, y desacopla el estado de éxito/error del template de la mecánica de red. Descartada una Server Action por acoplar el form a la action y complicar los cuatro estados (`idle`/`sending`/`sent`/`error`).
- **Sí:** remitente `onboarding@resend.dev` — funciona sin verificar dominio. Se asume que la cuenta de Resend pertenece a `pedro.rozo@gmail.com`, único destino al que Resend entrega en ese modo. Verificar un dominio propio queda fuera.
- **Sí:** destinatario en `CONTACT_TO_EMAIL` (env var), no hardcodeado — permite cambiarlo sin tocar código.
- **Sí:** honeypot `company` + revalidación en servidor como única defensa anti-spam — barato y suficiente para el volumen esperado. Descartado rate limiting y CAPTCHA (su propio spec si hace falta).
- **Sí:** cuerpo del correo en HTML simple inline con `Reply-To` al email del visitante — permite responder directo desde el cliente de correo. Descartado texto plano (menos legible) y plantillas con React Email (sobredimensionado).
- **Sí:** validación compartida en `lib/contact.ts` — una sola fuente de reglas para cliente y servidor.
- **No:** persistir los mensajes ni construir bandeja de entrada en la app — el correo es el canal; guardar historial es otro spec.
- **Sí:** `.env.template` versionado con excepción `!.env.template` en `.gitignore` — documenta las claves necesarias sin exponer secretos.
- **Sí:** la página es client component (`"use client"`) — usa `IntersectionObserver` y estado de formulario, mismo patrón que la landing del SPEC 02.
- **Orden del Nav:** «Acerca de» va al final — es la página menos transaccional y así lo coloca el template (`nav.jsx`).

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| Next.js 16.3.4 puede tener convenciones distintas para Route Handlers (`app/api/*/route.ts`), firma de `POST`, y lectura de `process.env` en servidor, respecto a lo conocido por entrenamiento. | Revisar `node_modules/next/dist/docs/01-app/` (route handlers y variables de entorno) antes de escribir `app/api/contact/route.ts`. Verificar con `curl` en el Paso 4. |
| El bloque CSS «ABOUT PAGE» del template puede redefinir `@keyframes` o selectores ya presentes en `app/globals.css` (`blink`, `.divider`, `.btn`, `.reveal`). | Antes de pegar, comparar contra `globals.css`; omitir `.divider` y reutilizar `@keyframes blink`; validar con `npm run build` y revisión visual. |
| `RESEND_API_KEY` ausente en el entorno haría fallar el `import`/instanciación de `Resend` y tumbaría la ruta con un 500 sin cuerpo útil. | El handler comprueba las env vars **antes** de instanciar `Resend` y responde `500 { ok: false, error }` de forma controlada; nunca instancia el cliente sin key. |
| `.gitignore` hoy ignora `.env*`, así que `.env.template` no se añadiría y `.env.local` podría colarse si se cambia la regla mal. | Añadir exactamente `!.env.template` tras la regla `.env*`; el criterio de aceptación verifica `git status`. |
| Resend en modo `onboarding@resend.dev` solo entrega al correo de la cuenta; si `CONTACT_TO_EMAIL` es otro, el envío «tiene éxito» pero no llega nada. | Documentado en Decisiones; `CONTACT_TO_EMAIL` se fija a `pedro.rozo@gmail.com`. Verificar recepción real en el Paso 4. |

## Lo que **no** entra en este spec

- Rate limiting, CAPTCHA o anti-abuso más allá del honeypot y la validación de servidor.
- Persistir los mensajes o construir una bandeja de entrada en la app.
- Verificar un dominio propio en Resend y usar un remitente personalizado.
- Correo de confirmación / auto-respuesta al visitante.
- Plantilla de correo elaborada (React Email, branding, imágenes).
- Tests automatizados e internacionalización.

Cada uno de esos, si llega, va en su propio spec.
