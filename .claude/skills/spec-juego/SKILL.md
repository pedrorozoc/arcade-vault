---
name: spec-juego
description: Designs a spec for turning a canvas prototype from references/started-games into a playable platform game with its Supabase leaderboard, following the SPEC 05 + SPEC 06 pattern. Asks clarifying questions first, then writes specs/NN-<slug>.md in Draft. Use it when adding a new real game to the arcade.
disable-model-invocation: true
argument-hint: "<nombre del juego o carpeta de references/started-games>"
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), Bash(git status:*)
---

# /spec-juego — Diseñador de specs de juego

## Session context

Fecha de hoy (para el header del spec, nunca la inventes):
!`date +%F`

Specs que ya existen (el número del nuevo spec sale de aquí):
!`ls specs/ 2>/dev/null || echo "La carpeta specs/ no existe todavía"`

Prototipos disponibles para portar:
!`ls references/started-games/ 2>/dev/null || echo "No hay carpeta references/started-games/"`

Motores ya portados:
!`ls lib/games/ 2>/dev/null || echo "No hay carpeta lib/games/ todavía"`

Estado del árbol:
!`git status --short`

---

Este skill produce **un spec en estado Borrador** (`specs/NN-<slug>.md`) para convertir un prototipo
de canvas de `references/started-games/` en un juego real de Arcade Vault con su leaderboard.
Fusiona el alcance de **SPEC 05** (motor TS + wrapper React + catálogo + cover art) y la parte de
**SPEC 06** que aplica a un juego nuevo (una migración seed en la tabla `games`).

**Aquí no escribes código.** Tu trabajo es leer el prototipo y los archivos de referencia,
caracterizar en qué se parece y en qué se diferencia de Asteroides (el caso ya implementado),
resolver esas diferencias con preguntas, y redactar el spec. La implementación es `/spec-impl`.

Responde y redacta **en el idioma del prompt inicial** (español por defecto en este repo).

## Contexto a leer primero

Antes de redactar nada, lee estos archivos para no inventar API ni convenciones. Son la fuente de
verdad del patrón:

- `specs/05-juego-asteroides-jugable.md` — el alcance completo del port de un juego.
- `specs/06-leaderboard-y-scores-en-supabase.md` — el circuito de scores y la forma de la migración seed.
- `lib/games/asteroids/engine.ts` — la forma exacta de la fábrica del motor y su `Handle`. **Refléjala; no la reinventes.**
- `components/games/AsteroidsGame.tsx` — el wrapper cliente que el spec nuevo clona.
- `app/juego/[id]/jugar/page.tsx` — cómo se elige el componente por `id` (cadena de `if`).
- `lib/data.ts` — el tipo `Game` y el array `GAMES` (la entrada nueva va al final).
- `lib/scores.ts` — `saveScore`, `getLeaderboard`, `getBestScoreFor`. **Genérico: no se toca.**
- `app/globals.css` — el bloque `/* ===== Cover art generators (pure CSS) ===== */` y la regla `.crt-screen canvas`.
- `supabase/migrations/0002_seed_games.sql` — la forma del `insert` en `public.games`.
- `references/started-games/<carpeta>/` — el `game.js`, `README.md` y `CLAUDE.md` del prototipo elegido.

Si te surge una duda de API de Next.js (client components, rutas dinámicas, `PageProps`), consulta
`node_modules/next/dist/docs/01-app/` — esta instalación (Next 16.3.4) difiere del training data
(ver `AGENTS.md`).

Convención del repo para specs (mírala en los `.md` de `specs/`, no en plantillas externas):
header con líneas en **negrita sueltas** (no blockquote), estados en español
(`Borrador` / `En revisión` / `Aprobado` / `Implementado` / `Obsoleto`), y headers de sección en
español: `## Alcance` (`**Dentro:**` / `**Fuera:**`), `## Modelo de datos`, `## Plan de implementación`,
`## Criterios de aceptación`, `## Decisiones tomadas y descartadas`, `## Riesgos identificados`,
`## Lo que **no** entra en este spec`.

## Flujo

Cuatro fases más un cierre. No te saltes la Fase 2.

### Fase 1 — Identificar y caracterizar el prototipo

1. Resuelve `$ARGUMENTS` a una carpeta concreta de `references/started-games/` (p. ej. `tetris` →
   `references/started-games/03-tetris`). Si el argumento viene vacío o no casa con ninguna carpeta,
   lista las disponibles del Session context y pregunta cuál.
2. Lee el `game.js`, el `README.md` y el `CLAUDE.md` del prototipo. **Cree al `game.js`, no al
   `CLAUDE.md`** — en estos prototipos el `CLAUDE.md` suele estar desactualizado.
