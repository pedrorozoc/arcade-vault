# 06 — Leaderboard y scores en Supabase

**Estado:** Implementado
**Depende de:** SPEC 01, SPEC 04
**Fecha:** 2026-09-08

**Objetivo:** Mover las puntuaciones de `localStorage` a Supabase con dos tablas (`games` y `scores`) y RLS — `saveScore` inserta desde el navegador, el leaderboard de `/juego/[id]` y `/salon` lee filas reales con relleno `seededScores`, y el catálogo pasa a leerse de la tabla `games` con fallback a `lib/data.ts`.

## Por qué este spec existe

Hasta ahora las puntuaciones viven en `localStorage` (`av_scores`) mezcladas en cliente con 12 filas deterministas falsas (`seededScores`), y el catálogo es el array estático `GAMES` de `lib/data.ts`. El SPEC 04 dejó Supabase cableado (paquetes, clientes de navegador/servidor, `proxy.ts`, endpoint de salud) pero explícitamente **sin tablas** — difirió el esquema y los tipos `Database` "al primer spec que cree una tabla". Este es ese spec.

Se crean dos tablas en el schema `public`: `games` (catálogo) y `scores` (puntuaciones, con `game_id` referenciando `games.id`). La escritura de scores pasa a ser directa desde el navegador con la publishable key contra una política RLS de `insert` público; la lectura del leaderboard se hace en cliente con `useEffect` + estado, sin dependencias nuevas. La auth sigue siendo mock (`av_user`, solo un nombre en `localStorage`): los scores se atribuyen por `player_name` de texto libre, sin `user_id`, y se acepta el riesgo de scores falsos hasta que llegue un spec de Auth real.

El catálogo (Home, biblioteca `/juego`, detalle `/juego/[id]` y reproductor `/juego/[id]/jugar`) pasa a leer `title/short/long/cat` desde la tabla `games`, combinando `cover`/`color`/`best`/`plays` desde `lib/data.ts` por `id`. `lib/data.ts` se conserva como fuente del seed, red de seguridad (fallback cuando Supabase no responde) y capa presentacional. `/salon` sigue tomando la lista de juegos de `GAMES`; solo cambia el origen de las filas de puntuación.

## Alcance

**Dentro:**

- **Migración `supabase/migrations/0001_games_and_scores.sql`** (archivo nuevo, versionado; se aplica con `mcp__supabase__apply_migration` porque el proyecto no tiene Supabase CLI):
  - Tabla `public.games`: `id text primary key`, `title text not null`, `short text not null`, `long text not null`, `cat text not null check (cat in ('ARCADE','PUZZLE','SHOOTER','VERSUS'))`, `sort_order int not null default 0`, `created_at timestamptz not null default now()`.
  - Tabla `public.scores`: `id uuid primary key default gen_random_uuid()`, `game_id text not null references public.games(id) on delete cascade`, `player_name text not null check (char_length(player_name) between 1 and 10)`, `score integer not null check (score >= 0 and score <= 100000000)`, `created_at timestamptz not null default now()`.
  - Índice `scores_game_id_score_idx on public.scores (game_id, score desc)`.
  - `alter table ... enable row level security` en ambas tablas.
  - Policies:
    - `games`: `for select to anon, authenticated using (true)`. Sin policies de `insert/update/delete` (solo migraciones la modifican).
    - `scores`: `for select to anon, authenticated using (true)` y `for insert to anon, authenticated with check (true)` — la validación la hacen los CHECK de columna.
- **Migración `supabase/migrations/0002_seed_games.sql`** (archivo nuevo, versionado; se aplica con `mcp__supabase__apply_migration`):
  - 9 `insert` en `public.games`, uno por cada entrada de `GAMES` en `lib/data.ts` (`bloque-buster`, `caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel`, `asteroides`), con `title/short/long/cat` copiados literalmente y `sort_order` = índice en el array (0..8).
