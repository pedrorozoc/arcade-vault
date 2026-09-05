# 01 — Arcade Vault MPP (pantallas del template)

**Estado:** Aprobado
**Depende de:** —
**Fecha:** 2026-09-04

**Objetivo:** Implementar las 5 pantallas del prototipo (Biblioteca, Detalle, Reproductor, Auth y Salón de la Fama) como rutas reales de Next.js App Router, con un catálogo de juegos estático, autenticación mock guardada en localStorage, un reproductor de juego simulado, y puntuaciones persistidas localmente que se combinan con datos ficticios en los distintos leaderboards.

## Alcance

**Dentro:**

- 5 rutas: `/` (Biblioteca), `/juego/[id]` (Detalle), `/juego/[id]/jugar` (Reproductor), `/auth` (Auth), `/salon` (Salón de la Fama).
- Barra de navegación (`Nav`) y footer compartidos en `app/layout.tsx`, visibles en las 5 pantallas, con menú móvil (hamburguesa) y resaltado de ruta activa.
- Catálogo estático de 8 juegos, categorías y jugadores ficticios, portado desde `references/resources/templates/data.jsx` a `lib/data.ts` en TypeScript.
- Autenticación mock: iniciar sesión, crear cuenta e invitado (cualquier usuario/contraseña se acepta), cierre de sesión, sesión persistida en `localStorage` (`av_user`).
- Reproductor de juego simulado: puntuación autoincremental falsa, vidas, nivel, pausa/reanudar, modal de fin de juego con guardado de puntuación (`av_scores` en `localStorage`).
- Combinación de la mejor puntuación real del usuario (`av_scores`) con el leaderboard ficticio sembrado (`seededScores`) en la pantalla de Detalle y en la fila "TU MEJOR MARCA" del Salón de la Fama.
- Reutilización del sistema visual ya existente en `app/globals.css` (neón, CRT, tipografía pixel) sin modificar el theme, salvo ajustes puntuales necesarios para integrar los componentes.

**Fuera:**

- Juegos reales jugables: el reproductor sigue siendo una simulación visual, no se implementan mecánicas reales para ninguno de los 8 juegos del catálogo.
- Backend/API real, base de datos, o validación real de credenciales de usuario.
- Tabla de puntuaciones compartida entre usuarios reales (leaderboard multiplayer real) — los datos de otros jugadores siguen siendo ficticios (`seededScores`).
- Sistema de créditos/monedas funcional — el contador "CRÉDITOS · 03" del Nav sigue siendo decorativo/estático.
- Tests automatizados (no hay test runner configurado en el proyecto).
- Internacionalización o soporte de idiomas distintos al español.

## Modelo de datos

Todo vive en el cliente (sin backend). Se introducen los siguientes módulos y tipos:

**`lib/data.ts`** (portado de `data.jsx`):

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;   // clase CSS de portada (cover-bricks, cover-tetro, ...)
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const GAMES: Game[];
export const CATS: ("TODOS" | GameCategory)[];
export const PLAYERS: string[];

export interface LeaderboardRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export function seededScores(seed: number, count?: number): LeaderboardRow[];
```

**`lib/scores.ts`** (nuevo, no existe en el template):

```ts
export interface AvUser {
  name: string;
}

export interface ScoreEntry {
  game: string;   // Game.id
  score: number;
  name: string;
  at: number;     // Date.now()
}

// localStorage keys: "av_user", "av_scores"
export function getUser(): AvUser | null;
export function setUser(user: AvUser | null): void;

export function getScores(): ScoreEntry[];
export function saveScore(entry: Omit<ScoreEntry, "at">): void;

// Mejor puntuación real guardada por el usuario actual para un juego, o null si no hay.
export function getBestScoreFor(gameId: string): ScoreEntry | null;

