# 02 — Home landing y biblioteca en /juego

**Estado:** Implementado
**Depende de:** SPEC 01
**Fecha:** 2026-09-05

**Objetivo:** Mover la biblioteca de juegos de `/` a `/juego` bajo el menú «Biblioteca» y crear una nueva página de inicio (landing) en `/` bajo un nuevo menú «Inicio», portada desde `references/resources/templates/home-about/home.jsx` y su CSS, excluyendo la sección «Acerca de».

## Por qué este spec existe

En el SPEC 01, la ruta `/` quedó ocupada por la Biblioteca (catálogo de juegos). El prototipo tiene además una landing propia (`home.jsx`) pensada para ser la cara pública del sitio: hero grande, propuesta de valor, preview de juegos, stats, actividad y precios. Este spec separa las dos cosas: la Biblioteca pasa a su propia URL (`/juego`) y `/` se reserva para la landing. La parte «Acerca de» del mismo template queda fuera y se hará en un spec posterior.

## Alcance

**Dentro:**

- Mover la Biblioteca actual de `app/page.tsx` a `app/juego/page.tsx` **sin cambios** en su contenido (hero «ARCADE VAULT», buscador, chips de categoría, grid de 8 tarjetas, `normalize`, `GameCard`). Sigue siendo client component.
- Nueva landing en `app/page.tsx`, portada de `references/resources/templates/home-about/home.jsx`, con las 7 secciones del template: HERO (con `FloatingSilhouettes`), «¿Por qué Arcade Vault?» (grid de features), «Juegos disponibles ahora» (preview), STATS, «Actividad en vivo» (últimas puntuaciones + top jugadores), PRECIOS (plan $0 + FAQ) y CTA final.
- Efecto reveal-on-scroll (`useReveal` con `IntersectionObserver`) y sub-componentes `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`.
- La sección «Juegos disponibles ahora» usa `GAMES.slice(0, 6)` de `lib/data.ts` y cada `MiniCard` enlaza con `next/link` a `/juego/[id]`.
- CTAs de la landing con `next/link`: «Explorar juegos» / «Ver todos los juegos» / «Insertar moneda» → `/juego`; «Crear cuenta» / «Empezar gratis» → `/auth`; «Ver salón» → `/salon`.
- Portar a `app/globals.css` los estilos de home del `styles.css` del template: el bloque `/* ===== HOME PAGE ===== */` y también los bloques `/* ===== ACTIVITY (leaderboard + ticker) ===== */` y `/* ===== PRICING ===== */` (ver desviación registrada en Decisiones).
- Actualizar `components/Nav.tsx`: añadir enlace «Inicio» (→ `/`) como primero, repuntar «Biblioteca» a `/juego`, ajustar el resaltado de ruta activa, y replicar «Inicio» en el panel móvil.

**Fuera:**

- Página y sección «Acerca de» (`about.jsx` y el bloque `/* ===== ABOUT PAGE ===== */` del `styles.css`): se hará en un spec posterior.
- Datos reales en «Actividad en vivo», STATS y PRECIOS: se portan como contenido ficticio estático del template.
- Redirección de la `/` antigua o alias `/biblioteca` → `/juego`: no se implementa.
- Rediseño o ajuste visual de la Biblioteca: se mueve tal cual.
- Backend, API, base de datos o tests automatizados (no hay test runner en el proyecto).

## Modelo de datos

Este spec no introduce nuevas estructuras de datos persistidas. Reutiliza `GAMES` de `lib/data.ts` (SPEC 01) para el preview de juegos de la landing.

Los datos de las secciones «Actividad en vivo», STATS y PRECIOS se portan como **constantes locales ficticias** dentro de `app/page.tsx` (arrays literales, tal como aparecen en `home.jsx`). No se crea ningún módulo nuevo en `lib/` ni se leen/escriben claves de `localStorage`.

## Plan de implementación

