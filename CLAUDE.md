# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — plataforma para jugar online y competir por la mayor cantidad de puntos. Next.js 16.3.4 (App Router), React 19.2.8, TypeScript, Tailwind CSS v4, Supabase (catálogo + puntuaciones) y Resend (formulario de contacto).

Estado: SPECS 01–07 implementados. Hay 5 rutas de UI (`/`, `/juego`, `/juego/[id]`, `/salon`, `/auth`, `/acerca-de`), dos juegos realmente jugables (**Asteroides** y **Tetris**) y leaderboard persistido en Supabase. El resto del catálogo usa el reproductor simulado `GamePlayer`. La autenticación sigue siendo mock (`av_user` en `localStorage`) — el spec de Auth real está pendiente.

## Commands

```bash
npm run dev      # servidor de desarrollo (Next.js, App Router)
npm run build    # build de producción
npm run start    # sirve el build de producción
npm run lint     # ESLint (eslint-config-next: core-web-vitals + typescript)
npm run format   # Prettier sobre todo el repo
```

No hay test runner configurado. La verificación de cada spec es manual (`npm run build` + recorrer las rutas en el navegador).

**Migraciones de Supabase**: el proyecto **no tiene Supabase CLI**. Las migraciones de `supabase/migrations/` se aplican con `mcp__supabase__apply_migration` (servidor MCP `supabase` declarado en `.mcp.json`, proyecto `gwexvaisrpgtkroxgqvk`) y el `.sql` se commitea igual, como historial versionado. Verificación con `mcp__supabase__execute_sql`, `mcp__supabase__list_migrations` y `mcp__supabase__get_advisors`.

## Non-standard Next.js — read before writing code

Ver el bloque al inicio de `AGENTS.md`: esta instalación de Next.js (16.3.4) puede tener APIs y convenciones distintas a las que conoces por entrenamiento. Antes de escribir código que toque rutas, layouts, data fetching o config, revisa la guía correspondiente en `node_modules/next/dist/docs/` (carpetas `01-app`, `02-pages`, `03-architecture`, `04-community`). Presta atención a avisos de deprecación.

Diferencias ya encontradas en este repo:

- **`middleware.ts` se llama ahora `proxy.ts`** (raíz), exporta `export async function proxy(request: NextRequest)` y su runtime es Node.js sin posibilidad de cambiarlo.
- **`cookies()` de `next/headers` es asíncrono** (`await cookies()`).
- Las páginas tipan sus props con el helper global **`PageProps<"/ruta/[param]">`** y `params` es una promesa (`const { id } = await params`).

## Skills

- **`/frontend-design`** — úsala **siempre** para diseñar o retocar interfaces de usuario.
- **`/spec-juego <prototipo>`** (skill local, `.claude/skills/spec-juego/`) — redacta el spec para convertir un prototipo de `references/started-games/` en un juego real con leaderboard, fusionando el patrón de SPEC 05 (motor + wrapper + catálogo + cover art) y SPEC 06 (migración seed en `games`). Genera `specs/NN-<slug>.md` en estado `Borrador`. **No escribe código**; la implementación es `/spec-impl`.

## Hooks

`.claude/settings.json` registra un hook `PostToolUse` sobre `Write|Edit` que ejecuta `.claude/hooks/format-and-lint.mjs`: pasa el archivo tocado por Prettier (`--write --ignore-unknown`) y, si es JS/TS, por `eslint --fix`. Nunca bloquea (siempre sale con 0) e ignora rutas fuera del proyecto, `node_modules` y `.next`. Por eso **no hace falta formatear a mano** tras editar.

## Architecture

### Rutas (`app/`)

| Ruta                       | Archivo                            | Tipo          | Qué hace                                                         |
| -------------------------- | ---------------------------------- | ------------- | ---------------------------------------------------------------- |
| `/`                        | `app/page.tsx`                     | Client        | Landing (hero, preview de juegos, stats, actividad, precios)     |
| `/juego`                   | `app/juego/page.tsx`               | Client        | Biblioteca: grid de tarjetas con filtro por categoría y búsqueda |
| `/juego/[id]`              | `app/juego/[id]/page.tsx`          | Server        | Detalle del juego + `GameLeaderboard`                            |
| `/juego/[id]/jugar`        | `app/juego/[id]/jugar/page.tsx`    | Server        | Elige el componente de juego por `id` (cadena de `if`)           |
| `/salon`                   | `app/salon/page.tsx`               | Client        | Salón de la Fama: leaderboard por juego en pestañas              |
| `/auth`                    | `app/auth/page.tsx`                | Client        | Login/registro **mock** → escribe `av_user` en `localStorage`    |
| `/acerca-de`               | `app/acerca-de/page.tsx`           | Client        | Acerca de + formulario de contacto                               |
| `POST /api/contact`        | `app/api/contact/route.ts`         | Route Handler | Envía el mensaje por Resend (con honeypot `company`)             |
| `GET /api/health/supabase` | `app/api/health/supabase/route.ts` | Route Handler | Healthcheck de la integración de Supabase (200 / 503)            |

