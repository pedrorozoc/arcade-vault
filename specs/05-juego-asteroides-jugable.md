# 05 — Juego Asteroides jugable

**Estado:** Implementado
**Depende de:** SPEC 01
**Fecha:** 2026-09-06

**Objetivo:** Convertir el prototipo Asteroides de `references/started-games/02-asteroids` en el primer juego real de la plataforma: un motor TypeScript portado de `game.js`, un wrapper cliente en `/juego/asteroides/jugar` con el HUD de React sincronizado y guardado de puntuación, y una nueva entrada `asteroides` en el catálogo.

## Por qué este spec existe

Hasta ahora el reproductor (`/juego/[id]/jugar`) es una simulación visual (`components/GamePlayer.tsx`): puntuación falsa autoincremental, sin mecánicas. El SPEC 01 dejó los juegos reales explícitamente fuera de alcance, "para specs futuros por juego". Este es el primero de esos specs. El juego ya está escrito como canvas puro en `references/started-games/02-asteroids/game.js` (un solo archivo, sin dependencias, con globals de `window`, `requestAnimationFrame` global y auto-arranque). Adaptarlo significa: envolver esa lógica en un módulo con ciclo de vida controlable, montarlo desde un componente cliente de React que limpie al desmontar, y engancharlo al circuito de puntuaciones existente (`lib/scores.ts` → `av_scores` → leaderboard y Salón de la Fama). El prototipo `game.js` incluye además un power-up de disparo triple y partículas de explosión que su README no menciona; se portan tal cual porque forman parte del juego "ya creado".

## Alcance

**Dentro:**