1. Crear `app/juego/page.tsx` moviendo el contenido actual de `app/page.tsx` (Biblioteca) tal cual: `"use client"`, `normalize`, `DIACRITICS`, `GameCard`, hero, buscador, chips y grid. Borrar ese contenido de `app/page.tsx` (queda como paso 3). Prueba manual: `/juego` muestra la Biblioteca; `/juego/[id]` y `/juego/[id]/jugar` siguen funcionando; un `id` inexistente devuelve 404.
2. Portar el bloque CSS de home a `app/globals.css`: copiar de `references/resources/templates/home-about/styles.css` todo lo que va desde `/* ===== HOME PAGE ===== */` (`.home`, `.home-hero`, `.home-silos`, `.feature-*`, `.mini-*`, `.home-stats`, `.home-final`, `.reveal`) hasta antes de `/* ===== ABOUT PAGE ===== */`, incluyendo sus `@media` y `@keyframes` (`float`, `bounce`). **Desviación aplicada durante la implementación:** los estilos de dos de las 7 secciones (`/* ===== ACTIVITY (leaderboard + ticker) ===== */` y `/* ===== PRICING ===== */`) viven más abajo en `styles.css`, después de los bloques `ABOUT PAGE`, `GAMEPAD` y `Theme variants`; también se portan (sin los bloques intermedios, que son de la página «Acerca de»). Antes de pegar, comparar con `app/globals.css` y omitir o renombrar cualquier selector o `@keyframes` ya existente para no redefinirlo. **No** portar el bloque `/* ===== ABOUT PAGE ===== */` ni `/* ===== GAMEPAD ===== */` ni `/* ===== Theme variants ===== */`. Prueba: `npm run build` compila.
3. Reemplazar `app/page.tsx` con la landing portada de `home.jsx`: client component con el hook `useReveal` (registrando el `IntersectionObserver` dentro de `useEffect`), los sub-componentes `FloatingSilhouettes`, `FeatureIcon`, `MiniCard`, y las 7 secciones. La sección «Juegos disponibles ahora» itera `GAMES.slice(0, 6)` de `lib/data.ts` y cada `MiniCard` es un `next/link` a `/juego/${g.id}`. El ticker de actividad, el top de jugadores, las stats y el FAQ de precios van como constantes locales ficticias. Sustituir los `navigate({...})` del template por `next/link` (o `useRouter`) según el mapeo de CTAs del Alcance. Prueba manual: `/` renderiza las 7 secciones sin warnings de hidratación.
4. Actualizar `components/Nav.tsx`: añadir `<Link href="/">Inicio</Link>` como primer enlace (antes de «Biblioteca»); cambiar el `href` de «Biblioteca» a `/juego`; ajustar `isActive` para que la sección «inicio» esté activa solo cuando `pathname === "/"` y «biblioteca» cuando `pathname === "/juego" || pathname.startsWith("/juego/")`. Replicar el enlace «Inicio» en el panel móvil (`av-mobile-panel`). El logo sigue apuntando a `/`. Prueba manual: el orden del menú es «Inicio», «Biblioteca», «Salón de la Fama»; el resaltado activo es correcto en cada ruta.
5. Verificación de punta a punta: `npm run lint`, `npm run build`, y prueba manual en el navegador de la navegación Inicio ↔ Biblioteca ↔ Detalle ↔ Reproductor ↔ Salón ↔ Auth (incluido el menú móvil). Corregir detalles de hidratación y accesibilidad que surjan.

## Criterios de aceptación

- [x] `npm run lint` pasa sin errores.
- [x] `npm run build` compila sin errores.
- [x] `/` muestra la nueva landing con las 7 secciones: hero, «¿Por qué Arcade Vault?», «Juegos disponibles ahora», stats, «Actividad en vivo», precios y CTA final.
- [x] `/juego` muestra la Biblioteca (hero «ARCADE VAULT», buscador que filtra por texto, chips de categoría funcionales, grid de las 8 tarjetas), idéntica a como estaba en `/`.
- [x] Cada tarjeta de `/juego` navega a `/juego/[id]` con el `id` correcto.
- [x] `/juego/[id]` (Detalle) y `/juego/[id]/jugar` (Reproductor) siguen funcionando; un `id` inexistente devuelve 404.
- [x] En la landing, «Juegos disponibles ahora» muestra 6 juegos reales de `lib/data.ts` y cada uno enlaza a `/juego/[id]`.
- [x] Los CTAs de la landing navegan: «Explorar juegos» / «Ver todos los juegos» / «Insertar moneda» → `/juego`; «Crear cuenta» / «Empezar gratis» → `/auth`; «Ver salón» → `/salon`.
- [x] El efecto reveal-on-scroll anima las secciones al entrar en el viewport.
- [x] El Nav muestra, en orden: «Inicio», «Biblioteca», «Salón de la Fama»; no aparece «Acerca de».
- [x] «Inicio» se resalta como activo solo en `/`; «Biblioteca» se resalta en `/juego`, `/juego/[id]` y `/juego/[id]/jugar`.
- [x] El enlace «Inicio» también aparece en el menú móvil (hamburguesa) y navega a `/`.
- [x] El logo del Nav navega a `/`.
- [x] No hay warnings de hidratación en la consola al cargar `/` ni `/juego`.
- [x] La landing está en español y usa el theme visual existente sin romper la paleta de `app/globals.css`.

