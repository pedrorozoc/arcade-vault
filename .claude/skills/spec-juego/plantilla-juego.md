# Plantilla de spec de juego

Esta es la **forma** que el skill `/spec-juego` rellena en la Fase 4. No se copia literal: se
adapta a cada juego, borrando lo que no aplique y concretando cada `<hueco>`.

El header usa **líneas en negrita sueltas** (no blockquote), estado en español, y los mismos
headers de sección que el resto de `specs/` del repo.

---

```markdown
# NN — Juego <TITULO> jugable

**Estado:** Borrador
**Depende de:** SPEC 05, SPEC 06
**Fecha:** <YYYY-MM-DD del Session context>

**Objetivo:** Convertir el prototipo <nombre> de `references/started-games/<carpeta>` en un juego
real de la plataforma: un motor TypeScript portado de `game.js`, un wrapper cliente en
`/juego/<slug>/jugar` con el HUD de React sincronizado y guardado de puntuación, una nueva entrada
`<slug>` en el catálogo y su fila seed en la tabla `games` de Supabase.

## Por qué este spec existe

<1–2 párrafos: qué es el prototipo (canvas puro, un archivo, auto-arranque, globals de `window`),
por qué se porta como módulo con ciclo de vida controlable, y cómo se engancha al circuito de
puntuaciones ya existente (`lib/scores.ts` → tabla `scores` → leaderboard y Salón de la Fama).
Menciona aquí las diferencias notables con Asteroides que resolvió la Fase 3.>

## Alcance

**Dentro:**

- Nueva entrada al final de `GAMES` en `lib/data.ts`: `id: "<slug>"`, `title: "<TITULO>"`,
  `cat: "<ARCADE|PUZZLE|SHOOTER|VERSUS>"`, `color: "<cyan|magenta|yellow|green>"`,
  `cover: "cover-<slug>"`, más `short`, `long`, `best` y `plays` redactados en este spec. El detalle
  `/juego/<slug>` y el reproductor `/juego/<slug>/jugar` quedan cableados por las rutas dinámicas
  existentes.
- Nueva migración `supabase/migrations/000N_seed_<slug>.sql` (archivo nuevo, versionado): un
  `insert into public.games (id, title, short, long, cat, sort_order) values (...)` con
  `sort_order` = <índice siguiente en GAMES>. Se aplica con `mcp__supabase__apply_migration`; el
  `.sql` se commitea.
- Nueva clase CSS `.cover-<slug>` (con `::before` / `::after` si hacen falta) en `app/globals.css`,
  dentro del bloque `/* ===== Cover art generators (pure CSS) ===== */`. <Descripción del arte:
  vector blanco sobre negro, CSS puro, sin imágenes.> No reutiliza `.cover-rocas`.
- Módulo motor `lib/games/<slug>/engine.ts` (TypeScript), port fiel de
  `references/started-games/<carpeta>/game.js`:
  - Portar <clases / funciones principales del prototipo>.
  - Se conservan: <HUD in-canvas, overlay de fin, reinicio con tecla, mecánicas propias — listar>.
  - Se elimina: el auto-arranque a nivel de módulo, el uso de `document.getElementById`, y los
    globals de módulo (pasan a estado interno de la fábrica).
  - API imperativa exportada:

    \`\`\`ts
    export interface <Slug>Callbacks {
    onScore(score: number): void;
    onLives(lives: number): void;
    onLevel(level: number): void;
    onGameOver(finalScore: number): void;
    onRestart(): void;
    // + onWin(): void; // solo si el juego tiene estado terminal de victoria
    }

    export interface <Slug>Handle {
    pause(): void;
    resume(): void;
    restart(): void;
    endNow(): void;
    destroy(): void;
    }

    export function create<Slug>Game(
    canvas: HTMLCanvasElement,
    callbacks: <Slug>Callbacks,
    ): <Slug>Handle;
    \`\`\`

  - Los listeners <`keydown`/`keyup` sobre `window`; `mousemove`/`click` sobre el canvas si aplica>
    se registran dentro de `create<Slug>Game` y se retiran **todos** en `destroy()`. Mientras el
    juego está montado y **no** en estado `gameover`, el motor llama `e.preventDefault()` para las
    teclas de juego (<flechas, Espacio, …>) para que la página no haga scroll.
  - `pause()` congela el avance de la simulación (deja de acumular `dt`) y sigue dibujando;
    `resume()` la reanuda. `restart()` reinicia la partida y dispara `onRestart()`. `endNow()`
    fuerza el estado `gameover` (y su `onGameOver`). `destroy()` cancela el `requestAnimationFrame`
    y quita los listeners.
  - Tope de `dt` en <50> ms.
  - Los callbacks se invocan en el mismo punto donde el motor muta `score`, `lives`, `level` y al
    entrar en `gameover` (una sola vez). El HUD del canvas sigue siendo la fuente de verdad visible.
- Wrapper cliente `components/games/<Slug>Game.tsx` (`"use client"`), que **reemplaza a `GamePlayer`
  solo para este juego**:
  - Recibe `game: Game`. Replica la estructura visual de `GamePlayer`: barra `.player-hud` con
    Jugador / Puntuación / Vidas / Nivel y botones `PAUSA` / `FIN` / `SALIR`; marco `.crt` →
    `.crt-screen` con un `<canvas width={<W>} height={<H>}>` en lugar de `.game-arena`.
  - `useRef` al `<canvas>` y al `Handle`; en un `useEffect` que corre una vez llama
    `create<Slug>Game(canvas, callbacks)` y en el cleanup llama `handle.destroy()`.
  - Estado React: `score`, `lives`, `level`, `over`, `paused`, `saved`, `saving`, `saveError`,
    `nameOverride`. `onScore`→`setScore`, `onLives`→`setLives`, `onLevel`→`setLevel`,
    `onGameOver(final)`→`setScore(final)`+`setOver(true)`, `onRestart`→resetea
    `over`/`saved`/`saveError`/`score`/`lives`/`level`.
  - Nombre del jugador: `useSyncExternalStore(subscribe, () => getUser()?.name ?? null, () => null)`,
    con `nameOverride` editable.
  - Botón `PAUSA` alterna `paused` y llama `handle.pause()` / `handle.resume()`. Botón `FIN` llama
    `handle.endNow()`. `SALIR` es un `Link` a `/juego/<slug>`.
  - Con `over === true`, **panel no bloqueante debajo del canvas** (no el modal `.modal-bd`):
    puntuación final, `input` de iniciales, botón `GUARDAR PUNTUACIÓN` (deshabilitado mientras
    `saving`) que hace `await saveScore({ game: "<slug>", score, name })` en `try/catch`, un
    `▸ PUNTUACIÓN GUARDADA_` tras guardar, un mensaje breve de error si falla (sin marcar `saved`),
    un botón `JUGAR DE NUEVO` que llama `handle.restart()`, y un `Link` `VOLVER AL VAULT` a `/`.
- Selección de componente en `app/juego/[id]/jugar/page.tsx`: renderizar `<<Slug>Game game={game} />`
  cuando `id === "<slug>"`, y el resto de ramas sin cambios. Import normal (sin `next/dynamic`).
- <Solo si el aspect-ratio ≠ 4/3:> Regla CSS para el `<canvas>` dentro de `.crt-screen` en
  `app/globals.css` con el ratio <W:H> del prototipo, sin romper el marco CRT ni sus overlays.

**Fuera:**

- Controles táctiles / botones en pantalla y versión móvil jugable.
- Adaptación de los otros prototipos de `references/started-games/`.
- Un registro genérico `id → componente` para el reproductor (se mantiene la cadena de `if`).
- <Sonido y música, si el prototipo no los trae o se decide dejarlos fuera.>
- Leaderboard multijugador en tiempo real (realtime) para este juego.
- Dificultad configurable, guardado de la partida en curso, logros.
- Modificar `next.config.ts`, la auth mock, el resto del catálogo, `lib/scores.ts`, los clientes de
  Supabase o la migración `0001`.
- Tests automatizados (no hay runner en el proyecto).
- Cambiar `references/started-games/<carpeta>/` (queda como referencia intacta).

## Modelo de datos

Este spec **no introduce claves de `localStorage` nuevas** ni tablas nuevas. Reutiliza `saveScore`
de `lib/scores.ts` con `game: "<slug>"` y el circuito de leaderboard sin cambios.

Estructuras nuevas:

1. Un elemento más en `GAMES` (`lib/data.ts`), con el tipo `Game` ya existente:

   \`\`\`ts
   {
   id: "<slug>",
   title: "<TITULO>",
   short: "<una frase>",
   long: "<2–3 frases>",
   cat: "<ARCADE|PUZZLE|SHOOTER|VERSUS>",
   cover: "cover-<slug>",
   color: "<cyan|magenta|yellow|green>",
   best: <número>,
   plays: "<string>",
   }
   \`\`\`

2. Una fila en `public.games` vía `supabase/migrations/000N_seed_<slug>.sql`:

   \`\`\`sql
   insert into public.games (id, title, short, long, cat, sort_order)
   values ('<slug>', '<TITULO>', '<short>', '<long>', '<CAT>', <índice>);
   \`\`\`

3. Interfaces del motor (`lib/games/<slug>/engine.ts`): `<Slug>Callbacks` y `<Slug>Handle` (ver Alcance).

Convenciones del motor (heredadas de `game.js`): lienzo fijo `<W> × <H>`; origen arriba-izquierda;
velocidades en px/s; <wrap toroidal / colisiones / tamaños / puntos — lo que aplique>;
<nº de vidas>; <invencibilidad al reaparecer, si la hay>.

## Plan de implementación

1. Añadir la entrada `<slug>` al final de `GAMES` en `lib/data.ts`. Prueba: `npm run build` compila;
   `/juego` muestra <N+1> tarjetas; `/juego/<slug>` (detalle) resuelve sin 404 y muestra su leaderboard.
2. Añadir `.cover-<slug>` (y pseudo-elementos si hacen falta) en el bloque de covers de
   `app/globals.css`. Prueba: la tarjeta y la portada de `/juego/<slug>` muestran el arte nuevo;
   `npm run build` compila.
3. Crear `lib/games/<slug>/engine.ts`: portar `game.js` a TypeScript con la fábrica
   `create<Slug>Game(canvas, callbacks)` y el `<Slug>Handle`. Sin auto-arranque, sin
   `document.getElementById`, sin globals de módulo. Conservar HUD in-canvas, overlay de fin,
   <mecánicas propias>, tope de `dt`. Añadir `pause`/`resume`/`restart`/`endNow`/`destroy`, el
   `preventDefault` de las teclas de juego y los disparos de los callbacks. Prueba: `npm run lint` y
   `npm run build` pasan; `import { create<Slug>Game } from "@/lib/games/<slug>/engine"` resuelve.
4. Crear `components/games/<Slug>Game.tsx` (`"use client"`): estructura visual clonada de
   `GamePlayer`, `useRef` + `useEffect` para `create<Slug>Game` / `destroy`, estado espejo de los
   callbacks, panel de guardado no bloqueante. `PAUSA`/`FIN`/`SALIR` y `saveScore({ game: "<slug>",
score, name })`. Prueba manual: `/juego/<slug>/jugar` renderiza sin warnings de hidratación; el
   juego responde a los controles; el HUD React refleja el score/vidas/nivel del motor.
5. Editar `app/juego/[id]/jugar/page.tsx`: `id === "<slug>"` → `<<Slug>Game game={game} />`; resto
   sin cambios. Prueba: `/juego/<slug>/jugar` carga el juego real; las demás rutas siguen igual.
6. <Solo si aspect-ratio ≠ 4/3:> Añadir en `app/globals.css` la regla del `<canvas>` dentro de
   `.crt-screen` con el ratio <W:H>. Prueba: en viewport estrecho el canvas se reduce manteniendo
   proporción y permanece dentro del marco CRT.
7. Crear `supabase/migrations/000N_seed_<slug>.sql` y aplicarla con `mcp__supabase__apply_migration`.
   Commitear el `.sql`. Prueba: `mcp__supabase__execute_sql` con
   `select id, sort_order from games order by sort_order` devuelve la fila nueva con `sort_order`
   correcto; `mcp__supabase__list_migrations` la lista; `mcp__supabase__get_advisors` (security) sin
   hallazgos nuevos.
8. Verificación de punta a punta: `npm run lint`, `npm run build`, `npm run dev` y prueba manual —
   jugar una partida completa en `/juego/<slug>/jugar` hasta el fin, guardar la puntuación, comprobar
   que aparece según su ranking en el leaderboard de `/juego/<slug>` y en la fila «TU MEJOR MARCA» de
   `/salon` para `<TITULO>`; verificar que `PAUSA` congela y `REANUDAR` retoma, que `FIN` fuerza el
   fin, que las teclas de juego no hacen scroll de la página, y que al salir no quedan
   `requestAnimationFrame` ni listeners de teclado activos.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` compila sin errores.