para ver los juegos implementados se puede [aquí](references/implemented-games.md)

`app/layout.tsx` es el root layout: carga tres fuentes de Google (`Press_Start_2P`, `JetBrains_Mono`, `Courier_Prime`) como variables CSS y monta `<Nav />`.

- **Alias de imports**: `@/*` mapea a la raíz del repo (`tsconfig.json`).

### Componentes (`components/`)

- `Nav.tsx` — navbar con sección activa por `usePathname()` y sesión mock.
- `GamePlayer.tsx` — reproductor **simulado** genérico (puntuación autoincremental, sin mecánicas). Es el fallback para los juegos del catálogo que aún no tienen motor.
- `GameLeaderboard.tsx` — tabla de puntuaciones de un juego.
- `games/AsteroidsGame.tsx`, `games/TetrisGame.tsx` — wrappers de juego real.

### Datos y estado (`lib/`)

- `data.ts` — array estático `GAMES` (tipo `Game`), `CATS`, `PLAYERS` y `seededScores(seed, count)` (leaderboard falso determinista de relleno).
- `games-catalog.ts` — parte **de cliente/compartida** del catálogo: `mapRow` y `fetchCatalogFromBrowser`.
- `games-catalog.server.ts` — parte **de servidor**: `getCatalog`, `getGame`. Vive aparte porque importa `./supabase/server` → `next/headers`, que no puede entrar en el bundle de un Client Component. **Nunca fusiones los dos archivos.**
- `scores.ts` — sesión mock (`av_user`) + puntuaciones en Supabase: `saveScore`, `getLeaderboard`, `getBestScoreFor`, y el par `subscribe` / `getVersion` para `useSyncExternalStore`.
- `contact.ts` — tipo `ContactPayload` y `validateContact`, compartido por cliente y Route Handler.
- `supabase/client.ts` (browser), `supabase/server.ts` (RSC/handlers), `supabase/proxy.ts` (`updateSession`), `supabase/database.types.ts` (tipos generados).
- `games/<slug>/engine.ts` — motores de juego en TypeScript, sin React ni DOM fuera del canvas.

### Base de datos (`supabase/migrations/`)

- `0001_games_and_scores.sql` — tablas `public.games` (id = slug `text`, `cat` con CHECK `ARCADE|PUZZLE|SHOOTER|VERSUS`, `sort_order`) y `public.scores` (`game_id` FK, `player_name` 1–10 chars, `score` entero 0–100.000.000), índice `(game_id, score desc)` y RLS: **select público en ambas, insert público en `scores`**.
- `0002_seed_games.sql` — siembra las 9 entradas iniciales de `GAMES`.
- `0003_seed_tetris.sql` — fila seed de `tetris` (`sort_order` 9).

`cover`, `color`, `best` y `plays` **no se migran**: son presentación y se resuelven desde `GAMES` por `id` en `mapRow`.

### Estilos

- Tailwind v4 vía `@import "tailwindcss"` en `app/globals.css`, sin `tailwind.config` (la config vive en el CSS, patrón v4).
- El grueso de `app/globals.css` (~2900 líneas) es un **design system propio a mano**: tokens en `:root` (`--bg`, `--ink`, `--cyan`, `--magenta`, `--yellow`, `--green`, `--pixel`, `--mono`…), fondo con grilla en perspectiva + scanlines + viñeta, marco CRT, botones neón, y un bloque de **cover art generado con CSS puro** (`.cover-bricks`, `.cover-tetro`, `.cover-asteroides`, `.cover-tetris`…). El tema es oscuro fijo, no por `prefers-color-scheme`.
- Al añadir UI, reutiliza estas clases; no las reimplementes con utilidades de Tailwind.

### Variables de entorno

