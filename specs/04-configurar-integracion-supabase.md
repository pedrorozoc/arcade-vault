# 04 — Configurar la integración de Supabase

**Estado:** Aprobado
**Depende de:** —
**Fecha:** 2026-09-06

**Objetivo:** Dejar lista la integración de Supabase en el proyecto (paquetes, variables de entorno, clientes de navegador y servidor con `@supabase/ssr`, refresco de sesión en `proxy.ts` y un endpoint de diagnóstico), sin migraciones ni cambios de funcionalidad.

## Por qué este spec existe

Los próximos specs van a usar Supabase para base de datos, autenticación real, realtime y edge functions. En vez de mezclar el andamiaje del cliente con la primera feature que lo necesite, este spec aísla la configuración: instala los paquetes, fija el contrato de variables de entorno y deja los clientes y el refresco de sesión listos para importar. El `.mcp.json` del repo ya apunta al proyecto `gwexvaisrpgtkroxgqvk`; falta el lado de la aplicación. No se toca la autenticación mock (`av_user` en `localStorage`, SPEC 01): convivirá hasta que un spec de Auth la reemplace.

## Alcance

**Dentro:**

- Dependencias nuevas (`npm install`): `@supabase/supabase-js` y `@supabase/ssr`.
- `lib/supabase/client.ts`: factoría `createClient()` para componentes de cliente, con `createBrowserClient` de `@supabase/ssr`, leyendo `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `lib/supabase/server.ts`: factoría `async createClient()` para Server Components, Route Handlers y Server Actions, con `createServerClient` de `@supabase/ssr` y el `cookies()` de `next/headers` (asíncrono en Next.js 16); el adaptador de cookies implementa `getAll`/`setAll`, con `try/catch` en `setAll` para el caso de invocación desde un Server Component (documentado por Supabase).
- `lib/supabase/proxy.ts`: helper `updateSession(request: NextRequest): Promise<NextResponse>` que crea un cliente de servidor ligado a las cookies de request/response, llama a `supabase.auth.getClaims()` para revalidar y refrescar el token, y devuelve la `NextResponse` con las cookies actualizadas. Sin lógica de protección ni redirección de rutas.
- `proxy.ts` en la raíz del repo: exporta `proxy` (no `middleware` — renombrado en Next.js 16) que delega en `updateSession`, más un `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` y archivos de imagen.
- `app/api/health/supabase/route.ts`: Route Handler `GET` permanente y mínimo. Comprueba que ambas variables de entorno están presentes y no vacías, hace un `fetch` a `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health` con la publishable key en la cabecera `apikey`, y responde `200 { ok: true }` si ese endpoint responde `200`, o `503 { ok: false, error }` en cualquier otro caso. Nunca lanza una excepción sin capturar. `export const dynamic = "force-dynamic"`.
- `.env.template` (versionado): añadir `NEXT_PUBLIC_SUPABASE_URL=""` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""` bajo las claves de Resend ya presentes.
- `.env.local` (ignorado por git): crear/actualizar con las dos claves. En esta iteración pueden ir con valores placeholder; los valores reales del proyecto `gwexvaisrpgtkroxgqvk` se rellenan cuando estén disponibles.

**Fuera:**

- Cualquier tabla, esquema, migración SQL, trigger, política RLS o `apply_migration` — no se toca la base de datos.
- Sustituir o modificar la autenticación mock (`lib/scores.ts`, `components/Nav.tsx`, `app/auth/page.tsx`): sigue en `localStorage` tal cual.
- Pantallas de login/registro reales, providers OAuth, magic links, modo invitado con `signInAnonymously`.
- Realtime, Storage, Edge Functions, Broadcast, Presence.
- Tipos de TypeScript de la base de datos (`Database`): se difieren al primer spec que cree una tabla; los clientes se tipan sin genérico por ahora.
- `SUPABASE_SECRET_KEY` / service_role: se añade en el spec que necesite acceso privilegiado desde servidor.
- Protección de rutas, gating por rol o redirecciones en `proxy.ts`.
- Cambiar `.gitignore` (ya cubre `.env*` con excepción `!.env.template` desde el SPEC 03).
- Nota de configuración en `README.md`: el `.env.template` documenta las claves.
- Tests automatizados (no hay runner en el proyecto).

## Modelo de datos

Este spec no introduce estructuras persistidas ni claves de `localStorage`. Define tres contratos:

Variables de entorno (no versionadas salvo `.env.template`):

- `NEXT_PUBLIC_SUPABASE_URL` — URL del proyecto (`https://gwexvaisrpgtkroxgqvk.supabase.co`).
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — publishable key (reemplaza a la `anon key`); segura para el cliente.

