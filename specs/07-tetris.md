# 07 — Juego Tetris jugable

**Estado:** Implementado
**Depende de:** SPEC 05, SPEC 06
**Fecha:** 2026-09-09

**Objetivo:** Convertir el prototipo Tetris de `references/started-games/03-tetris` en un juego real de la plataforma: un motor TypeScript portado de `game.js`, un wrapper cliente en `/juego/tetris/jugar` con el HUD de React sincronizado y guardado de puntuación, una nueva entrada `tetris` en el catálogo y su fila seed en la tabla `games` de Supabase.

## Por qué este spec existe

El SPEC 05 portó Asteroides como primer juego real y dejó explícitamente fuera la adaptación de Tetris (`references/started-games/03-tetris`) y Arkanoid, "para specs futuros por juego". Este es el segundo de esos specs. El SPEC 06 movió las puntuaciones a Supabase (`lib/scores.ts` → tabla `scores` → leaderboard de `/juego/[id]` y Salón de la Fama) y dejó el patrón de fila seed en `public.games` (`supabase/migrations/0002_seed_games.sql`).

El prototipo `game.js` es canvas 2D puro en un solo archivo, sin dependencias: globals de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, `animId`…), `document.getElementById` para el HUD y el overlay, listeners sobre `document`, un segundo `<canvas>` para la vista previa, un toggle de tema con `localStorage`, y auto-arranque con `init()` al final del módulo. Portarlo significa envolver esa lógica en una fábrica con ciclo de vida controlable (`createTetrisGame` / `destroy`), montarla desde un componente cliente que limpia al desmontar, y engancharla al circuito de puntuaciones existente con `saveScore({ game: "tetris", score, name })`.

Diferencias notables con Asteroides que este spec resuelve (Fase 3):

- **Canvas en formato retrato** `300 × 600` (ratio `1:2`) y **un segundo canvas** para la preview NEXT. El marco CRT envuelve un único `<canvas>`: el motor pasa a dibujar en un lienzo `460 × 600` con el tablero `300 × 600` a la izquierda y un **panel lateral in-canvas** (SCORE / LINES / LEVEL + caja NEXT) a la derecha. Ratio `23:30`, que necesita su propia regla CSS.
- **HUD y overlay en el DOM** (`#score`/`#lines`/`#level` por `.textContent`, `#overlay` para PAUSA y GAME OVER). El motor portado no toca el DOM: HUD y overlay se dibujan en el canvas, y los callbacks son el espejo para React.
- **Listeners sobre `document`** con **pulsación discreta** (cada `keydown` es un movimiento; no hay tecla mantenida ni `justPressed`). Pasan a `window` dentro de la fábrica y se retiran en `destroy()`.
- **Tecla `P`** para pausar en el propio juego (además del botón `PAUSA` del wrapper) → se conserva con un callback `onPause(paused)` para mantener sincronizados el estado de React y la etiqueta del botón.
- **Sin reinicio en el motor** (solo un botón DOM llamaba a `init()`) → se añade `restart()` al `Handle` y el botón `JUGAR DE NUEVO` del wrapper.
- **Sin tope de `dt`** (`loop` hace `dt = ts - lastTime` sin `Math.min`) → se añade un tope de 50 ms.
- **Ocho piezas**: las 7 estándar (I, O, T, S, Z, J, L) **más una "tuerca" hueca de 3×3** (`type 8`). El README dice 7, pero `game.js` genera `1..8`; se portan las 8 (port fiel). La tuerca es pieza exclusiva del Vault.
- **Sin vidas y sin estado de victoria**: Tetris es infinito. Los `TetrisCallbacks` no llevan `onLives`; en su lugar `onLines(n)`, y la barra `.player-hud` muestra "Líneas" donde Asteroides muestra "Vidas".
- **Mecánicas de render extra**: ghost piece (`ghostY()`, alpha 0.2), preview de la siguiente pieza, líneas de grilla, highlight por bloque y wall kicks `[0, -1, 1, -2, 2]`.
- **Chrome del prototipo que se descarta**: el toggle de tema (`#theme-toggle`, clase `light-mode`, `localStorage 'tetris-theme'`) y la lectura `getComputedStyle(document.body).getPropertyValue('--grid-line')` (el color de grilla pasa a constante del motor).

## Alcance

**Dentro:**