3. Rellena la **Checklist de caracterización** (abajo). El resultado alimenta la Fase 3.

### Fase 2 — Preguntas de aclaración

Usa `AskUserQuestion` en bloques de 3 a 5. Pregunta **solo lo que no se deduce del prototipo**:

- **`id` / slug de ruta y `title`.** El slug es kebab-case, en español, estable (va en la URL
  `/juego/<slug>`, en `game_id` de `scores` y en `cover-<slug>`). No reutilices `rocas`.
- **`cat`.** Uno de `ARCADE` · `PUZZLE` · `SHOOTER` · `VERSUS` **exactos** — es un CHECK de columna
  en la tabla `games`.
- **`color`.** Uno de `cyan` · `magenta` · `yellow` · `green`.
- **`short` y `long`.** Propón tú un texto en español (1 frase / 2–3 frases) a partir del README del
  prototipo y pide confirmación.
- **`best` y `plays`.** Valores estáticos de demo (`best` número, `plays` string). Propón algo
  coherente con el resto de `GAMES`.
- **Arte `.cover-<slug>`.** Nombre de la clase (`cover-<slug>`) y una descripción visual corta
  (vector blanco sobre negro que evoque el juego, sin imágenes, CSS puro). No reutilices `.cover-rocas`.
- **Nombre del componente.** `<Slug>Game` en PascalCase (p. ej. `TetrisGame`).

### Fase 3 — Resolver las diferencias con Asteroides

Por cada punto de la checklist en que el prototipo **difiera** de Asteroides, decide con el usuario
cómo lo aborda el spec y anótalo en `## Decisiones tomadas y descartadas`. Diferencias típicas:

- **Canvas con otro aspect-ratio o más de un canvas** (p. ej. Tetris 300×600 + un canvas de preview).
  El spec debe fijar `width`/`height` del `<canvas>` del wrapper y, si el ratio ≠ `4 / 3`, añadir una
  regla CSS propia en `.crt-screen canvas` (el 4:3 ya existe). Un segundo canvas: decidir si se
  renderiza aparte, dentro del principal, o en React.
- **HUD u overlay en el DOM** (el prototipo hace `getElementById(...).textContent`). El motor portado
  **no** manipula DOM: mueve ese HUD al canvas y usa los callbacks como espejo para React, igual que
  Asteroides.
- **Input de ratón o listeners en el elemento canvas** (no en `window`), `e.key` en vez de `e.code`,
  pulsación discreta en vez de tecla mantenida. El spec describe el modelo de input y exige que
  `destroy()` retire **todos** los listeners.
- **Assets** (spritesheet PNG, audio). Moverlos a `/public`, reescribir el loader con URL pública,
  arreglar rutas de `new Audio()`. Si la carga es asíncrona, el motor expone `onReady` o arranca el
  loop tras el loader. Anota qué asset falta en el prototipo, si alguno.
- **Estado terminal extra** (`win` al completar todos los niveles). Añade un callback propio
  (`onWin`) y su copy en el panel de guardado.
- **Sin reinicio en el motor.** Añádelo: `restart()` en el `Handle` y el botón `JUGAR DE NUEVO` del
  wrapper.
- **Mecánicas de render extra** (ghost piece, preview de siguiente pieza, animación de explosión por
  spritesheet). Enuméralas como trabajo del port.
- **Sin tope de `dt`.** Añade uno (Asteroides usa 50 ms).

### Fase 4 — Redactar el spec

Escribe `specs/NN-<slug>.md` a partir de `plantilla-juego.md` (mismo directorio que este skill):

- `NN` = número más alto de `ls specs/` + 1, con dos dígitos.
- Estado `Borrador`. **No lo marques `Aprobado`** — eso lo hace el usuario tras releerlo.
- `**Depende de:** SPEC 05, SPEC 06`. Comprueba que ambos existan en `specs/`.
- `**Fecha:**` = la fecha del Session context. Nunca inventes una.
- Todo el texto en español, con el theme y las convenciones del repo.
- El `## Alcance` → `**Dentro:**` debe cubrir **todo** lo de "Contenido obligatorio del spec generado".
- El `## Plan de implementación` numerado, cada paso commiteable y con una línea `Prueba:`.
- No metas en el plan nada que no esté en el alcance. Sin TODOs.

Si el usuario cortó la Fase 2 o alguna respuesta quedó vaga, desarrolla las secciones una a una
pidiendo confirmación. Si tienes todo, escribe el spec completo y pasa al cierre sin pedir aprobación
sección por sección.

### Cierre