- [ ] `GAMES` incluye una entrada `id: "<slug>"` con `cat: "<CAT>"`, y `/juego` muestra <N+1> tarjetas.
- [ ] `/juego/<slug>` (detalle) muestra la info del juego, la portada `.cover-<slug>` y su
      leaderboard; un `id` inexistente sigue dando 404.
- [ ] `mcp__supabase__list_migrations` incluye `000N_seed_<slug>`; `games` tiene la fila `<slug>`
      con el `sort_order` correcto.
- [ ] `/juego/<slug>/jugar` renderiza un `<canvas>` real dentro del marco CRT, sin warnings de
      hidratación en consola.
- [ ] <Controles: describir en booleano — p. ej. "La nave rota con ←/→ y dispara con Espacio; los
      controles no hacen scroll de la página".>
- [ ] <Mecánica de puntuación: "Destruir <X> suma <N> puntos, y el HUD React «Puntuación» coincide
      con el valor dibujado en el canvas".>
- [ ] <Vidas / fin: "Perder una vida baja el HUD React «Vidas» en 1; con 0 vidas aparece el overlay
      de fin".>
- [ ] <Niveles: "Al <condición> se pasa al siguiente nivel y el HUD React «Nivel» se incrementa".>
- [ ] Al llegar al fin aparece el panel de guardado bajo el canvas con la puntuación final;
      `GUARDAR PUNTUACIÓN` inserta una fila en `scores` con `game_id: "<slug>"` y muestra el aviso.