## Decisiones tomadas y descartadas

- **Sí:** la Biblioteca se mueve a `/juego` como `app/juego/page.tsx` (segmento estático índice) conviviendo con `app/juego/[id]/page.tsx` — el usuario pidió esa URL explícitamente y el App Router soporta índice estático + hijo dinámico en la misma carpeta.
- **Sí:** la Biblioteca se mueve tal cual, sin tocar su hero ni su contenido — es una reubicación de ruta, no un rediseño.
- **No:** redirect de la `/` antigua ni alias `/biblioteca` → `/juego` — no hay usuarios externos con enlaces guardados; `/` pasa a ser la landing y el menú «Biblioteca» y los CTAs de la landing llevan a `/juego`.
- **Sí:** portar las 7 secciones del template completas, con datos ficticios estáticos en «Actividad en vivo», STATS y PRECIOS — coherente con cómo el SPEC 01 trató el reproductor como simulación visual.
- **Sí:** solo «Juegos disponibles ahora» usa datos reales (`GAMES` de `lib/data.ts`) y enlaza a `/juego/[id]` — cierra el paso landing → detalle sin necesitar backend.
- **No:** «Actividad en vivo» con puntuaciones reales de `localStorage` (`av_scores`) — más trabajo y el dato entre usuarios sigue siendo ficticio, igual que en SPEC 01.
- **No:** página ni sección «Acerca de», ni el bloque CSS `/* ABOUT PAGE */` del template — excluidos explícitamente por el usuario; se harán en un spec posterior.
- **Sí:** el CSS de home vive en `app/globals.css` (append del bloque del template) — mismo patrón que el resto del sistema visual del proyecto; no hay CSS Modules ni `tailwind.config`.
- **Desviación (autorizada en implementación):** el Paso 2 acotó el copiado de CSS a «hasta antes de `/* ABOUT PAGE */`», pero en `styles.css` los bloques `ACTIVITY` y `PRICING` están situados después de ese marcador (tras `ABOUT PAGE`, `GAMEPAD` y `Theme variants`). Ceñirse al rango literal habría dejado las secciones «Actividad en vivo» y «Precios» sin estilos, contradiciendo el Alcance y los criterios de aceptación. Se optó por portar también esos dos bloques. Sin colisiones con `globals.css`. Los bloques intermedios (`GAMEPAD`, `Theme variants`) y `ABOUT PAGE` no se portaron.
- **Sí:** la landing es client component (`"use client"`) — usa `IntersectionObserver` (`useReveal`) y estado; mismo patrón que la Biblioteca actual.
- **Orden del Nav «Inicio» → «Biblioteca» → «Salón de la Fama»** — «Inicio» es la nueva raíz del sitio y va primero.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `app/juego/page.tsx` (índice estático) junto a `app/juego/[id]/page.tsx` (dinámico) podría comportarse distinto en Next.js 16.3.4 respecto a lo conocido por entrenamiento. | Revisar `node_modules/next/dist/docs/01-app/` (routing) antes de crear la ruta; verificar en `npm run build` que ambas rutas se generan sin conflicto. |
| El bloque CSS de home del template puede duplicar o redefinir selectores y `@keyframes` (`float`, `bounce`, `.reveal`) ya presentes en `app/globals.css`. | Al portar, comparar contra `globals.css` y omitir o renombrar cualquier colisión; validar con `npm run build` y revisión visual. |
| `useReveal` con `IntersectionObserver` corre solo en cliente; sin `"use client"` o fuera de `useEffect` fallaría el render en servidor. | La landing lleva `"use client"` y el observer se registra dentro de `useEffect` con su cleanup. |
| Enlaces o bookmarks que apunten a `/` esperando la Biblioteca quedarán ahora en la landing. | Aceptado: no hay usuarios externos; el menú «Biblioteca» y los CTAs de la landing redirigen a `/juego`. |