Respuesta del Route Handler de diagnóstico (JSON):

```ts
// 200
{ ok: true }
// 503
{ ok: false, error: string }
```

Firmas de los helpers:

```ts
// lib/supabase/client.ts
export function createClient(): SupabaseClient;

// lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>;

// lib/supabase/proxy.ts
export async function updateSession(
  request: NextRequest
): Promise<NextResponse>;
```

## Plan de implementación

1. `npm install @supabase/supabase-js @supabase/ssr`. Prueba: aparecen en `dependencies` de `package.json` y `npm run build` sigue compilando.
2. Añadir a `.env.template` las líneas `NEXT_PUBLIC_SUPABASE_URL=""` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""`. Crear/actualizar `.env.local` con las dos claves (valores placeholder por ahora si no hay credenciales). Prueba: `git status` muestra `.env.template` modificado y **no** muestra `.env.local`.
3. Crear `lib/supabase/client.ts` con `createClient()` usando `createBrowserClient` de `@supabase/ssr` y las dos env vars. Prueba: `npm run build` compila; `import { createClient } from "@/lib/supabase/client"` resuelve.
4. Crear `lib/supabase/server.ts` con `async createClient()` usando `createServerClient`, `cookies()` de `next/headers` (con `await`), y el adaptador `getAll`/`setAll` con `try/catch` en `setAll`. Revisar antes `node_modules/next/dist/docs/01-app/` (cookies, `next/headers`) para confirmar la firma asíncrona. Prueba: `npm run build` compila.
5. Crear `lib/supabase/proxy.ts` con `updateSession(request)`: construye `NextResponse.next({ request })`, crea el cliente de servidor ligado a `request.cookies` / la respuesta, llama a `await supabase.auth.getClaims()` y devuelve la `response` con las cookies propagadas. Prueba: `npm run build` compila.
6. Crear `proxy.ts` en la raíz: `export async function proxy(request: NextRequest) { return updateSession(request); }` más `export const config = { matcher: [...] }` que excluye estáticos e imágenes. Revisar antes `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` para el nombre de export y el runtime. Prueba: `npm run dev` arranca sin avisos sobre `middleware`; navegar a `/` funciona y los assets estáticos cargan (matcher correcto).
7. Crear `app/api/health/supabase/route.ts` con `GET`: valida env vars, `fetch` a `/auth/v1/health`, mapea a `200 { ok: true }` / `503 { ok: false, error }`, todo en `try/catch`. `export const dynamic = "force-dynamic"`. Prueba: `curl -i localhost:3000/api/health/supabase` con placeholders devuelve `503 { "ok": false, ... }` sin traza de error en consola; con credenciales reales devuelve `200 { "ok": true }`.
8. Verificación de punta a punta: `npm run lint`, `npm run build`, `npm run dev` y las pruebas manuales de los pasos 6 y 7. Dejar constancia (en el PR) de que el `200 { ok: true }` queda pendiente de credenciales reales.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` compila sin errores.
- [ ] `@supabase/supabase-js` y `@supabase/ssr` están en `dependencies` de `package.json`.
- [ ] `.env.template` (versionado) contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con valores vacíos.
- [ ] `.env.local` no aparece en `git status`.
- [ ] `lib/supabase/client.ts` exporta `createClient()` y se puede importar desde un client component sin error de build.
- [ ] `lib/supabase/server.ts` exporta `async createClient()` que hace `await cookies()` y se puede importar desde un Route Handler o Server Component.
- [ ] `lib/supabase/proxy.ts` exporta `updateSession(request)` que devuelve una `NextResponse`.
- [ ] Existe `proxy.ts` en la raíz con un export `proxy` (no `middleware`) y un `config.matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes.
- [ ] Con `npm run dev`, cargar `/` sirve el HTML y los assets estáticos (CSS/JS/imágenes) sin bloqueo por el proxy.
- [ ] `GET /api/health/supabase` con variables de entorno ausentes o con placeholder responde `503 { ok: false, error }` y **no** lanza una excepción sin capturar.
- [ ] `GET /api/health/supabase` con credenciales reales del proyecto responde `200 { ok: true }`. _(Pendiente hasta disponer de credenciales; ver Riesgos.)_
- [ ] No se ha creado ninguna tabla, migración ni política en Supabase.
- [ ] La autenticación mock (`av_user` en `localStorage`) sigue funcionando igual: login, logout y nombre en el Nav.
- [ ] No hay warnings de hidratación nuevos en `/`, `/juego`, `/salon`, `/auth` ni `/acerca-de`.

## Decisiones tomadas y descartadas

- **Sí:** `@supabase/ssr` (`createBrowserClient` + `createServerClient`) desde el principio, aunque este spec no consuma la sesión — los specs de Auth y de datos con RSC lo necesitan, y evita reestructurar `lib/supabase/` después. Descartado `@supabase/supabase-js` a secas.
- **No:** `@supabase/auth-helpers-nextjs` — está deprecado en favor de `@supabase/ssr`.
- **Sí:** archivo `proxy.ts` con export `proxy`, no `middleware.ts` — Next.js 16 renombró la convención (`middleware` está deprecado). El helper de sesión vive en `lib/supabase/proxy.ts` en vez del `lib/supabase/middleware.ts` que muestra la guía de Supabase, para no arrastrar el nombre viejo.
- **Sí:** `proxy.ts` solo refresca la sesión, sin matcher restrictivo por rol ni gating — no hay nada que proteger todavía; el spec de Auth añadirá esa lógica.
- **Sí:** publishable key (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), no `anon key` — es la nomenclatura vigente de Supabase; funcionalmente equivalente para el cliente. Se estandariza en la nueva.
- **No:** `SUPABASE_SECRET_KEY` / service_role en este spec — no se hace nada privilegiado desde servidor; añadirla ahora es exponer un secreto sin uso. Va en el spec que la necesite.
- **Sí:** endpoint de diagnóstico permanente `GET /api/health/supabase` que pega a `/auth/v1/health` — prueba real de URL + key sin depender de que exista esquema, y sirve como healthcheck de despliegue. Descartado un check con `auth.getUser()` (devuelve error cuando no hay sesión, ruido) y descartado un script de un solo uso (no deja nada verificable en el repo).
- **Sí:** `503` cuando la salud es `ok: false` — semántica correcta de healthcheck para orquestadores; `200` solo cuando Supabase responde.
- **No:** tipos `Database` ni `SupabaseClient<Database>` — no hay esquema; el primer spec de tabla generará `lib/supabase/database.types.ts` y retipará los clientes.
- **No:** tocar la auth mock ni `.gitignore` — fuera de alcance; `.gitignore` ya cubre `.env*` con `!.env.template` desde el SPEC 03.
- **No:** nota en `README.md` — `.env.template` es la documentación de claves, igual que hizo el SPEC 03.
- **Definición sin migración ni feature:** decisión explícita del usuario — este spec es solo andamiaje.

## Riesgos identificados

| Riesgo                                                                                                                                                             | Mitigación                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js 16 renombró `middleware.ts` → `proxy.ts` y `cookies()` es asíncrono; la guía oficial de `@supabase/ssr` aún documenta el patrón viejo.                     | Revisar `node_modules/next/dist/docs/01-app/` (`proxy.md`, `cookies`, `next/headers`) antes de escribir los pasos 4–6; verificar con `npm run dev` que no hay aviso de `middleware` y que los assets cargan.                                           |
| La guía de Next.js desaconseja usar `proxy` para gestión de sesión y llamadas de red; el patrón de Supabase invoca `auth.getClaims()` en cada request que matchea. | Aceptado: es la recomendación oficial de Supabase para refrescar el token. El `matcher` excluye estáticos e imágenes para acotar el coste. El spec de Auth puede mover el refresco a un punto más acotado si molesta.                                  |
| Sin credenciales reales, el criterio `200 { ok: true }` no se puede verificar en este spec.                                                                        | El Route Handler degrada a `503 { ok: false }` sin romper; el criterio queda marcado como pendiente y se cierra al rellenar `.env.local` con los valores de `gwexvaisrpgtkroxgqvk` (dashboard o tools MCP `get_project_url` / `get_publishable_keys`). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` se expone en el bundle del cliente (prefijo `NEXT_PUBLIC_`).                                                                | Es correcto: la publishable/anon key está diseñada para ser pública; la seguridad recae en RLS (que llega con el esquema). El secreto real (`service_role`) no entra en este spec.                                                                     |
| `createServerClient` invocado desde un Server Component intentará escribir cookies y lanzará.                                                                      | El adaptador `setAll` envuelve la escritura en `try/catch`, como documenta Supabase; el refresco efectivo ocurre en `proxy.ts`.                                                                                                                        |

## Lo que **no** entra en este spec

- Tablas, migraciones SQL, triggers y políticas RLS.
- Autenticación real (login, registro, OAuth, magic link, invitado) y la retirada de la auth mock.
- Realtime, Storage y Edge Functions.
- Tipos `Database` de TypeScript y `SupabaseClient<Database>`.
- `SUPABASE_SECRET_KEY` / service_role.
- Protección de rutas o gating por rol en `proxy.ts`.
- Nota de configuración en `README.md` y tests automatizados.

Cada uno de esos, cuando llegue, va en su propio spec.