- **`lib/supabase/database.types.ts`** (archivo nuevo): generado con `mcp__supabase__generate_typescript_types`, exporta `Database`.
- **`lib/supabase/client.ts`** y **`lib/supabase/server.ts`**: pasar el genérico — `createBrowserClient<Database>(...)` / `createServerClient<Database>(...)`, importando `Database` de `./database.types`.
- **`lib/scores.ts`** (reescritura de la parte de scores; la parte de sesión mock queda intacta):
  - Se conservan sin cambios: `AvUser`, `getUser`, `setUser`, `subscribe`, `notify`, `userCache`, `USER_KEY`.
  - Se elimina: `SCORES_KEY` / la clave `av_scores`, `getScores`, `saveScore` síncrona, `getMergedLeaderboard`, `getBestScoreFor` síncrona, `bestScoreCache`, `ScoreEntry`.
  - `formatScoreDate(at: string | number): string` — acepta el ISO string de `created_at` además del `number` histórico.
  - Nuevo `getVersion(): number` — contador que `notify()` incrementa; sirve de `getSnapshot` para `useSyncExternalStore` en los componentes que deben refetch tras un guardado.
  - API nueva:

    ```ts
    export interface LeaderboardEntry {
      rank: number;
      name: string;
      score: number;
      date: string; // dd/mm/aaaa
    }

    export async function saveScore(entry: {
      game: string;
      score: number;
      name: string;
    }): Promise<void>;

    export async function getLeaderboard(
      gameId: string,
      seed: number,
      count?: number // por defecto 12
    ): Promise<LeaderboardEntry[]>;

    export async function getBestScoreFor(
      gameId: string,
      playerName: string | null
    ): Promise<LeaderboardEntry | null>;
    ```

  - `saveScore`: normaliza `name` a `name.trim().toUpperCase().slice(0, 10)` (o `"INVITADO"` si queda vacío) y `score` a `Math.max(0, Math.floor(score))`; hace `createClient().from("scores").insert({ game_id, player_name, score })`; si no hay error, llama `notify()`; si hay error, lo relanza para que el componente lo muestre.
  - `getLeaderboard`: `select("player_name, score, created_at").eq("game_id", gameId).order("score", { ascending: false }).limit(count)`. Mapea cada fila a `LeaderboardEntry` (`name = player_name`, `date = formatScoreDate(created_at)`). Si hay error → devuelve `seededScores(seed, count)`. Si `filas.length < count` → mezcla filas reales + `seededScores(seed, count)`, ordena por `score` desc, corta a `count`, recalcula `rank`. Si `filas.length >= count` → solo filas reales, con `rank` recalculado.
  - `getBestScoreFor`: si `playerName` es `null` → devuelve `null` sin consultar. Si no, `select(...).eq("game_id", gameId).eq("player_name", playerName).order("score", { ascending: false }).limit(1)`; mapea la fila a `LeaderboardEntry` (`rank: 0`) o `null`.
- **`lib/games-catalog.ts`** (archivo nuevo):
  - `mapRow(row): Game` — combina la fila de `games` (`id/title/short/long/cat`) con `cover`/`color`/`best`/`plays` tomados de `GAMES` (`lib/data.ts`) por `id`; si el `id` no está en `GAMES`, usa valores neutros (`cover: "cover-bricks"`, `color: "cyan"`, `best: 0`, `plays: "0"`).
  - `getCatalog(): Promise<Game[]>` — server; usa `lib/supabase/server.ts`, `select("*").order("sort_order")`, mapea con `mapRow`; si hay error o 0 filas → devuelve `GAMES`.
  - `getGame(id: string): Promise<Game | null>` — server; `select("*").eq("id", id).maybeSingle()`; si hay error → `GAMES.find((g) => g.id === id) ?? null`.
  - `fetchCatalogFromBrowser(): Promise<Game[]>` — cliente; misma consulta con `lib/supabase/client.ts`, mismo fallback a `GAMES`.
