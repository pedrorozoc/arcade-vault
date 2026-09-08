-- 0001_games_and_scores — SPEC 06: leaderboard y scores en Supabase
-- Crea el catálogo (games) y las puntuaciones (scores) en el schema public,
-- con RLS: select público en ambas e insert público en scores.
-- Se aplica con mcp__supabase__apply_migration (el proyecto no tiene Supabase CLI).

-- Catálogo de juegos. games.id es el slug estable ya usado en rutas (text, no uuid).
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Puntuaciones. Atribuidas por player_name de texto libre (auth mock, sin user_id).
-- La validación de datos la hacen los CHECK de columna.
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 10),
  score integer not null check (score >= 0 and score <= 100000000),
  created_at timestamptz not null default now()
);

-- Orden del leaderboard: por juego, mejor score primero.
create index scores_game_id_score_idx on public.scores (game_id, score desc);

alter table public.games enable row level security;
alter table public.scores enable row level security;

-- games: solo lectura pública. Sin insert/update/delete — solo las migraciones la modifican.
create policy "games_select_public"
  on public.games
  for select
  to anon, authenticated
  using (true);

-- scores: lectura e inserción públicas (anon + authenticated).
-- Los CHECK de columna acotan player_name (1..10) y score (0..1e8).
create policy "scores_select_public"
  on public.scores
  for select
  to anon, authenticated
  using (true);

create policy "scores_insert_public"
  on public.scores
  for insert
  to anon, authenticated
  with check (true);