- [ ] Tras guardar, la puntuación aparece según su ranking en el leaderboard de `/juego/<slug>` y en
      la fila «TU MEJOR MARCA» de `/salon` para `<TITULO>`.
- [ ] `JUGAR DE NUEVO` reinicia la partida (motor y HUD React a cero); `VOLVER AL VAULT` navega a `/`.
- [ ] `PAUSA` congela la simulación y `REANUDAR` la retoma; `FIN` fuerza el fin y abre el panel de guardado.
- [ ] Al salir de `/juego/<slug>/jugar` no quedan `requestAnimationFrame` ni listeners de teclado
      activos (sin errores en consola; el uso de CPU vuelve a reposo).
- [ ] Las demás rutas `/juego/[id]/jugar` siguen mostrando lo de antes sin cambios.
- [ ] <Solo si aplica:> El canvas se escala manteniendo la proporción <W:H> en viewport estrecho y
      permanece dentro del marco CRT.
- [ ] Todo el texto visible nuevo está en español y usa el theme de `app/globals.css` sin romper la paleta.

## Decisiones tomadas y descartadas

- **Sí:** entrada nueva `<slug>` al final de `GAMES` — el juego es una pieza propia identificable.
- **Sí:** motor como módulo TypeScript imperativo (`lib/games/<slug>/engine.ts`) con API
  `create<Slug>Game` / `destroy` — encaja con el lint TS, con SSR (todo corre en `useEffect`) y con
  la limpieza al desmontar de React. **No:** copiar `game.js` casi tal cual (arrastra globals de
  `window`). **No:** `<iframe>` a HTML estático.
