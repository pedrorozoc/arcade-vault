# Juegos implementados — Arcade Vault

Fuente: tabla `public.games` de Supabase (proyecto `gwexvaisrpgtkroxgqvk`), consultada el 2026-09-10.
Hay **10 entradas** en el catálogo. Solo **2 tienen motor real** (Asteroides y Tetris); el resto se juega con el reproductor simulado `GamePlayer`.

## Resumen

| #  | `id`            | Título        | Categoría | Motor real | Puntuaciones en Supabase | Mejor puntuación |
| -- | --------------- | ------------- | --------- | ---------- | ------------------------ | ---------------- |
| 0  | `bloque-buster` | BLOQUE BUSTER | ARCADE    | No         | 0                        | —                |
| 1  | `caida`         | CAÍDA         | PUZZLE    | No         | 0                        | —                |
| 2  | `serpentina`    | SERPENTINA    | ARCADE    | No         | 0                        | —                |
| 3  | `gloton`        | GLOTÓN        | ARCADE    | No         | 0                        | —                |
| 4  | `invasores`     | INVASORES     | SHOOTER   | No         | 0                        | —                |
| 5  | `rocas`         | ROCAS         | SHOOTER   | No         | 0                        | —                |
| 6  | `ranaria`       | RANARIA       | ARCADE    | No         | 0                        | —                |
| 7  | `duelo-pixel`   | DUELO PIXEL   | VERSUS    | No         | 0                        | —                |
| 8  | `asteroides`    | ASTEROIDES    | SHOOTER   | **Sí**     | 1                        | 190              |
| 9  | `tetris`        | TETRIS        | PUZZLE    | **Sí**     | 2                        | 886              |

`sort_order` coincide con la columna `#`. Todas las filas se crearon el 2026-09-08 salvo `tetris`, creada el 2026-09-10.

## Detalle por juego

### 0. BLOQUE BUSTER — `bloque-buster`

- **Categoría:** ARCADE
- **Resumen:** Rebota la pelota y destruye muros de neón.
- **Descripción:** Pilota una nave-paleta y rebota un núcleo de plasma para pulverizar muros de bloques cromáticos. Cada nivel reorganiza la grilla en patrones imposibles. ¿Hasta dónde llegará tu racha?
- **Motor:** simulado (`GamePlayer`). El prototipo por portar vive en `references/started-games/04-arkanoid`.

### 1. CAÍDA — `caida`

- **Categoría:** PUZZLE
- **Resumen:** Encaja las piezas antes de que el techo te aplaste.
- **Descripción:** Piezas geométricas descienden desde la oscuridad. Rótalas, encástralas y limpia líneas para sobrevivir. La velocidad aumenta sin piedad cada 10 líneas.
- **Motor:** simulado (`GamePlayer`). Concepto tipo Tetris previo al juego real `tetris`.

### 2. SERPENTINA — `serpentina`

- **Categoría:** ARCADE
- **Resumen:** Crece sin morder tu propia cola.
- **Descripción:** Una serpiente de luz recorre la grilla buscando núcleos magenta. Cada bocado la alarga y la hace más veloz. Un movimiento en falso y se devora a sí misma.
- **Motor:** simulado (`GamePlayer`).

### 3. GLOTÓN — `gloton`

- **Categoría:** ARCADE
- **Resumen:** Devora puntos y escapa de los fantasmas.
- **Descripción:** Un círculo glotón patrulla un laberinto coleccionando puntos luminosos. Cuatro espectros lo persiguen, pero cada cierto tiempo aparece una píldora que invierte los papeles.
- **Motor:** simulado (`GamePlayer`).

### 4. INVASORES — `invasores`

- **Categoría:** SHOOTER
- **Resumen:** Defiende el planeta de filas alienígenas.
- **Descripción:** Olas de pixeles hostiles descienden formación tras formación. Mueve tu cañón en horizontal y abre fuego con precisión, antes de que toquen la superficie.
- **Motor:** simulado (`GamePlayer`).

### 5. ROCAS — `rocas`

- **Categoría:** SHOOTER
- **Resumen:** Pulveriza asteroides en gravedad cero.
- **Descripción:** Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.
- **Motor:** simulado (`GamePlayer`). Concepto tipo Asteroids previo al juego real `asteroides`.

### 6. RANARIA — `ranaria`

- **Categoría:** ARCADE
- **Resumen:** Cruza la autopista de pixeles.
- **Descripción:** Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llega a los nenúfares antes de que se acabe el tiempo.
- **Motor:** simulado (`GamePlayer`).

### 7. DUELO PIXEL — `duelo-pixel`

- **Categoría:** VERSUS
- **Resumen:** Dos paletas. Una pelota. Reflejos máximos.
- **Descripción:** El duelo más puro: dos paletas verticales se enfrentan por rebotar una pelota luminosa. Modo solitario contra la CPU o partida local a dos jugadores.
- **Motor:** simulado (`GamePlayer`).

### 8. ASTEROIDES — `asteroides` ✅ jugable

- **Categoría:** SHOOTER
- **Resumen:** Rota, propulsa y pulveriza rocas en el vacío.
- **Descripción:** Pilota una nave vectorial en un campo de asteroides con bordes toroidales. Dispara para partir las rocas grandes en medianas y las medianas en pequeñas, esquiva los fragmentos y atrapa el power-up de disparo triple. Tres vidas, invencibilidad breve al reaparecer.
- **Motor:** real — `lib/games/asteroids/engine.ts` + wrapper `components/games/AsteroidsGame.tsx`.
- **Spec:** SPEC 05.
- **Leaderboard:** 1 puntuación registrada, mejor marca 190.

### 9. TETRIS — `tetris` ✅ jugable

- **Categoría:** PUZZLE
- **Resumen:** Rota y encaja tetraminós para completar líneas antes de que la pila alcance el techo.
- **Descripción:** El puzzle de bloques de siempre, con un giro del Vault: siete piezas clásicas más una tuerca hueca de 3×3 caen sobre un pozo de 10×20. Gíralas con wall kicks, acelera la bajada con soft drop o suéltalas de golpe con hard drop, y limpia hasta cuatro líneas de una vez para multiplicar la puntuación por el nivel. Cada 10 líneas sube el nivel y la caída se acelera sin tregua.
- **Motor:** real — `lib/games/tetris/engine.ts` + wrapper `components/games/TetrisGame.tsx`.
- **Spec:** SPEC 07.
- **Leaderboard:** 2 puntuaciones registradas, mejor marca 886.

## Notas

- Las columnas `cover`, `color`, `best` y `plays` **no están en la base de datos**: son presentación y se resuelven desde el array `GAMES` de `lib/data.ts` por `id` en `mapRow`.
- Los `best`/`plays` que aparecen en `lib/data.ts` son valores de maqueta; las cifras reales de leaderboard salen de `public.scores`.
- Prototipo pendiente de portar a juego real: `references/started-games/04-arkanoid` (candidato natural para `bloque-buster`).