Ver `.env.template`. Requeridas: `RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Convenciones del código

- **Comentario de cabecera**: los archivos de `lib/` y los Route Handlers abren con `// ===== ruta/archivo — qué hace =====` y un párrafo de contexto (por qué existe, qué spec lo introdujo). Sigue ese estilo al crear archivos nuevos.
- **Todo el texto visible y los comentarios van en español** (con tildes).
- **Degradación ante Supabase caído**: `getCatalog`, `getGame` y `fetchCatalogFromBrowser` devuelven `GAMES`; `getLeaderboard` devuelve `seededScores`. Mantén ese patrón: la UI nunca debe romperse por un fallo de red.
- **Estado externo → `useSyncExternalStore`**, nunca `useState` + `useEffect` sincronizando (la regla `react-hooks/set-state-in-effect` lo prohíbe). El snapshot debe ser referencialmente estable; para datos async, usa `getVersion()` como snapshot y refetch en un `useEffect` dependiente de esa versión.
- **Sin mismatch de hidratación**: los componentes que leen datos remotos parten de un estado inicial determinista (normalmente `seededScores`) y lo reemplazan en `useEffect`.

## Añadir un juego jugable

Patrón fijado por SPEC 05 y SPEC 07 (y automatizado en la skill `/spec-juego`):

1. Entrada nueva al final de `GAMES` en `lib/data.ts` (`cover: "cover-<slug>"`).
2. Migración `supabase/migrations/000N_seed_<slug>.sql` con el `insert` en `public.games` y `sort_order` = índice siguiente.
3. Clase `.cover-<slug>` en el bloque de covers de `app/globals.css` (vector blanco sobre negro, CSS puro, sin imágenes).
4. Motor `lib/games/<slug>/engine.ts`: fábrica `create<Slug>Game(canvas, callbacks)` que devuelve un `<Slug>Handle` con `pause() / resume() / restart() / endNow() / destroy()`. Sin auto-arranque de módulo, sin `getElementById`, sin globals; HUD y overlays dibujados **dentro del canvas**; rAF con tope de `dt`; `destroy()` cancela el rAF y retira **todos** los listeners.
5. Wrapper `components/games/<Slug>Game.tsx` (`"use client"`), clon de `AsteroidsGame.tsx`: HUD de React como espejo de los callbacks, panel de guardado no bloqueante al terminar, `saveScore({ game, score, name })`.
6. Rama `if (id === "<slug>") return <SlugGame game={game} />;` en `app/juego/[id]/jugar/page.tsx` (import normal, sin `next/dynamic`).
7. Si el canvas no es 4:3, regla CSS propia acotada — p. ej. `.crt-screen.crt-tetris canvas { aspect-ratio: 23 / 30 }`.

**Genérico, no se toca al añadir un juego**: `lib/scores.ts`, `components/GameLeaderboard.tsx`, `app/salon/page.tsx`, `lib/games-catalog*.ts`, `lib/supabase/*`, `0001_games_and_scores.sql`.

Los prototipos por portar viven en `references/started-games/` (queda `04-arkanoid`). En esas carpetas, **cree al `game.js`, no al `CLAUDE.md`** — suelen estar desactualizados. Los templates HTML/JSX originales de las pantallas están en `references/resources/templates/`.

## Spec Driven Design

Este proyecto sigue un flujo de "Spec Driven Design" (ver `README.md`) basado en los comandos `/spec` y `/spec-impl`, provistos por el paquete de skills de terceros `Klerith/fernando-skills`:

```bash
npx skills@latest add Klerith/fernando-skills
```

Si esas skills no están instaladas en este entorno, instálalas antes de asumir que `/spec` o `/spec-impl` existen.

Los specs viven en `specs/NN-<slug>.md` con header de líneas en negrita sueltas (`**Estado:**`, `**Depende de:**`, `**Fecha:**`), estados en español (`Borrador` / `En revisión` / `Aprobado` / `Implementado` / `Obsoleto`) y secciones `## Alcance` (`**Dentro:**` / `**Fuera:**`), `## Modelo de datos`, `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones tomadas y descartadas`, `## Riesgos identificados`, `## Lo que **no** entra en este spec`.

Specs actuales (todos `Implementado`):

| Spec | Tema                                  |
| ---- | ------------------------------------- |
| 01   | Pantallas del prototipo (MPP)         |
| 02   | Home landing y biblioteca en `/juego` |
| 03   | «Acerca de» y contacto con Resend     |
| 04   | Integración de Supabase               |
| 05   | Juego Asteroides jugable              |
| 06   | Leaderboard y scores en Supabase      |
| 07   | Juego Tetris jugable                  |

El plan de implementación se ejecuta **paso a paso, un commit por paso**, cerrando con un paso que cambia el estado del spec a `Implementado`.