- **Sí:** el motor conserva su HUD en canvas y su overlay de fin — port fiel y autocontenido.
- **Sí:** el HUD React (`.player-hud`) se sincroniza desde callbacks del motor — coherencia visual
  con el resto de reproductores.
- **Sí:** panel de guardado **no bloqueante** bajo el canvas, no el modal `.modal-bd`.
- **Sí:** el guardado usa `saveScore` de `lib/scores.ts` con `game: "<slug>"` — reutiliza el
  circuito existente sin backend nuevo.
- **Sí:** `app/juego/[id]/jugar/page.tsx` elige el componente con un condicional por `id`. **No:**
  un registro `id → componente` ahora — prematuro.
- **Sí:** nueva clase `.cover-<slug>` en vez de reutilizar `.cover-rocas`.
- <Decisiones específicas de la Fase 3: cómo se resolvió el HUD en DOM / el segundo canvas / los
  assets / el estado `win` / el input de ratón / el tope de `dt` de este prototipo.>
- **No:** tocar `next.config.ts`, la auth mock, Supabase clients, la migración `0001` ni el resto de juegos.

## Riesgos identificados

| Riesgo                                                                                            | Mitigación                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 16.3.4 puede tratar los client components distinto a lo conocido por entrenamiento.       | Wrapper como componente normal con `"use client"` (igual que `GamePlayer`), sin `next/dynamic`; todo el acceso a canvas/`window` en `useEffect`. Revisar `node_modules/next/dist/docs/01-app/`. |
| El `game.js` original registra listeners en `window` y arranca un `requestAnimationFrame` global. | `create<Slug>Game` devuelve `destroy()` que cancela el `rAF` y quita los listeners; el `useEffect` lo llama en su cleanup. Criterio de aceptación explícito.                                    |
| `e.preventDefault()` sobre las teclas de juego puede molestar tras el fin o en pausa.             | El `preventDefault` solo se aplica mientras el juego está montado y **no** en estado `gameover`.                                                                                                |
| El doble HUD (canvas + React) puede desincronizarse.                                              | Los callbacks se invocan en el mismo punto donde el motor muta `score`, `lives` y `level`; el HUD React es solo espejo.                                                                         |
| <Riesgo específico del prototipo: assets que faltan, carga asíncrona, canvas que desborda, …>     | <Mitigación.>                                                                                                                                                                                   |

## Lo que **no** entra en este spec

- Controles táctiles y versión móvil jugable.
- Adaptación de los otros prototipos de `references/started-games/`.
- Registro genérico `id → componente` para el reproductor.
- <Sonido y música, si aplica.>
- Leaderboard multijugador en tiempo real.
- Dificultad configurable, guardado de la partida en curso, logros.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
```
