-- 0003_seed_tetris — SPEC 07: fila seed del juego Tetris
-- Añade la entrada `tetris` a public.games con sort_order = 9 (índice siguiente
-- al último de 0002_seed_games). title/short/long/cat copiados de SPEC 07,
-- iguales que la entrada de GAMES en lib/data.ts. cover/color/best/plays no se
-- migran: se resuelven desde el array estático GAMES por id (ver
-- lib/games-catalog.ts). Se aplica con mcp__supabase__apply_migration (el
-- proyecto no tiene Supabase CLI).

insert into public.games (id, title, short, long, cat, sort_order) values (
  'tetris',
  'TETRIS',
  'Rota y encaja tetraminós para completar líneas antes de que la pila alcance el techo.',
  'El puzzle de bloques de siempre, con un giro del Vault: siete piezas clásicas más una tuerca hueca de 3×3 caen sobre un pozo de 10×20. Gíralas con wall kicks, acelera la bajada con soft drop o suéltalas de golpe con hard drop, y limpia hasta cuatro líneas de una vez para multiplicar la puntuación por el nivel. Cada 10 líneas sube el nivel y la caída se acelera sin tregua.',
  'PUZZLE',
  9
);