- **`components/GameLeaderboard.tsx`** (reescritura): sigue `"use client"`. Estado inicial `useState(() => seededScores(seed, count))` (determinista → sin mismatch de hidratación). `const version = useSyncExternalStore(subscribe, getVersion, () => 0)`. `useEffect` con deps `[gameId, seed, count, version]` que llama `getLeaderboard` y hace `setRows`. Mientras recarga mantiene las filas previas. El resto del marcado (`.leaderboard`, `.lb-row`, `#rank`, fecha, score) no cambia.
- **`app/salon/page.tsx`** (cambio): `rows` pasa de `useMemo(seededScores)` a estado alimentado por `getLeaderboard(tab, seed, 12)` en un `useEffect` con deps `[tab, version]` (inicial `seededScores(seed, 12)`). `best` pasa a estado alimentado por `getBestScoreFor(tab, getUser()?.name ?? null)` en un `useEffect` con deps `[tab, version]`. `youRank` se recalcula sobre `rows`. Los tabs siguen iterando `GAMES`. El podio (`rows[0..2]`) es seguro porque el relleno garantiza `count` filas.
- **`components/GamePlayer.tsx`** y **`components/games/AsteroidsGame.tsx`** (cambio): `handleSave` pasa a `async`; estados nuevos `saving` y `saveError`; `await saveScore(...)` dentro de `try/catch`; el botón "GUARDAR PUNTUACIÓN" se deshabilita mientras `saving`; si `catch`, se muestra un mensaje de error breve (theme actual) y **no** se marca `saved`.
- **`app/juego/[id]/page.tsx`** y **`app/juego/[id]/jugar/page.tsx`** (cambio): obtienen el juego con `await getGame(id)`; `notFound()` solo si el resultado es `null` (el fallback a `GAMES` ya se aplicó dentro de `getGame`).
- **`app/page.tsx`** (Home) y **`app/juego/page.tsx`** (biblioteca) (cambio): siguen `"use client"`. Estado de catálogo con inicial `GAMES` (Home usa `GAMES.slice(0, 6)` como hoy) y un `useEffect` que llama `fetchCatalogFromBrowser()` y reemplaza el estado. El buscador y los filtros de `/juego` operan sobre ese estado.

**Fuera:**

- Supabase Auth real y atar los scores a `auth.uid()`; retirada de la auth mock.
- Realtime en el leaderboard (reordenado en vivo al insertar otro jugador).
- Leaderboard global entre todos los juegos y paginación / "ver más" del leaderboard.
- Computar `best` (mejor global) y `plays` (nº de partidas) como agregados de `scores` — siguen siendo los valores estáticos de `lib/data.ts`.
- Mover `cover`/`color` a la tabla `games`, o alimentar los tabs de `/salon` desde la tabla `games`.
- Migrar los `av_scores` históricos de `localStorage` a la base de datos.
- Anti-trampa, rate-limiting, validación de score server-side y moderación/borrado de puntuaciones.
- `SUPABASE_SECRET_KEY` / service_role y cualquier escritura privilegiada desde servidor.
- Modificar `next.config.ts`, `proxy.ts`, el motor de Asteroides (`lib/games/asteroids/engine.ts`) o el resto de juegos.
- Tests automatizados (no hay runner en el proyecto).

## Modelo de datos

### Tablas nuevas (schema `public`)

```sql
-- games
id          text        primary key         -- mismo string que Game.id (slug de ruta)
title       text        not null
short       text        not null
long        text        not null
cat         text        not null            -- check in ('ARCADE','PUZZLE','SHOOTER','VERSUS')
sort_order  int         not null default 0
created_at  timestamptz not null default now()

-- scores
id          uuid        primary key default gen_random_uuid()
game_id     text        not null references public.games(id) on delete cascade
player_name text        not null            -- check char_length between 1 and 10
score       integer     not null            -- check score >= 0 and score <= 100000000
created_at  timestamptz not null default now()
```

Índice: `scores_game_id_score_idx on public.scores (game_id, score desc)`.

RLS activo en ambas. `games`: `select` público, sin escritura. `scores`: `select` e `insert` públicos (`anon` + `authenticated`); la validación la hacen los CHECK de columna.

### Claves de `localStorage`

- `av_user` — **sin cambios** (nombre del jugador del mock auth).
- `av_scores` — **se deja de usar**. No se lee ni se escribe; no se migra su contenido.