// Combina seededScores(gameId) con la mejor puntuación real del usuario actual
// (si existe y su usuario está logueado), insertándola en el ranking por puntuación.
export function getMergedLeaderboard(gameId: string, seed: number, count?: number): LeaderboardRow[];
```

Todas las lecturas de `localStorage` deben ocurrir solo en cliente (dentro de `useEffect` o en manejadores de evento), nunca durante el render inicial en servidor, para evitar mismatches de hidratación.

## Plan de implementación

1. Crear `lib/data.ts` con los tipos y datos portados de `data.jsx` (GAMES, CATS, PLAYERS, `seededScores`).
2. Crear `lib/scores.ts` con las utilidades de `localStorage` descritas arriba (`getUser`/`setUser`, `getScores`/`saveScore`, `getBestScoreFor`, `getMergedLeaderboard`).
3. Crear `components/Nav.tsx` (client component) portado de `nav.jsx`: logo, links Biblioteca/Salón, contador de créditos estático, botón de auth/cerrar sesión, menú móvil; usa `usePathname` para el estado activo y `lib/scores.ts` para leer/escribir `av_user`.
4. Integrar `Nav` y el footer en `app/layout.tsx` para que aparezcan en las 5 rutas.
5. Reemplazar `app/page.tsx` con la pantalla Biblioteca completa (hero + buscador + chips de categoría + grid de tarjetas), usando `lib/data.ts`; cada tarjeta enlaza con `next/link` a `/juego/[id]`.
6. Crear `app/juego/[id]/page.tsx` (Detalle): portado de `detalle.jsx`, usa `notFound()` si el `id` no existe en `GAMES`, muestra el leaderboard combinado (`getMergedLeaderboard`), y el botón "JUGAR AHORA" enlaza a `/juego/[id]/jugar`.
7. Crear `app/juego/[id]/jugar/page.tsx` (Reproductor): client component portado de `reproductor.jsx` (HUD, CRT simulado, pausa, modal de fin de juego); al confirmar guarda la puntuación con `lib/scores.ts`; "SALIR" vuelve a `/juego/[id]`, "VOLVER AL VAULT" vuelve a `/`.
8. Crear `app/auth/page.tsx`: client component portado de `auth.jsx` (tabs iniciar sesión/crear cuenta, invitado, botones sociales decorativos); al enviar guarda `av_user` con `lib/scores.ts` y redirige a `/` con `useRouter`.
9. Crear `app/salon/page.tsx`: portado de `salon.jsx`, tabs por juego, podio, tabla completa, y fila "TU MEJOR MARCA" usando `getBestScoreFor` cuando hay un usuario logueado.
10. Verificar la navegación completa de punta a punta (`npm run lint`, `npm run build`, prueba manual en el navegador) y corregir detalles de hidratación/accesibilidad que surjan.

## Criterios de aceptación

- [ ] `npm run lint` pasa sin errores.
- [ ] `npm run build` compila sin errores.
- [ ] `/` muestra el hero, un buscador que filtra por texto, chips de categoría funcionales, y el grid de las 8 tarjetas de juego.
- [ ] Cada tarjeta navega a `/juego/[id]` con el `id` correcto.
- [ ] `/juego/[id]` muestra la info del juego y su leaderboard; un `id` inexistente devuelve 404.
- [ ] El botón "JUGAR AHORA" en Detalle navega a `/juego/[id]/jugar`.
- [ ] El Reproductor incrementa la puntuación automáticamente, permite pausar/reanudar, y "FIN" abre el modal con la puntuación final.
- [ ] Guardar la puntuación en el modal la persiste en `localStorage` (`av_scores`) y muestra el toast de confirmación.
- [ ] Tras guardar una puntuación, esta aparece reflejada (según su ranking) en el leaderboard de `/juego/[id]` y en la fila "TU MEJOR MARCA" de `/salon` para ese juego.
- [ ] `/auth` permite iniciar sesión con cualquier usuario/contraseña, crear cuenta, o entrar como invitado; tras autenticar redirige a `/`.
- [ ] Con sesión iniciada, el Nav muestra el nombre de usuario y permite cerrar sesión; sin sesión muestra "Iniciar Sesión".
- [ ] La sesión (`av_user`) persiste tras recargar la página.
- [ ] `/salon` muestra el podio (2º/1º/3º) y la tabla completa para cada uno de los 8 juegos, cambiando de juego con los tabs.
- [ ] El menú móvil (hamburguesa) funciona en viewport angosto en las 5 pantallas.
- [ ] Las 5 pantallas están en español y usan el theme visual existente sin romper la paleta de `app/globals.css`.

## Decisiones tomadas y descartadas

- **Rutas reales de Next.js App Router** en vez de una SPA con enrutamiento por hash (como en `app.jsx`) — coincide con las carpetas ya creadas (`app/auth`, `app/juego/[id]`, `app/salon`) y con las convenciones del App Router; habilita deep-linking real.
- **El Reproductor sigue siendo una simulación**, no un juego real — implementar motores reales para los 8 juegos excede el alcance de un MPP; queda para specs futuros por juego.
- **Auth mock sin backend** — el proyecto no tiene API ni base de datos todavía; validar credenciales reales requeriría su propio spec de backend.
- **Las puntuaciones combinan datos reales (`av_scores`) con datos ficticios sembrados (`seededScores`)** — cierra el ciclo de juego para el usuario (jugar → guardar → verse reflejado) sin necesitar un backend de leaderboard compartido.
- **`/juego/[id]/jugar` anidado bajo `/juego/[id]`** en vez de una ruta independiente `/jugar/[id]` — refleja la relación jerárquica detalle → juego y coincide con la carpeta `app/juego/[id]` ya existente.
- **Nav y footer viven en `app/layout.tsx`** como client component — evita duplicar la barra en cada pantalla y centraliza el estado de sesión y del menú móvil.
- **El contador de créditos ("CRÉDITOS · 03") se mantiene estático/decorativo** — no hay sistema de monedas funcional en el alcance de este MPP.

## Riesgos identificados

- Leer `localStorage` durante el render puede causar un mismatch de hidratación entre servidor y cliente; se debe leer `av_user`/`av_scores` únicamente dentro de efectos de cliente (`useEffect`) o manejadores de evento, nunca en el cuerpo del componente durante el render inicial.
- Los `id` de juego (`bloque-buster`, `caida`, etc.) se usan como parámetro de ruta dinámica; si en el futuro cambian sin actualizar los enlaces guardados, las puntuaciones asociadas en `localStorage` quedarían huérfanas bajo un `id` antiguo.
- Next.js 16.3.4 puede tener APIs y convenciones distintas a las conocidas por entrenamiento (ver `AGENTS.md`) — antes de implementar `notFound()`, rutas dinámicas anidadas y el layout compartido, revisar `node_modules/next/dist/docs/01-app/` para confirmar la convención vigente.