- Nueva entrada al final de `GAMES` en `lib/data.ts`: `id: "asteroides"`, `title: "ASTEROIDES"`, `cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-asteroides"`, más `short`, `long`, `best` y `plays` redactados en este spec. El grid de `/juego` pasa a 9 tarjetas; el detalle `/juego/asteroides` y el reproductor `/juego/asteroides/jugar` quedan cableados por las rutas dinámicas ya existentes.
- Nueva clase CSS `.cover-asteroides` (con sus pseudo-elementos `::before`/`::after` si hacen falta) en `app/globals.css`, dentro del bloque `/* ===== Cover art generators (pure CSS) ===== */`. Estética vector blanco sobre negro (nave triangular + asteroides poligonales) que evoca el juego real. No reutiliza `.cover-rocas`.
- Módulo motor `lib/games/asteroids/engine.ts` (TypeScript), port fiel de `references/started-games/02-asteroids/game.js`:
  - Portar las clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp` y las funciones `spawnAsteroids`, `initGame`, `nextLevel`, `explode`, `killShip`, `update(dt)`, `draw()`, `loop(ts)`.
  - Se conservan: el HUD dibujado dentro del canvas (`SCORE`, `NIVEL`, iconos de vida, indicador `3x`), el overlay `GAME OVER — ESPACIO PARA REINICIAR`, el reinicio con la tecla Espacio, el power-up de disparo triple, las partículas de explosión, el wrap toroidal, y el tope de `dt` en 50 ms.
  - Se elimina: el auto-arranque a nivel de módulo, el uso de `document.getElementById`, y los objetos globales `keys`/`justPressed` a nivel de módulo (pasan a ser estado interno de la fábrica).
  - API imperativa exportada:

    ```ts
    export interface AsteroidsCallbacks {
      onScore(score: number): void;
      onLives(lives: number): void;
      onLevel(level: number): void;
      onGameOver(finalScore: number): void;
      onRestart(): void;
    }

    export interface AsteroidsHandle {
      pause(): void;
      resume(): void;
      restart(): void;
      endNow(): void;
      destroy(): void;
    }

    export function createAsteroidsGame(
      canvas: HTMLCanvasElement,
      callbacks: AsteroidsCallbacks
    ): AsteroidsHandle;
    ```

  - Los listeners `keydown`/`keyup` se registran sobre `window` dentro de `createAsteroidsGame` y se retiran en `destroy()`. Mientras el juego está montado y **no** en estado `gameover`, el motor llama `e.preventDefault()` para `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight` y `Space`, para que la página no haga scroll.
  - `pause()` congela el avance de la simulación (deja de acumular `dt`); `resume()` la reanuda. `restart()` equivale a `initGame()` y dispara `onRestart()`. `endNow()` fuerza el estado `gameover` (y su `onGameOver`). `destroy()` cancela el `requestAnimationFrame` y quita los listeners.
  - Los callbacks se invocan en el mismo punto donde el motor muta `score`, `lives`, `level` y al entrar en `gameover` (una sola vez). El HUD del canvas sigue siendo la fuente de verdad visible; los callbacks son un espejo para React.
- Wrapper cliente `components/games/AsteroidsGame.tsx` (`"use client"`), que **reemplaza a `GamePlayer` solo para este juego**:
  - Recibe `game: Game`. Replica la estructura visual de `GamePlayer`: barra `.player-hud` con Jugador / Puntuación / Vidas / Nivel y botones `PAUSA` / `FIN` / `SALIR`; marco `.crt` → `.crt-screen` con un `<canvas width={800} height={600}>` en lugar de `.game-arena`.
  - `useRef` al `<canvas>`; en un `useEffect` que corre una vez llama `createAsteroidsGame(canvas, callbacks)` y en el cleanup llama `handle.destroy()`.
  - Estado React: `score`, `lives`, `level`, `over`, `paused`, `saved`, `nameOverride`. `onScore`→`setScore`, `onLives`→`setLives`, `onLevel`→`setLevel`, `onGameOver(final)`→`setScore(final)`+`setOver(true)`, `onRestart`→resetea `over`/`saved`/`score`/`lives`/`level`.
  - Nombre del jugador: igual que `GamePlayer`, `useSyncExternalStore(subscribe, () => getUser()?.name ?? null, () => null)`, con `nameOverride` editable.
  - Botón `PAUSA` alterna `paused` y llama `handle.pause()` / `handle.resume()`. Botón `FIN` llama `handle.endNow()`. `SALIR` es un `Link` a `/juego/asteroides`.
  - Al ser `over === true`, se muestra un **panel no bloqueante debajo del canvas** (no el modal `.modal-bd`): puntuación final, `input` de iniciales (reutilizando estilos existentes), botón `GUARDAR PUNTUACIÓN` que llama `saveScore({ game: "asteroides", score, name })` y pone `saved`, un `▸ PUNTUACIÓN GUARDADA_` tras guardar, un botón `JUGAR DE NUEVO` que llama `handle.restart()`, y un `Link` `VOLVER AL VAULT` a `/`. El reinicio con Espacio del motor sigue disponible y `onRestart` mantiene el panel sincronizado.
- Selección de componente en `app/juego/[id]/jugar/page.tsx`: renderizar `<AsteroidsGame game={game} />` cuando `id === "asteroides"`, y `<GamePlayer game={game} />` en el resto. Import normal (sin `next/dynamic`), igual que hoy con `GamePlayer`.
- Regla CSS mínima en `app/globals.css` para el `<canvas>` dentro de `.crt-screen`: `width: 100%`, `height: auto`, `aspect-ratio: 4 / 3`, `display: block`, sin romper el marco CRT ni sus overlays.

**Fuera:**

- Controles táctiles / botones en pantalla y versión móvil jugable.
- Adaptación de Tetris (`references/started-games/03-tetris`) y Arkanoid (`references/started-games/04-arkanoid`).
- Un registro genérico `id → componente` para el reproductor: se hará cuando haya un segundo juego real.
- Sonido y música.
- Leaderboard multijugador real (Supabase) para Asteroides: sigue siendo `seededScores` + mejor marca local, como el resto.
- Dificultad configurable, guardado de la partida en curso, logros.
- Modificar `next.config.ts`, la autenticación mock, la integración de Supabase o los otros 8 juegos del catálogo.
- Tests automatizados (no hay runner en el proyecto).
- Cambiar `references/started-games/02-asteroids/` (queda como referencia intacta).

## Modelo de datos

Este spec **no introduce claves de `localStorage` nuevas**. Reutiliza `av_scores` vía `saveScore` de `lib/scores.ts` con `game: "asteroides"`, y el circuito de leaderboard (`getMergedLeaderboard`, `getBestScoreFor`) sin cambios.

Estructuras nuevas:

1. Un elemento más en `GAMES` (`lib/data.ts`), con el tipo `Game` ya existente:

   ```ts
   {
     id: "asteroides",
     title: "ASTEROIDES",
     short: "Rota, propulsa y pulveriza rocas en el vacío.",
     long: "Pilota una nave vectorial en un campo de asteroides con bordes toroidales. Dispara para partir las rocas grandes en medianas y las medianas en pequeñas, esquiva los fragmentos y atrapa el power-up de disparo triple. Tres vidas, invencibilidad breve al reaparecer.",
     cat: "SHOOTER",
     cover: "cover-asteroides",
     color: "yellow",
     best: 41200,
     plays: "0",
   }
   ```

2. Interfaces del motor (`lib/games/asteroids/engine.ts`): `AsteroidsCallbacks` y `AsteroidsHandle` (ver Alcance).

Convenciones del motor (heredadas de `game.js`): lienzo fijo `800 × 600`; origen arriba-izquierda; velocidades en px/s; posiciones con wrap toroidal; tamaños de asteroide `1` (pequeño) / `2` (mediano) / `3` (grande); puntos `100 / 50 / 20` por tamaño; 3 vidas; invencibilidad de 3 s al reaparecer.

## Plan de implementación

1. Añadir la entrada `asteroides` al final de `GAMES` en `lib/data.ts`. Prueba: `npm run build` compila; `/juego` muestra 9 tarjetas; `/juego/asteroides` (detalle) resuelve sin 404 y muestra su leaderboard.
2. Añadir `.cover-asteroides` (y pseudo-elementos si hacen falta) en el bloque de covers de `app/globals.css`. Prueba: la tarjeta `ASTEROIDES` en `/juego` y la portada en `/juego/asteroides` muestran el arte nuevo; `npm run build` compila.
3. Crear `lib/games/asteroids/engine.ts`: portar `game.js` a TypeScript con la fábrica `createAsteroidsGame(canvas, callbacks)` y el `AsteroidsHandle`. Sin auto-arranque, sin `document.getElementById`, sin globals de módulo. Conservar HUD in-canvas, overlay `GAME OVER`, reinicio con Espacio, power-up `3x`, partículas, wrap toroidal y `dt` cap 50 ms. Añadir `pause`/`resume`/`restart`/`endNow`/`destroy`, el `preventDefault` de flechas y Espacio, y los disparos de `onScore`/`onLives`/`onLevel`/`onGameOver`/`onRestart`. Revisar antes `node_modules/next/dist/docs/01-app/` sobre client components / efectos si surge alguna duda de API. Prueba: `npm run lint` y `npm run build` pasan; `import { createAsteroidsGame } from "@/lib/games/asteroids/engine"` resuelve.
4. Crear `components/games/AsteroidsGame.tsx` (`"use client"`): estructura visual clonada de `GamePlayer` (barra `.player-hud`, marco `.crt`/`.crt-screen` con `<canvas width={800} height={600}>`, panel de guardado no bloqueante bajo el canvas). `useRef` + `useEffect` para `createAsteroidsGame` / `destroy`. Estado `score`/`lives`/`level`/`over`/`paused`/`saved`/`nameOverride` alimentado por los callbacks. `PAUSA` → `pause`/`resume`; `FIN` → `endNow`; `SALIR` → `/juego/asteroides`. Panel de guardado: `input` de iniciales, `saveScore({ game: "asteroides", score, name })`, `JUGAR DE NUEVO` → `handle.restart()`, `VOLVER AL VAULT` → `/`. Prueba manual: `/juego/asteroides/jugar` renderiza sin warnings de hidratación; la nave rota/propulsa/dispara; los asteroides se parten; el HUD React refleja el score/vidas/nivel del motor.
5. Editar `app/juego/[id]/jugar/page.tsx`: `id === "asteroides"` → `<AsteroidsGame game={game} />`, resto → `<GamePlayer game={game} />`. Prueba: `/juego/asteroides/jugar` carga el juego real; `/juego/rocas/jugar` y los demás siguen mostrando la simulación.
6. Añadir en `app/globals.css` la regla del `<canvas>` dentro de `.crt-screen` (`width:100%`, `height:auto`, `aspect-ratio:4/3`, `display:block`). Prueba: en viewport estrecho el canvas se reduce manteniendo proporción y permanece dentro del marco CRT; el juego se sigue viendo completo.
7. Verificación de punta a punta: `npm run lint`, `npm run build`, `npm run dev` y prueba manual — jugar una partida completa en `/juego/asteroides/jugar` hasta `GAME OVER`, guardar la puntuación, comprobar que aparece según su ranking en el leaderboard de `/juego/asteroides` y en la fila «TU MEJOR MARCA» de `/salon` para `ASTEROIDES`; verificar que `PAUSA` congela y `REANUDAR` retoma, que `FIN` fuerza el fin, que las flechas y Espacio no hacen scroll de la página, y que al salir (`SALIR` o navegación del Nav) no quedan `requestAnimationFrame` ni listeners de teclado activos.

## Criterios de aceptación

- [x] `npm run lint` pasa sin errores.
- [x] `npm run build` compila sin errores.
- [x] `GAMES` incluye una entrada `id: "asteroides"` con `cat: "SHOOTER"`, y `/juego` muestra 9 tarjetas.
- [x] `/juego/asteroides` (detalle) muestra la info del juego, la portada `.cover-asteroides` y su leaderboard; un `id` inexistente sigue dando 404.
- [x] `/juego/asteroides/jugar` renderiza un `<canvas>` real dentro del marco CRT, sin warnings de hidratación en consola.
- [x] La nave rota con `←`/`→`, propulsa con `↑` y dispara con `Espacio`; disparar y rotar no hace scroll de la página.
- [x] Disparar a un asteroide grande lo parte en dos medianos; un mediano en dos pequeños; un pequeño desaparece sin fragmentos.
- [x] La puntuación sube 20 / 50 / 100 según el tamaño destruido, y el HUD React «Puntuación» coincide con el `SCORE` dibujado en el canvas.
- [x] Chocar con un asteroide resta una vida; el HUD React «Vidas» baja en 1; con 0 vidas aparece el overlay `GAME OVER`.
- [x] Al limpiar todos los asteroides se pasa al siguiente nivel y el HUD React «Nivel» se incrementa.
- [x] El power-up `3x` aparece, se recoge al tocarlo y habilita disparo triple temporal (indicador `3x` en el HUD del canvas).
- [x] Al llegar a `GAME OVER` aparece el panel de guardado bajo el canvas con la puntuación final; `GUARDAR PUNTUACIÓN` persiste en `localStorage` (`av_scores`) con `game: "asteroides"` y muestra el aviso de guardado.
- [x] Tras guardar, la puntuación aparece según su ranking en el leaderboard de `/juego/asteroides` y en la fila «TU MEJOR MARCA» de `/salon` para `ASTEROIDES`.
- [x] `JUGAR DE NUEVO` reinicia la partida (motor y HUD React a cero); `VOLVER AL VAULT` navega a `/`.
- [x] `PAUSA` congela la simulación y `REANUDAR` la retoma; `FIN` fuerza el fin de la partida y abre el panel de guardado.
- [x] Al salir de `/juego/asteroides/jugar` no quedan `requestAnimationFrame` ni listeners de teclado activos (sin errores en consola; el uso de CPU vuelve a reposo).
- [x] `/juego/rocas/jugar` y el resto de rutas `/juego/[id]/jugar` siguen mostrando la simulación `GamePlayer` sin cambios.
- [x] El canvas se escala manteniendo la proporción 4:3 en viewport estrecho y permanece dentro del marco CRT.
- [x] Todo el texto visible nuevo está en español y usa el theme de `app/globals.css` sin romper la paleta.

## Decisiones tomadas y descartadas

- **Sí:** entrada nueva `asteroides` al final de `GAMES` en vez de reutilizar `rocas` — el usuario quiere el juego como pieza propia identificable; `rocas` sigue como simulación. **No:** renombrar `rocas` → `asteroides` — rompería puntuaciones y enlaces guardados bajo el id `rocas`.
- **Sí:** motor como módulo TypeScript imperativo (`lib/games/asteroids/engine.ts`) con API `createAsteroidsGame` / `destroy` — encaja con el lint TS, con SSR (todo corre en `useEffect`) y con la limpieza al desmontar de React. **No:** copiar `game.js` casi tal cual (arrastra estilo no idiomático y globals de `window`). **No:** `<iframe>` a HTML estático en `/public` — la comunicación de estado pasaría por `postMessage` y el marco CRT no envolvería el canvas de forma natural.
- **Sí:** el motor conserva su HUD en canvas, su overlay `GAME OVER` y el reinicio con Espacio — port fiel y autocontenido del original.
- **Sí:** el HUD React (`.player-hud`) se mantiene completo y se sincroniza desde callbacks del motor, aceptando que `SCORE` / vidas / nivel se vean a la vez en la barra y en el canvas — mantiene la coherencia visual con el resto de reproductores del arcade.
- **Sí:** panel de guardado **no bloqueante** bajo el canvas al hacer `GAME OVER`, en lugar del modal `.modal-bd` de `GamePlayer` — no tapa el canvas y convive con el reinicio por Espacio del motor.
- **Sí:** el guardado usa `saveScore` de `lib/scores.ts` con `game: "asteroides"` — reutiliza el circuito existente (leaderboard combinado, fila «TU MEJOR MARCA» del Salón) sin backend.
- **Sí:** `app/juego/[id]/jugar/page.tsx` elige el componente con un condicional por `id` — una sola rama. **No:** un registro `id → componente` ahora — prematuro con un único juego real; se añadirá con Tetris y Arkanoid.
- **Sí:** portar el power-up de disparo triple y las partículas — están en el `game.js` "ya creado", aunque el README original no los mencione.
- **Sí:** solo teclado; el canvas 800×600 escala por CSS a 4:3 — coherente con la postura del proyecto (el reproductor era simulación). **No:** botones táctiles en pantalla ni bloquear el juego en móvil — cada uno su propio spec si hace falta.
- **Sí:** nueva clase `.cover-asteroides` en vez de reutilizar `.cover-rocas` — decisión del usuario; arte vector blanco sobre negro que evoca el juego real.
- **No:** tocar `next.config.ts`, la auth mock, Supabase ni los otros 8 juegos.

## Riesgos identificados

| Riesgo                                                                                                                                                                          | Mitigación                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next.js 16.3.4 puede restringir `next/dynamic` con `ssr:false` en Server Components y tratar los client components de forma distinta a lo conocido por entrenamiento.           | `AsteroidsGame` se importa como componente normal con `"use client"` (igual que `GamePlayer`), sin `next/dynamic`; todo el acceso a canvas/`window` vive en `useEffect`. Revisar `node_modules/next/dist/docs/01-app/` (client components) antes del Paso 4. |
| El `game.js` original registra listeners en `window` y arranca un `requestAnimationFrame` global; sin limpieza al desmontar quedan bucles y teclas capturadas al navegar fuera. | La fábrica `createAsteroidsGame` devuelve `destroy()` que cancela el `rAF` y quita los listeners; el `useEffect` lo llama en su cleanup. Criterio de aceptación explícito.                                                                                   |
| `e.preventDefault()` sobre Espacio y flechas puede molestar tras `GAME OVER` o en pausa.                                                                                        | El `preventDefault` solo se aplica mientras el juego está montado y **no** en estado `gameover`. Verificar en el Paso 7.                                                                                                                                     |
| El doble HUD (canvas + React) puede desincronizarse si algún callback no se dispara en cada cambio.                                                                             | Los callbacks se invocan en el mismo punto donde el motor muta `score`, `lives` y `level`; el HUD React es solo espejo y la fuente de verdad visible es el canvas.                                                                                           |
| El canvas fijo 800×600 dentro de `.crt-screen` puede desbordar en móvil.                                                                                                        | Regla CSS `width:100%; height:auto; aspect-ratio:4/3` en el Paso 6; criterio de aceptación de escalado.                                                                                                                                                      |

## Lo que **no** entra en este spec

- Controles táctiles y versión móvil jugable.
- Adaptación de Tetris (`03-tetris`) y Arkanoid (`04-arkanoid`).
- Registro genérico `id → componente` para el reproductor.
- Sonido y música.
- Leaderboard multijugador real (Supabase) para Asteroides.
- Dificultad configurable, guardado de la partida en curso, logros.
- Tests automatizados.

Cada uno de esos, si llega, va en su propio spec.