1. Anuncia la ruta del archivo creado.
2. Recuerda: el spec está en `Borrador`; el usuario lo pasa a `Aprobado` cuando lo haya releído.
3. Siguiente paso: `/spec-impl NN-<slug>`.
4. **Para aquí.** No propongas implementar, ni escribir código, ni nada más.

## Checklist de caracterización del prototipo

Rellena esto en la Fase 1 y úsalo en la Fase 3:

| Aspecto                               | Asteroides (referencia)             | Este prototipo                                         |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| Dimensiones del canvas y aspect-ratio | 800×600, 4:3                        | ?                                                      |
| Nº de canvas                          | 1                                   | ?                                                      |
| Origen del HUD                        | in-canvas                           | ? (in-canvas / DOM a reescribir)                       |
| Overlay de fin / pausa                | texto in-canvas                     | ?                                                      |
| Target de listeners                   | `window`                            | ? (`window` / `document` / canvas)                     |
| API de tecla                          | `e.code`, mantenida + `justPressed` | ?                                                      |
| Ratón                                 | no                                  | ?                                                      |
| Reinicio en el motor                  | sí (tecla Espacio)                  | ?                                                      |
| Estados terminales                    | `playing` / `dead` / `gameover`     | ? (¿`win`?)                                            |
| Assets externos                       | ninguno                             | ? (PNG / audio / mover a `/public`)                    |
| Carga                                 | síncrona                            | ? (¿async? ¿`onReady`?)                                |
| Tope de `dt`                          | 50 ms                               | ?                                                      |
| Mecánicas de render extra             | partículas, power-up `3x`           | ? (ghost / preview / spritesheet)                      |
| Forma de puntuar                      | por tamaño (20/50/100)              | ? — **siempre se reduce a un entero para `saveScore`** |
| Auto-arranque / globals de módulo     | sí (se eliminan al portar)          | ? (se eliminan igual)                                  |

## Contenido obligatorio del spec generado

El `**Dentro:**` del spec tiene que cubrir estas ocho piezas:

1. **Entrada nueva al final de `GAMES` en `lib/data.ts`** con el tipo `Game` existente:
   `id`, `title`, `short`, `long`, `cat`, `cover: "cover-<slug>"`, `color`, `best`, `plays`.
2. **Migración `supabase/migrations/000N_seed_<slug>.sql`** (archivo nuevo, versionado):
   un `insert into public.games (id, title, short, long, cat, sort_order) values (...)` con
   `sort_order` = índice siguiente en `GAMES`. Se aplica con `mcp__supabase__apply_migration`
   (el proyecto no tiene Supabase CLI) y el `.sql` se commitea. Verificación con
   `mcp__supabase__execute_sql`, `mcp__supabase__list_migrations` y `mcp__supabase__get_advisors`.
3. **Clase `.cover-<slug>`** (+ pseudo-elementos `::before` / `::after` si hacen falta) en el bloque
   de covers de `app/globals.css`. Estética vector blanco sobre negro, CSS puro, sin imágenes.
   No reutiliza `.cover-rocas`.
4. **Motor `lib/games/<slug>/engine.ts`** (TypeScript), port fiel del `game.js`:
   - Fábrica `export function create<Slug>Game(canvas: HTMLCanvasElement, callbacks: <Slug>Callbacks): <Slug>Handle`.
   - `<Slug>Callbacks`: `onScore(n)`, `onLives(n)`, `onLevel(n)`, `onGameOver(finalScore)`,
     `onRestart()` — más los que pida la mecánica (p. ej. `onWin()`). Se invocan **en el mismo punto**
     donde el motor muta ese valor y una sola vez al entrar en `gameover`.
   - `<Slug>Handle`: `pause()`, `resume()`, `restart()`, `endNow()`, `destroy()`.
   - Se elimina: auto-arranque a nivel de módulo, `document.getElementById`, globals `keys`/`justPressed`
     de módulo (pasan a estado interno de la fábrica).
   - Se conserva: HUD y overlay dibujados in-canvas (fuente de verdad visible), reinicio con la tecla
     del original si lo tenía, wrap/mecánicas propias.
   - rAF loop con **tope de `dt`**; flags `paused` (congela el avance, sigue dibujando) y `destroyed`
     (corta el loop). `destroy()` cancela el `requestAnimationFrame` y quita **todos** los listeners.
   - Listeners `keydown`/`keyup` (y ratón si aplica) registrados dentro de la fábrica.
     `e.preventDefault()` para las teclas de juego (flechas, Espacio, …) **solo mientras el estado no
     sea `gameover`**, para que la página no haga scroll.