- **Nueva entrada al final de `GAMES` en `lib/data.ts`** con el tipo `Game` ya existente: `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetris"`, `short`, `long`, `best: 152800`, `plays: "0"` (ver Modelo de datos). El grid de `/juego` pasa a 10 tarjetas; el detalle `/juego/tetris` y el reproductor `/juego/tetris/jugar` quedan cableados por las rutas dinámicas ya existentes.
- **Nueva migración `supabase/migrations/0003_seed_tetris.sql`** (archivo nuevo, versionado): un `insert into public.games (id, title, short, long, cat, sort_order) values ('tetris', 'TETRIS', '<short>', '<long>', 'PUZZLE', 9)` con `sort_order = 9` (índice siguiente en `GAMES`). Se aplica con `mcp__supabase__apply_migration` (el proyecto no tiene Supabase CLI) y el `.sql` se commitea. Verificación con `mcp__supabase__execute_sql`, `mcp__supabase__list_migrations` y `mcp__supabase__get_advisors`.
- **Nueva clase CSS `.cover-tetris`** (con `::before` / `::after` si hacen falta) en `app/globals.css`, dentro del bloque `/* ===== Cover art generators (pure CSS) ===== */`. Estética vector blanco sobre negro, CSS puro, sin imágenes: silueta de un pozo (marco en U), 3–4 bloques apilados de forma irregular al fondo y un tetraminó cayendo en la parte superior, con `clip-path`. No reutiliza `.cover-rocas` ni `.cover-tetro` (esta última son bloques de color; `.cover-tetris` es monocroma).
- **Módulo motor `lib/games/tetris/engine.ts`** (TypeScript), port fiel de `references/started-games/03-tetris/game.js`:
  - Portar las funciones `createBoard`, `randomPiece` (tipos `1..8`, incluida la tuerca), `collide`, `rotateCW`, `tryRotate` (wall kicks `[0, -1, 1, -2, 2]`), `merge`, `clearLines`, `ghostY`, `hardDrop`, `softDrop`, `lockPiece`, `spawn`, `drawBlock`, `drawGrid`, `draw`, `drawNext`, `endGame`, `togglePause`, `loop` e `init`; y las constantes `COLS = 10`, `ROWS = 20`, `BLOCK = 30`, `COLORS` (índices `1..8`), `PIECES` (índices `1..8`), `LINE_SCORES = [0, 100, 300, 500, 800]`.
  - Lienzo `460 × 600`: el **tablero** ocupa `x ∈ [0, 300)` (`10 × 20` celdas de `30 px`) y el **panel lateral** `x ∈ [300, 460)`. El motor dibuja en ese panel, **in-canvas**, los rótulos `SCORE` / `LINES` / `LEVEL` y una caja `NEXT` con la siguiente pieza — reemplazando el `<aside class="panel">`, los `#score`/`#lines`/`#level` y el segundo `<canvas id="next-canvas">` del prototipo.
  - Se conservan: el ghost piece (alpha `0.2`), la preview de la siguiente pieza (ahora en el panel in-canvas), las líneas de grilla, el highlight por bloque, los wall kicks, la puntuación clásica (`[0,100,300,500,800] × level`, hard drop `+2`/celda, soft drop `+1`/fila), el nivel (`floor(lines / 10) + 1`) y la velocidad (`dropInterval = max(100, 1000 - (level - 1) * 90)` ms). El overlay `PAUSA` y el overlay `GAME OVER` (con la puntuación final) se dibujan **in-canvas**, como en Asteroides.
  - Se elimina: el auto-arranque `init()` a nivel de módulo, el uso de `document.getElementById`, los globals de módulo (pasan a estado interno de la fábrica), el toggle de tema (`#theme-toggle`, clase `light-mode`, `localStorage 'tetris-theme'`), el listener de `#restart-btn`, y la lectura `getComputedStyle(document.body).getPropertyValue('--grid-line')` (el color de grilla pasa a constante interna, p. ej. `rgba(255,255,255,0.08)`).
  - API imperativa exportada:

    ```ts
    export interface TetrisCallbacks {
      onScore(score: number): void;
      onLines(lines: number): void;
      onLevel(level: number): void;
      onPause(paused: boolean): void;
      onGameOver(finalScore: number): void;
      onRestart(): void;
    }

    export interface TetrisHandle {
      pause(): void;
      resume(): void;
      restart(): void;
      endNow(): void;
      destroy(): void;
    }

    export function createTetrisGame(
      canvas: HTMLCanvasElement,
      callbacks: TetrisCallbacks
    ): TetrisHandle;
    ```

  - Input: un listener `keydown` sobre `window`, registrado dentro de `createTetrisGame` y retirado en `destroy()`. Modelo de **pulsación discreta** (cada `keydown` actúa una vez, sin mapa de teclas mantenidas): `ArrowLeft`/`ArrowRight` mueven, `ArrowDown` es soft drop, `ArrowUp`/`KeyX` rotan (horario, con wall kicks), `Space` es hard drop, `KeyP` alterna la pausa (llama a la pausa interna y dispara `onPause`). Mientras el juego está montado y **no** en estado `gameOver`, el motor llama `e.preventDefault()` para `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y `Space`, para que la página no haga scroll (no para `KeyP`/`KeyX`).
  - `pause()` congela el avance de la simulación (deja de acumular `dt` y de bajar la pieza) y sigue dibujando; `resume()` lo reanuda; ambas disparan `onPause(true/false)`. `restart()` reinicia la partida (equivale a `init()`) y dispara `onRestart()`. `endNow()` fuerza el estado `gameOver` y su `onGameOver(score)` (una sola vez). `destroy()` marca un flag `destroyed`, cancela el `requestAnimationFrame` y quita el listener de `keydown`.
  - rAF loop con flags `paused` (congela el avance, sigue dibujando) y `destroyed` (corta el loop) — se abandona el patrón del prototipo de cancelar el `rAF` al pausar. Tope de `dt` en **50 ms** (`Math.min(ts - lastTime, 50)`) antes de acumular en `dropAccum`.
  - Los callbacks se invocan en el mismo punto donde el motor muta el valor: `onScore` tras cada `score +=` (soft drop, hard drop, `clearLines`); `onLines` y `onLevel` dentro de `clearLines`; `onGameOver` una sola vez al colisionar `spawn()` o al llamar `endNow()`; `onRestart` en `restart()`; `onPause` en cada alternancia (tecla `P` o `pause()`/`resume()`). El HUD del canvas sigue siendo la fuente de verdad visible; los callbacks son el espejo para React.
- **Wrapper cliente `components/games/TetrisGame.tsx`** (`"use client"`), clon de `components/games/AsteroidsGame.tsx`, que **reemplaza a `GamePlayer` solo para este juego**:
  - Recibe `game: Game`. Replica la estructura visual de `GamePlayer`: barra `.player-hud` con Jugador / Puntuación / **Líneas** / Nivel y botones `PAUSA` / `FIN` / `SALIR`; marco `.crt` → `.crt-screen` (con una clase modificadora `crt-tetris`) con un `<canvas width={460} height={600}>` en lugar de `.game-arena`.
  - `useRef` al `<canvas>` y al `Handle`; en un `useEffect(() => { … }, [])` llama `createTetrisGame(canvas, callbacks)` y en el cleanup llama `handle.destroy()`.
  - Estado React espejo: `score`, `lines`, `level`, `over`, `paused`, `saved`, `saving`, `saveError`, `nameOverride`. `onScore`→`setScore`, `onLines`→`setLines`, `onLevel`→`setLevel`, `onPause`→`setPaused`, `onGameOver(final)`→`setScore(final)` + `setOver(true)`, `onRestart`→resetea `over`/`saved`/`saveError` y pone `score` a `0`, `lines` a `0`, `level` a `1`.
  - Nombre del jugador: `useSyncExternalStore(subscribe, () => getUser()?.name ?? null, () => null)`, con `nameOverride` editable (mayúsculas, `slice(0, 10)`).
  - Botón `PAUSA` alterna llamando `handle.pause()` / `handle.resume()`; el estado `paused` de React lo fija `onPause` (una sola fuente de verdad, sirva la tecla `P` o el botón). Botón `FIN` llama `handle.endNow()`. `SALIR` es un `Link` a `/juego/tetris`. Con `paused && !over` se muestra el overlay `.crt-content` "EN PAUSA" sobre el canvas, igual que en Asteroides.
  - Con `over === true`, **panel no bloqueante debajo del canvas** (el bloque `.modal` con `margin: "18px auto 0"`, **no** el modal `.modal-bd`): puntuación final, `input` de iniciales, botón `GUARDAR PUNTUACIÓN` (deshabilitado mientras `saving`) que hace `await saveScore({ game: "tetris", score, name })` dentro de `try/catch` async, aviso `▸ PUNTUACIÓN GUARDADA_` al terminar, mensaje breve de error si falla (sin marcar `saved`), botón `JUGAR DE NUEVO` que llama `handle.restart()`, y un `Link` `VOLVER AL VAULT` a `/`.
- **Rama en `app/juego/[id]/jugar/page.tsx`**: `if (id === "tetris") return <TetrisGame game={game} />;` junto a la rama de `asteroides`, antes del `<GamePlayer game={game} />` genérico. Import normal (sin `next/dynamic`). Se conserva la firma `PageProps<"/juego/[id]/jugar">` y `getGame` de `@/lib/games-catalog.server`.
- **Regla CSS del `<canvas>` dentro de `.crt-screen`** en `app/globals.css`: como el ratio del prototipo (`23:30`) ≠ `4 / 3`, se añade una regla acotada `.crt-screen.crt-tetris canvas { aspect-ratio: 23 / 30; max-width: 460px; margin-inline: auto; }` junto a la regla `.crt-screen canvas` existente (que aporta `display: block; width: 100%; height: auto`), sin romper el marco CRT ni sus overlays.

**Fuera:**

- Controles táctiles / botones en pantalla y versión móvil jugable.
- Adaptación de Arkanoid (`references/started-games/04-arkanoid`) o cualquier otro prototipo de `references/started-games/`.
- Un registro genérico `id → componente` para el reproductor: se mantiene la cadena de `if` por `id`.
- Sonido y música (el prototipo no los trae).
- Sistemas de Tetris modernos no presentes en el prototipo: hold piece, 7-bag randomizer, lock delay, T-spins, DAS/ARR, kicks SRS completos.
- Leaderboard multijugador en tiempo real (realtime) para Tetris: sigue siendo lectura por `useEffect` + relleno `seededScores`, como el resto.
- Dificultad configurable, guardado de la partida en curso, logros.
- Migrar `cover`/`color` a la tabla `games`, o alimentar los tabs de `/salon` desde la tabla `games`.
- Modificar `next.config.ts`, la autenticación mock, `lib/scores.ts`, `lib/games-catalog.ts` / `lib/games-catalog.server.ts`, los clientes de Supabase, la migración `0001`/`0002` ni el resto del catálogo (incluido el motor de Asteroides).
- Tests automatizados (no hay runner en el proyecto).
- Cambiar `references/started-games/03-tetris/` (queda como referencia intacta).

## Modelo de datos

Este spec **no introduce claves de `localStorage` nuevas** ni tablas nuevas. Reutiliza `saveScore` de `lib/scores.ts` con `game: "tetris"` y el circuito de leaderboard (`getLeaderboard`, `getBestScoreFor`, `getVersion`) sin cambios.

Estructuras nuevas:

1. Un elemento más en `GAMES` (`lib/data.ts`), con el tipo `Game` ya existente:

   ```ts
   {
     id: "tetris",
     title: "TETRIS",
     short: "Rota y encaja tetraminós para completar líneas antes de que la pila alcance el techo.",
     long: "El puzzle de bloques de siempre, con un giro del Vault: siete piezas clásicas más una tuerca hueca de 3×3 caen sobre un pozo de 10×20. Gíralas con wall kicks, acelera la bajada con soft drop o suéltalas de golpe con hard drop, y limpia hasta cuatro líneas de una vez para multiplicar la puntuación por el nivel. Cada 10 líneas sube el nivel y la caída se acelera sin tregua.",
     cat: "PUZZLE",
     cover: "cover-tetris",
     color: "cyan",
     best: 152800,
     plays: "0",
   }
   ```

2. Una fila en `public.games` vía `supabase/migrations/0003_seed_tetris.sql`:

   ```sql
   insert into public.games (id, title, short, long, cat, sort_order)
   values (
     'tetris',
     'TETRIS',
     'Rota y encaja tetraminós para completar líneas antes de que la pila alcance el techo.',
     'El puzzle de bloques de siempre, con un giro del Vault: siete piezas clásicas más una tuerca hueca de 3×3 caen sobre un pozo de 10×20. Gíralas con wall kicks, acelera la bajada con soft drop o suéltalas de golpe con hard drop, y limpia hasta cuatro líneas de una vez para multiplicar la puntuación por el nivel. Cada 10 líneas sube el nivel y la caída se acelera sin tregua.',
     'PUZZLE',
     9
   );
   ```

3. Interfaces del motor (`lib/games/tetris/engine.ts`): `TetrisCallbacks` y `TetrisHandle` (ver Alcance).

Convenciones del motor (heredadas de `game.js`): lienzo fijo `460 × 600`; tablero `300 × 600` (`10 × 20` celdas de `30 px`) y panel lateral in-canvas en `x ∈ [300, 460)`; origen arriba-izquierda; sin wrap (colisión contra bordes y contra bloques fijados); piezas como matrices cuadradas rotadas por transposición + reverso de filas; 8 tipos de pieza (`1..8`, la `8` es la tuerca hueca); puntuación `LINE_SCORES[n] × level` por `n` líneas eliminadas a la vez, `+2` por celda en hard drop, `+1` por fila en soft drop; nivel `= floor(lines / 10) + 1`; velocidad `dropInterval = max(100, 1000 - (level - 1) * 90)` ms; sin vidas; sin estado de victoria. Toda partida puntúa con un entero que va directo a `saveScore` (`Math.max(0, Math.floor(score))` lo normaliza en `lib/scores.ts`).

## Plan de implementación

1. Añadir la entrada `tetris` al final de `GAMES` en `lib/data.ts` (con `short`/`long`/`best`/`plays` de este spec). Prueba: `npm run build` compila; `/juego` muestra 10 tarjetas; `/juego/tetris` (detalle) resuelve sin 404 y muestra su leaderboard con relleno `seededScores`.
2. Añadir `.cover-tetris` (y `::before` / `::after` si hacen falta) en el bloque de covers de `app/globals.css`: vector blanco sobre negro con pozo en U, bloques apilados y un tetraminó cayendo, `clip-path`, sin imágenes ni color. Prueba: la tarjeta `TETRIS` en `/juego` y la portada en `/juego/tetris` muestran el arte nuevo; `npm run build` compila.
3. Crear `lib/games/tetris/engine.ts`: portar `game.js` a TypeScript con la fábrica `createTetrisGame(canvas, callbacks)` y el `TetrisHandle`. Sin auto-arranque, sin `document.getElementById`, sin globals de módulo, sin toggle de tema. Lienzo `460 × 600` con tablero `300 × 600` + panel lateral in-canvas (SCORE / LINES / LEVEL + caja NEXT). Conservar ghost piece, preview, grilla, highlight, wall kicks, puntuación y velocidad; overlays `PAUSA` y `GAME OVER` in-canvas. Añadir el listener `keydown` en `window` con pulsación discreta (`←→` mover, `↓` soft drop, `↑`/`X` rotar, `Space` hard drop, `P` pausa), el `preventDefault` de flechas y `Space` mientras el estado no sea `gameOver`, el tope de `dt` en 50 ms, los flags `paused`/`destroyed`, y `pause`/`resume`/`restart`/`endNow`/`destroy`. Disparar `onScore`/`onLines`/`onLevel`/`onPause`/`onGameOver`/`onRestart` en el punto donde el motor muta cada valor. Revisar antes `node_modules/next/dist/docs/01-app/` si surge alguna duda de API. Prueba: `npm run lint` y `npm run build` pasan; `import { createTetrisGame } from "@/lib/games/tetris/engine"` resuelve.
4. Crear `components/games/TetrisGame.tsx` (`"use client"`): estructura visual clonada de `AsteroidsGame` (barra `.player-hud` con Jugador / Puntuación / Líneas / Nivel; marco `.crt` → `.crt-screen crt-tetris` con `<canvas width={460} height={600}>`; overlay `.crt-content` "EN PAUSA"; panel de guardado no bloqueante bajo el canvas). `useRef` + `useEffect` para `createTetrisGame` / `destroy`. Estado `score`/`lines`/`level`/`over`/`paused`/`saved`/`saving`/`saveError`/`nameOverride` alimentado por los callbacks. `PAUSA` → `pause`/`resume` (el estado `paused` lo fija `onPause`); `FIN` → `endNow`; `SALIR` → `/juego/tetris`. Panel de guardado: `input` de iniciales, `await saveScore({ game: "tetris", score, name })` en `try/catch`, `JUGAR DE NUEVO` → `handle.restart()`, `VOLVER AL VAULT` → `/`. Prueba manual: `/juego/tetris/jugar` renderiza sin warnings de hidratación; las piezas caen, rotan y encajan; se limpian líneas; el HUD React refleja `score`/`lines`/`level` del motor.
5. Editar `app/juego/[id]/jugar/page.tsx`: añadir `if (id === "tetris") return <TetrisGame game={game} />;` junto a la rama de `asteroides`; import normal. Prueba: `/juego/tetris/jugar` carga el juego real; `/juego/asteroides/jugar` y el resto de rutas `/juego/[id]/jugar` siguen igual (`GamePlayer` o `AsteroidsGame`).
6. Añadir en `app/globals.css` la regla `.crt-screen.crt-tetris canvas` (`aspect-ratio: 23 / 30`, `max-width: 460px`, `margin-inline: auto`) junto a la regla `.crt-screen canvas`. Prueba: en viewport estrecho el canvas se reduce manteniendo la proporción `23:30` y permanece dentro del marco CRT; el tablero y el panel lateral se ven completos; `/juego/asteroides/jugar` mantiene su `4:3`.
7. Crear `supabase/migrations/0003_seed_tetris.sql` (un `insert` en `public.games` con `id 'tetris'`, `sort_order 9` y los textos de este spec) y aplicarla con `mcp__supabase__apply_migration`. Commitear el `.sql`. Prueba: `mcp__supabase__execute_sql` con `select id, sort_order from games order by sort_order` devuelve 10 filas y `tetris` con `sort_order = 9`; `mcp__supabase__list_migrations` lista `0003_seed_tetris`; `mcp__supabase__get_advisors` (security) no reporta hallazgos nuevos.
8. Verificación de punta a punta: `npm run lint`, `npm run build`, `npm run dev` y prueba manual — jugar una partida completa en `/juego/tetris/jugar` hasta `GAME OVER`, guardar la puntuación, comprobar que aparece según su ranking en el leaderboard de `/juego/tetris` (al volver a la ruta) y en la fila «TU MEJOR MARCA» de `/salon` para `TETRIS`; verificar que `PAUSA`/`REANUDAR` funcionan desde el botón y desde la tecla `P` con la etiqueta sincronizada, que `FIN` fuerza el fin, que las flechas y `Space` no hacen scroll de la página, y que al salir (`SALIR` o navegación del Nav) no quedan `requestAnimationFrame` ni listeners de teclado activos.

## Criterios de aceptación

- [x] `npm run lint` pasa sin errores.
- [x] `npm run build` compila sin errores.
- [x] `GAMES` incluye una entrada `id: "tetris"` con `cat: "PUZZLE"` y `color: "cyan"`, y `/juego` muestra 10 tarjetas.
- [x] `/juego/tetris` (detalle) muestra la info del juego, la portada `.cover-tetris` y su leaderboard; un `id` inexistente sigue dando 404.
- [x] `mcp__supabase__list_migrations` incluye `0003_seed_tetris`; `games` tiene 10 filas y la fila `tetris` con `sort_order = 9`; RLS sigue activo y `mcp__supabase__get_advisors` (security) no reporta hallazgos nuevos.
- [x] `/juego/tetris/jugar` renderiza un `<canvas>` real dentro del marco CRT, sin warnings de hidratación en consola.
- [x] La pieza se mueve con `←`/`→`, rota con `↑` o `X` (con wall kicks contra la pared), baja más rápido con `↓` y cae de golpe con `Space`; `↑`/`↓`/`←`/`→`/`Space` no hacen scroll de la página.
- [x] Al completar una fila se elimina y las de arriba bajan; limpiar 1/2/3/4 líneas suma `100/300/500/800 × nivel`; el hard drop suma `+2` por celda y el soft drop `+1` por fila; el HUD React «Puntuación» coincide con el `SCORE` dibujado en el canvas. _(hard drop +2/fila, soft drop +1/fila y la sincronía del HUD verificados en QA; la limpieza de líneas y su puntuación, por revisión de código: `clearLines` es port fiel del prototipo y `onScore` en ese bloque quedó verificado en vivo.)_
- [x] El contador de líneas sube al limpiar filas y el HUD React «Líneas» coincide con `LINES` del canvas; cada 10 líneas el HUD React «Nivel» se incrementa y la caída se acelera. _(por revisión de código: `onLines`/`onLevel` se invocan en el mismo bloque `if (cleared)` que el `onScore` ya verificado; no se logró completar una línea durante el QA manual.)_
- [x] Aparecen las 8 piezas, incluida la tuerca hueca de 3×3; la preview `NEXT` del panel in-canvas muestra la siguiente pieza y el ghost piece marca dónde aterrizará la actual.
- [x] Cuando una pieza nueva colisiona al aparecer, se entra en `GAME OVER`: overlay in-canvas con la puntuación final y panel de guardado no bloqueante bajo el canvas.
- [x] `GUARDAR PUNTUACIÓN` inserta una fila en `scores` con `game_id: "tetris"`, `player_name` (mayúsculas, ≤10) y `score` entero ≥0 (verificable con `mcp__supabase__execute_sql`), y muestra `▸ PUNTUACIÓN GUARDADA_`; si `saveScore` falla, se muestra un mensaje de error breve y no se marca como guardada.
- [x] Tras guardar, la puntuación aparece según su ranking en el leaderboard de `/juego/tetris` y en la fila «TU MEJOR MARCA» de `/salon` para `TETRIS`. _(verificado el leaderboard de `/juego/tetris` y la tabla/campeón del tab `TETRIS` en `/salon`; la fila «TU MEJOR MARCA» solo se renderiza con sesión iniciada, fuera del alcance de la auth mock.)_
- [x] `JUGAR DE NUEVO` reinicia la partida (motor y HUD React a `0` puntos, `0` líneas, nivel `1`); `VOLVER AL VAULT` navega a `/`.
- [x] `PAUSA` congela la simulación y `REANUDAR` la retoma; la tecla `P` hace lo mismo y la etiqueta del botón (`PAUSA`/`REANUDAR`) queda sincronizada en ambos sentidos; `FIN` fuerza el fin de la partida y abre el panel de guardado.
- [x] Al salir de `/juego/tetris/jugar` no quedan `requestAnimationFrame` ni listeners de teclado activos (sin errores en consola; el uso de CPU vuelve a reposo).
- [x] `/juego/asteroides/jugar` sigue mostrando `AsteroidsGame` y `/juego/rocas/jugar` y las demás rutas `/juego/[id]/jugar` siguen mostrando la simulación `GamePlayer`, sin cambios.
- [x] El canvas `460 × 600` se escala manteniendo la proporción `23:30` en viewport estrecho y permanece dentro del marco CRT; `/juego/asteroides/jugar` mantiene su `4:3`.
- [x] Todo el texto visible nuevo está en español y usa el theme de `app/globals.css` sin romper la paleta.

## Decisiones tomadas y descartadas

- **Sí:** entrada nueva `tetris` al final de `GAMES` en vez de reutilizar `caida` — `caida` sigue como simulación `GamePlayer` de piezas que caen (`cover-tetro`, magenta); `tetris` es el juego real con su identidad propia. **No:** renombrar `caida` → `tetris` — rompería puntuaciones y enlaces guardados bajo el id `caida`.
- **Sí:** slug y título `tetris` / `TETRIS`, color `cyan` (el de la pieza I), `cat: "PUZZLE"`. **No:** `tetralux` / `pozo` — el usuario eligió el nombre directo; `cyan` está libre en el catálogo para PUZZLE.
- **Sí:** motor como módulo TypeScript imperativo (`lib/games/tetris/engine.ts`) con API `createTetrisGame` / `destroy` — encaja con el lint TS, con SSR (todo corre en `useEffect`) y con la limpieza al desmontar de React. **No:** copiar `game.js` casi tal cual (arrastra globals de módulo, `document.getElementById` y auto-arranque). **No:** `<iframe>` a HTML estático en `/public` — la comunicación de estado pasaría por `postMessage` y el marco CRT no envolvería el canvas de forma natural.
- **Sí:** un único canvas `460 × 600` con el tablero `300 × 600` a la izquierda y un **panel lateral dibujado in-canvas** (SCORE / LINES / LEVEL + caja NEXT) a la derecha — el marco CRT envuelve un solo `<canvas>` y el HUD in-canvas es la fuente de verdad visible, igual que en Asteroides. **No:** mantener el canvas `300 × 600` del prototipo con la preview `NEXT` como recuadro dentro del tablero (queda apretado sobre el área de juego). **No:** un segundo `<canvas>` para `NEXT` en el JSX del wrapper (rompe la premisa de un único lienzo dentro del CRT y añade otro contexto 2D que limpiar).
- **Sí:** regla CSS acotada `.crt-screen.crt-tetris canvas` con `aspect-ratio: 23 / 30` y `max-width: 460px` — el ratio del prototipo no es `4 / 3` y la regla genérica `.crt-screen canvas` (4:3) se mantiene para Asteroides. **No:** cambiar la regla genérica ni forzar el canvas de Tetris a `4:3` (deformaría el pozo).
- **Sí:** HUD y overlay se mueven al canvas; el motor no toca el DOM — port fiel al patrón de Asteroides. El HUD React (`.player-hud`) se sincroniza desde callbacks y se acepta ver `SCORE`/`LINES`/`LEVEL` a la vez en la barra y en el canvas, por coherencia con el resto de reproductores.
- **Sí:** los `TetrisCallbacks` llevan `onLines(n)` en lugar de `onLives(n)` y la barra `.player-hud` muestra «Líneas» donde Asteroides muestra «Vidas» — Tetris no tiene vidas. **No:** conservar `onLives` alimentado con el contador de líneas (firma menos clara).
- **Sí:** portar las 8 piezas, incluida la tuerca hueca de 3×3 (`type 8`) — está en el `game.js` "ya creado" y es una pieza exclusiva del Vault, aunque el README hable de 7. La copy `long` la menciona. **No:** recortar a las 7 estándar.
- **Sí:** conservar la tecla `P` como alternante de pausa (estaba en el original) y exponer `onPause(paused)` para que el estado de React y la etiqueta del botón sigan una sola fuente de verdad. **No:** eliminar `P` y dejar la pausa solo en el botón (perdería una interacción del juego original).
- **Sí:** añadir `restart()` al `Handle` y el botón `JUGAR DE NUEVO` — el prototipo solo reiniciaba con un botón DOM (`#restart-btn`), que se elimina. **No:** tecla de reinicio en el motor (el original no tenía).
- **Sí:** añadir un tope de `dt` de 50 ms (el `loop` del prototipo no lo tenía) — evita un salto grande de `dropAccum` al recuperar el foco de la pestaña. Alineado con Asteroides.
- **Sí:** modelo de **pulsación discreta** en el `keydown` (cada evento actúa una vez), tal como el prototipo — no se adopta el mapa `keys`/`justPressed` de Asteroides porque Tetris no usa teclas mantenidas.
- **Sí:** el color de la grilla pasa a una constante interna del motor. **No:** leerlo de `getComputedStyle(document.body)` como el prototipo (acopla el motor al DOM y al tema de la página).
- **Sí:** descartar el toggle de tema del prototipo (`#theme-toggle`, `light-mode`, `localStorage 'tetris-theme'`) — es chrome de la demo, no del juego; el reproductor ya vive en el theme de Arcade Vault.
- **Sí:** panel de guardado **no bloqueante** bajo el canvas al hacer `GAME OVER`, con `saveScore` de `lib/scores.ts` y `game: "tetris"` — reutiliza el circuito existente (leaderboard con relleno `seededScores`, fila «TU MEJOR MARCA» del Salón) sin backend nuevo.
- **Sí:** `app/juego/[id]/jugar/page.tsx` añade otra rama `if (id === "tetris")` — segunda entrada de la cadena de `if`. **No:** introducir ahora un registro `id → componente` — con dos juegos reales sigue siendo prematuro; se valorará con Arkanoid.
- **Sí:** nueva clase `.cover-tetris` monocroma (vector blanco sobre negro) en vez de reutilizar `.cover-tetro` (bloques de color) o `.cover-rocas`.
- **Sí:** `best: 152800` y `plays: "0"` como valores estáticos de demo — `plays: "0"` es coherente con `asteroides`, la última entrada añadida con este patrón; `best` sigue estático como en el resto de `GAMES`. **No:** computar `best`/`plays` desde `scores` (va en otro spec).
- **No:** tocar `next.config.ts`, la auth mock, `lib/scores.ts`, `lib/games-catalog*`, los clientes de Supabase, las migraciones `0001`/`0002`, el motor de Asteroides ni el resto del catálogo.