### Contratos de código

```ts
// lib/scores.ts
export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  date: string;
}
export function getVersion(): number;
export async function saveScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void>;
export async function getLeaderboard(
  gameId: string,
  seed: number,
  count?: number
): Promise<LeaderboardEntry[]>;
export async function getBestScoreFor(
  gameId: string,
  playerName: string | null
): Promise<LeaderboardEntry | null>;

// lib/games-catalog.ts
export function mapRow(row: GamesRow): Game;
export async function getCatalog(): Promise<Game[]>; // server, fallback a GAMES
export async function getGame(id: string): Promise<Game | null>; // server, fallback a GAMES.find
export async function fetchCatalogFromBrowser(): Promise<Game[]>; // cliente, fallback a GAMES

// lib/supabase/database.types.ts
export type Database = {
  /* generado por mcp__supabase__generate_typescript_types */
};
```

Convenciones: `game_id` = `Game.id` (`"asteroides"`, `"rocas"`, …). `player_name` siempre en mayúsculas y ≤10 caracteres (lo garantiza `saveScore`). "Pocas filas" en el leaderboard = menos de `count`; el hueco se rellena con `seededScores(seed, count)`.

## Plan de implementación

1. Crear `supabase/migrations/0001_games_and_scores.sql` (tablas `games` y `scores`, índice, `enable row level security`, policies) y aplicarla con `mcp__supabase__apply_migration`. Commitear el `.sql`. Prueba: `mcp__supabase__list_tables` (schema `public`) muestra `games` y `scores`; `mcp__supabase__list_migrations` lista `0001_games_and_scores`; `mcp__supabase__get_advisors` (security) no reporta tablas sin RLS.
2. Crear `supabase/migrations/0002_seed_games.sql` (9 `insert` en `games` con los datos de `GAMES`, `sort_order` = índice) y aplicarla con `mcp__supabase__apply_migration`. Commitear el `.sql`. Prueba: `mcp__supabase__execute_sql` con `select id, sort_order from games order by sort_order` devuelve las 9 filas con los mismos `id` que `GAMES` y `sort_order` 0..8.
3. Generar `lib/supabase/database.types.ts` con `mcp__supabase__generate_typescript_types` y retipar `lib/supabase/client.ts` y `lib/supabase/server.ts` con `<Database>`. Revisar antes `node_modules/next/dist/docs/01-app/` si surge duda sobre `cookies()` async en `server.ts`. Prueba: `npm run build` compila; en un archivo de prueba, `createClient().from("scores")` autocompleta columnas tipadas.
4. Reescribir la parte de scores de `lib/scores.ts`: eliminar `av_scores` / `getScores` / `getMergedLeaderboard` / `bestScoreCache` / `ScoreEntry`; añadir `getVersion`, `saveScore` async, `getLeaderboard` async (con relleno `seededScores` cuando hay menos de `count`, y `seededScores` puro si la consulta falla), `getBestScoreFor` async; ampliar `formatScoreDate` a `string | number`. No tocar `getUser`/`setUser`/`subscribe`. Prueba: `npm run lint` y `npm run build` pasan.
5. Reescribir `components/GameLeaderboard.tsx`: estado inicial `seededScores(seed, count)`, `version` vía `useSyncExternalStore(subscribe, getVersion, () => 0)`, `useEffect([gameId, seed, count, version])` que llama `getLeaderboard` y hace `setRows`. Prueba manual: `/juego/asteroides` muestra el leaderboard; con `scores` vacía se ven las 12 filas seeded; `npm run build` compila.
6. Actualizar `components/GamePlayer.tsx` y `components/games/AsteroidsGame.tsx`: `handleSave` async con `try/catch`, estados `saving`/`saveError`, botón deshabilitado mientras guarda, mensaje de error si falla. Prueba manual: jugar en `/juego/rocas/jugar` y `/juego/asteroides/jugar`, guardar → `mcp__supabase__execute_sql` con `select * from scores order by created_at desc limit 5` muestra las filas; forzar un fallo (key inválida) muestra el error y no marca "guardada".
7. Actualizar `app/salon/page.tsx`: `rows` desde `getLeaderboard(tab, seed, 12)` y `best` desde `getBestScoreFor(tab, getUser()?.name ?? null)`, ambos en `useEffect` con deps `[tab, version]` e inicial `seededScores(seed, 12)` / `null`. Tabs siguen desde `GAMES`. Prueba manual: `/salon` muestra filas reales mezcladas con seeded; con un mock user cuyo nombre coincide con un `player_name` guardado, aparece "▸ TU MEJOR MARCA EN <JUEGO>" con su ranking.
8. Crear `lib/games-catalog.ts` con `mapRow`, `getCatalog`, `getGame` (server, `lib/supabase/server.ts`) y `fetchCatalogFromBrowser` (cliente, `lib/supabase/client.ts`), todos con fallback a `GAMES`. Prueba: `npm run build` compila; `import { getGame } from "@/lib/games-catalog"` resuelve.
9. Cambiar `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` a `await getGame(id)` (mantener `notFound()` cuando sea `null`). Prueba manual: `/juego/asteroides` y `/juego/asteroides/jugar` cargan con textos desde `games`; `/juego/no-existe` da 404; con la publishable key inválida en `.env.local` siguen cargando desde `GAMES`.
10. Cambiar `app/page.tsx` y `app/juego/page.tsx` a estado de catálogo con inicial `GAMES` (Home `slice(0, 6)`) y `useEffect` que llama `fetchCatalogFromBrowser()`. El buscador/filtros de `/juego` operan sobre el estado. Prueba manual: Home y `/juego` renderizan igual; con `games` poblada los textos vienen de la DB; con Supabase caído se ve `GAMES`; sin warnings de hidratación en consola.
11. Verificación de punta a punta: `npm run lint`, `npm run build`, `npm run dev`. Jugar una partida completa en `/juego/asteroides/jugar` hasta `GAME OVER`, guardar la puntuación, verificar la fila con `mcp__supabase__execute_sql`, comprobar que aparece según su ranking en el leaderboard de `/juego/asteroides` (al volver a la ruta) y en `/salon`; comprobar que `seededScores` rellena cuando hay menos de `count` filas; que el catálogo lee de `games` y degrada a `GAMES` con Supabase caído; que `localStorage` no tiene la clave `av_scores` tras jugar; `mcp__supabase__get_advisors` (security) sin hallazgos nuevos.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` compila sin errores.
- [ ] `mcp__supabase__list_tables` (schema `public`) devuelve `games` y `scores`; `mcp__supabase__list_migrations` incluye `0001_games_and_scores` y `0002_seed_games`.
- [ ] RLS está habilitado en `games` y `scores`; `mcp__supabase__get_advisors` (security) no reporta tablas sin RLS ni políticas permisivas no intencionadas nuevas.
- [ ] `games` tiene 9 filas con los mismos `id` que `GAMES` de `lib/data.ts` y `sort_order` 0..8 ascendente.
- [ ] Con la publishable key: un `select` sobre `games` funciona y un `insert` sobre `games` es rechazado por RLS.
- [ ] Con la publishable key: un `insert` sobre `scores` con datos válidos funciona y el `select` es público.
- [ ] Un `insert` sobre `scores` con `player_name` de más de 10 caracteres, o con `score` negativo, es rechazado por un CHECK de columna.
- [ ] `lib/supabase/database.types.ts` existe, exporta `Database`, y `client.ts` / `server.ts` lo usan como genérico.
- [ ] Tras jugar y guardar, `localStorage` no contiene la clave `av_scores`; `lib/scores.ts` no la referencia.
- [ ] `saveScore` inserta una fila en `scores` con `game_id`, `player_name` (mayúsculas, ≤10) y `score` (entero ≥0), verificable con `mcp__supabase__execute_sql`.
- [ ] `getLeaderboard(gameId, seed, count)` devuelve las filas reales de `scores` ordenadas por `score` desc; si hay menos de `count`, completa con filas de `seededScores` y reordena; si la consulta falla, devuelve `seededScores(seed, count)`.
- [ ] Tras guardar un score, al volver a `/juego/<id>` el leaderboard muestra la nueva fila en su posición por ranking (refresco vía `notify()` / `getVersion()`).
- [ ] En `/salon`, la tabla principal muestra filas reales de `scores` mezcladas con el relleno seeded, y "▸ TU MEJOR MARCA EN <JUEGO>" aparece cuando el nombre del mock user coincide con un `player_name` guardado para ese juego.
- [ ] `getBestScoreFor` con `playerName` `null` (sin mock user) devuelve `null` sin consultar Supabase.
- [ ] `app/juego/[id]/page.tsx` y `app/juego/[id]/jugar/page.tsx` obtienen el juego con `getGame(id)`; un `id` inexistente sigue devolviendo 404.
- [ ] Home (`/`) y la biblioteca (`/juego`) renderizan la lista de juegos desde la tabla `games`; el buscador y los filtros de `/juego` siguen funcionando.
- [ ] Con Supabase inaccesible (publishable key inválida o proyecto caído), Home, `/juego`, `/juego/[id]` y `/juego/[id]/jugar` siguen renderizando el catálogo desde `GAMES` sin pantalla de error.
- [ ] `game.best` y `game.plays` mostrados en Home y en el detalle siguen siendo los valores estáticos de `lib/data.ts`.
- [ ] `GamePlayer` y `AsteroidsGame` muestran un estado de error si `saveScore` falla y no marcan la puntuación como guardada.
- [ ] No hay warnings de hidratación nuevos en `/`, `/juego`, `/juego/[id]`, `/juego/[id]/jugar` ni `/salon`.
- [ ] Todo el texto visible nuevo está en español y respeta el theme de `app/globals.css`.

## Decisiones tomadas y descartadas

- **Sí:** dos tablas `games` + `scores` en `public`, con `scores.game_id references games(id)`. `games.id` es `text` (el slug estable ya usado en rutas y en el `av_scores` histórico), **no** `uuid`.
- **Sí:** modelo híbrido — `games` guarda `title/short/long/cat/sort_order`; `cover`, `color`, `best` y `plays` se resuelven desde `GAMES` (`lib/data.ts`) por `id` en `lib/games-catalog.ts`. **No:** mover `cover`/`color` a la DB — son detalle de presentación acoplado al CSS (`.cover-*`), sin valor como dato.
- **Sí:** `GAMES` de `lib/data.ts` se conserva como (a) fuente del seed de `games`, (b) fallback cuando Supabase no responde, (c) origen de `cover`/`color`/`best`/`plays`, (d) origen de los tabs de `/salon`. **No:** eliminar `lib/data.ts`.
- **Sí:** `best` y `plays` siguen estáticos. **No:** computarlos como `max(score)` / `count(*)` — añade consultas a Home y detalle sin pedirlo; va en otro spec.
- **Sí:** RLS con `select` público en ambas tablas e `insert` público en `scores` (`with check (true)`), validación por CHECK de columna (`player_name` 1..10, `score` 0..1e8). **No:** exigir usuario autenticado — la auth sigue siendo mock; se acepta el riesgo de scores falsos hasta el spec de Auth.
- **Sí:** `games` sin policies de escritura — solo las migraciones la tocan.
- **Sí:** escritura de scores directa desde el navegador con `lib/supabase/client.ts`. **No:** Route Handler / Server Action / Edge Function — sin validación server-side pedida, los CHECK de columna bastan para el MVP.
- **Sí:** lectura del leaderboard en cliente con `useEffect` + estado y refresco por `notify()` / `getVersion()`. **No:** SWR / React Query — no se añade dependencia. **No:** Server Components para el leaderboard — `GameLeaderboard` y `/salon` ya son client components con estado.
- **Sí:** relleno con `seededScores` cuando `scores` devuelve menos de `count` filas, y `seededScores` puro si la consulta falla. "Pocas filas" = menos de `count`, sin umbral aparte.
- **Sí:** empezar limpio — `av_scores` de `localStorage` queda obsoleto y se ignora. **No:** migración one-time ni doble escritura — los datos locales previos son de prueba.
- **Sí:** "TU MEJOR MARCA" se identifica por coincidencia exacta de `player_name` con el nombre del mock user (ambos en mayúsculas, ≤10). **No:** `user_id` — no hay auth real.
- **Sí:** Home y `/juego` (client components) obtienen el catálogo con `fetchCatalogFromBrowser()` e inicial `GAMES` para no romper hidratación; `/juego/[id]` y `/juego/[id]/jugar` (Server Components) usan `getGame(id)`. **No:** convertir Home/`/juego` a Server Components — arrastraría el estado de búsqueda/filtro a un refactor mayor.
- **Sí:** el SQL de las migraciones se commitea en `supabase/migrations/` como registro, aunque se aplique vía `mcp__supabase__apply_migration` (no hay Supabase CLI en el proyecto).
- **Sí:** `lib/supabase/database.types.ts` generado con `mcp__supabase__generate_typescript_types` y clientes retipados — es el "primer spec de tabla" que anticipaba el SPEC 04.
- **No:** tocar `next.config.ts`, la auth mock, `proxy.ts`, el motor de Asteroides ni el resto de juegos.

## Riesgos identificados

| Riesgo                                                                                                                                                                                                        | Mitigación                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.env.local` puede tener la publishable key en placeholder (el SPEC 04 dejó el `200 { ok: true }` pendiente de credenciales); si la key no es válida, las escrituras de `scores` y todas las lecturas fallan. | Toda lectura de catálogo y leaderboard degrada a `GAMES` / `seededScores`; `saveScore` captura el error y lo muestra sin romper la partida. Antes del Paso 4, confirmar credenciales reales de `gwexvaisrpgtkroxgqvk` con `mcp__supabase__get_project_url` / `get_publishable_keys` y `GET /api/health/supabase`. |
| `insert` público en `scores` es un vector de spam / trampa: cualquiera con la publishable key inserta scores arbitrarios.                                                                                     | Aceptado para el MVP con auth mock. Los CHECK de columna acotan `player_name` y `score`. El spec de Auth añadirá `user_id` + RLS por `auth.uid()` y, si hace falta, rate-limiting.                                                                                                                                |
| Leer el catálogo desde Supabase vuelve `/juego/[id]` y `/juego/[id]/jugar` de render dinámico (cookies del server client) y añade latencia por request.                                                       | El fallback a `GAMES` es inmediato ante error; el conjunto es de 9 filas; `getGame` puede cachearse en otro spec si molesta.                                                                                                                                                                                      |
| `GameLeaderboard` y `/salon` renderizan `seededScores` en SSR y lo reemplazan por datos reales en `useEffect`: parpadeo visible.                                                                              | El estado inicial es exactamente `seededScores(seed, count)` (determinista, sin mismatch); el reemplazo mantiene el número de filas y el layout. Realtime / streaming queda para otro spec.                                                                                                                       |
| Colisión de `player_name` (dos personas eligen "PX_KAI"): comparten "TU MEJOR MARCA" y ranking.                                                                                                               | Inherente a la auth mock por nombre; se resuelve con `user_id` en el spec de Auth.                                                                                                                                                                                                                                |
| `GAMES` incluye `rocas` y `asteroides` (juegos casi duplicados del SPEC 05); ambos se siembran en `games`.                                                                                                    | Es correcto: `scores` referencia ambos `id` por separado, igual que hoy el `av_scores` histórico.                                                                                                                                                                                                                 |

## Lo que **no** entra en este spec

- Supabase Auth real y atar los scores a `auth.uid()`.
- Realtime en el leaderboard.
- Leaderboard global entre juegos y paginación del leaderboard.
- Computar `best` / `plays` como agregados de `scores`.
- Migrar `cover` / `color` o los tabs de `/salon` a la tabla `games`.
- Migrar los `av_scores` históricos de `localStorage`.
- Anti-trampa, rate-limiting y moderación / borrado de scores.
- `SUPABASE_SECRET_KEY` / service_role.
- Tests automatizados.

Cada uno de esos, cuando llegue, va en su propio spec.