5. **Wrapper `components/games/<Slug>Game.tsx`** (`"use client"`), clon de `AsteroidsGame.tsx`:
   - Recibe `game: Game`. Estructura visual de `GamePlayer`: barra `.player-hud` (Jugador /
     Puntuación / Vidas / Nivel + botones `PAUSA` / `FIN` / `SALIR`) y marco `.crt` → `.crt-screen`
     con `<canvas width={...} height={...}>` (las dimensiones del prototipo).
   - `useRef` al `<canvas>` y al `Handle`; `useEffect(() => { ... }, [])` que llama
     `create<Slug>Game(canvas, callbacks)` y en el cleanup `handle.destroy()`.
   - Estado React espejo: `score`, `lives`, `level`, `over`, `paused`, `saved`, `saving`,
     `saveError`, `nameOverride`. Los callbacks del motor son los setters.
   - Nombre del jugador: `useSyncExternalStore(subscribe, () => getUser()?.name ?? null, () => null)`
     con `nameOverride` editable.
   - `PAUSA` → `pause()` / `resume()`; `FIN` → `endNow()`; `SALIR` → `Link` a `/juego/<slug>`.
   - Con `over === true`, **panel no bloqueante debajo del canvas** (no el modal `.modal-bd`):
     puntuación final, `input` de iniciales, botón `GUARDAR PUNTUACIÓN` (deshabilitado mientras
     `saving`), `saveScore({ game: "<slug>", score, name })` dentro de `try/catch` async, aviso
     `▸ PUNTUACIÓN GUARDADA_` al terminar, mensaje breve de error si falla (sin marcar `saved`),
     botón `JUGAR DE NUEVO` → `handle.restart()`, `Link` `VOLVER AL VAULT` a `/`.
6. **Rama en `app/juego/[id]/jugar/page.tsx`**: `if (id === "<slug>") return <SlugGame game={game} />;`
   antes del `<GamePlayer game={game} />` genérico. Import normal (sin `next/dynamic`). Se conserva
   la firma `PageProps<"/juego/[id]/jugar">` y `getGame` de `@/lib/games-catalog.server`.
7. **Regla CSS del `<canvas>` dentro de `.crt-screen`** en `app/globals.css` **solo si** el
   aspect-ratio del prototipo ≠ `4 / 3` (el 4:3 ya está definido).
8. **Plan de implementación** por pasos commiteables con `Prueba:` en cada uno, **criterios de
   aceptación** booleanos, **decisiones** Sí/No con justificación y **tabla de riesgos**.

## Qué es genérico y no se toca

Estos archivos ya soportan cualquier juego y **el spec no debe modificarlos**:

- `lib/scores.ts` — `saveScore` / `getLeaderboard` / `getBestScoreFor` / `getVersion` / `subscribe`.
- `components/GameLeaderboard.tsx`, `app/salon/page.tsx`.
- `lib/games-catalog.ts` y `lib/games-catalog.server.ts` (`mapRow` toma `cover`/`color`/`best`/`plays`
  de `GAMES` por `id`).
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/database.types.ts`.
- `supabase/migrations/0001_games_and_scores.sql` (tablas, RLS, índice, policies).

El cableado del leaderboard es 100 % genérico porque todo juego puntúa con un **entero** que se pasa
a `saveScore`. `game_id` es `text` libre, así que `database.types.ts` no cambia. La ruta usa una
**cadena de `if` por `id`** — no hay ni se introduce un registry `id → componente`.

## Hard rules

- **Nunca escribas código en este skill.** Solo el `.md` del spec al final.
- **No inventes la API del motor.** Lee `lib/games/asteroids/engine.ts` y refleja su forma
  (`create<X>Game`, `<X>Callbacks`, `<X>Handle`).
- `cat` debe ser **exactamente** uno de `ARCADE` / `PUZZLE` / `SHOOTER` / `VERSUS` (CHECK de columna).
- No toques los archivos de "Qué es genérico y no se toca", ni los otros juegos del catálogo, ni
  `next.config.ts`, ni la auth mock.
- No renombres ni reutilices `rocas` (su `id` ni su `cover`).
- El wrapper es un client component normal con `"use client"` — **sin `next/dynamic`**.
- Estado inicial `Borrador`. Un solo spec por juego. `**Depende de:** SPEC 05, SPEC 06`.
- Todo el texto visible nuevo, en español, con el theme de `app/globals.css`.
- Redacta en el idioma del prompt inicial.

## Arguments

`$ARGUMENTS` es el **nombre del juego o la carpeta de `references/started-games/`** a portar
(p. ej. `/spec-juego tetris` o `/spec-juego 03-tetris`). Si viene vacío, lista las carpetas
disponibles del Session context y pregunta cuál portar.