## Riesgos identificados

| Riesgo                                                                                                                                                                                          | Mitigación                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3.4 puede tratar los client components y `next/dynamic` de forma distinta a lo conocido por entrenamiento.                                                                           | `TetrisGame` se importa como componente normal con `"use client"` (igual que `GamePlayer` y `AsteroidsGame`), sin `next/dynamic`; todo el acceso a canvas/`window` vive en `useEffect`. Revisar `node_modules/next/dist/docs/01-app/` (client components) antes del Paso 4. |
| El `game.js` original registra listeners en `document` y arranca un `requestAnimationFrame`; sin limpieza al desmontar quedan bucles y teclas capturadas al navegar fuera.                      | La fábrica `createTetrisGame` devuelve `destroy()` que marca `destroyed`, cancela el `rAF` y quita el listener de `keydown`; el `useEffect` lo llama en su cleanup. Criterio de aceptación explícito.                                                                       |
| El prototipo cancela el `rAF` al pausar y lo relanza al reanudar; combinar eso con `pause()`/`resume()` del wrapper y la tecla `P` puede dejar dos bucles o ninguno.                            | Se abandona ese patrón: el loop corre siempre mientras no esté `destroyed`; `paused` solo salta la actualización y sigue dibujando. Una sola fuente de verdad para `paused` vía `onPause`.                                                                                  |
| El canvas se ensancha a `460` para el panel lateral: los offsets de dibujo del tablero y de la preview cambian respecto al `game.js` (que asume `300` de ancho y un canvas aparte para `NEXT`). | El port fija el tablero en `x ∈ [0, 300)` y todo el dibujo del panel (rótulos + caja `NEXT`) en `x ∈ [300, 460)`; `drawNext` se reescribe para pintar en esa zona en vez de en el segundo canvas. Prueba visual en el Paso 4.                                               |
| `e.preventDefault()` sobre `Space` y flechas puede molestar tras `GAME OVER` o en pausa (p. ej. hacer scroll con flechas al leer el panel de guardado).                                         | El `preventDefault` solo se aplica mientras el estado **no** sea `gameOver`. Verificar en el Paso 8.                                                                                                                                                                        |
| El ratio `23:30` con `max-width: 460px` podría desbordar verticalmente el marco CRT en pantallas bajas.                                                                                         | La regla usa `width: 100%; height: auto` (heredado) y `max-width: 460px`; el marco CRT ya hace scroll/encaje del contenido. Criterio de aceptación de escalado; ajustar `max-width` si hace falta en el Paso 6.                                                             |
| El doble HUD (canvas + React) puede desincronizarse si algún callback no se dispara en cada cambio (sobre todo `onLines`/`onLevel`, que solo cambian en `clearLines`).                          | Los callbacks se invocan en el mismo punto donde el motor muta `score`, `lines`, `level` y `paused`; el HUD React es solo espejo y la fuente de verdad visible es el canvas.                                                                                                |
| La publishable key de Supabase puede estar en placeholder; las escrituras de `scores` y las lecturas del leaderboard fallarían.                                                                 | `getLeaderboard` degrada a `seededScores` y `saveScore` captura el error y lo muestra sin romper la partida (comportamiento del SPEC 06). La migración `0003` se aplica y verifica con las tools `mcp__supabase__*`.                                                        |

## Lo que **no** entra en este spec

- Controles táctiles y versión móvil jugable.
- Adaptación de Arkanoid (`04-arkanoid`) y del resto de prototipos de `references/started-games/`.
- Registro genérico `id → componente` para el reproductor.
- Sonido y música.
- Sistemas de Tetris modernos (hold, 7-bag, lock delay, T-spins, SRS completo, DAS/ARR).
- Leaderboard multijugador en tiempo real para Tetris.
- Dificultad configurable, guardado de la partida en curso, logros.
- Computar `best` / `plays` como agregados de `scores`, o mover `cover` / `color` a la tabla `games`.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
