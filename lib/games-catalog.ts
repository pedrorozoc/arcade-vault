// ===== lib/games-catalog.ts — catálogo (parte de cliente) con fallback a GAMES =====
// La tabla `games` guarda title/short/long/cat/sort_order (SPEC 06); cover,
// color, best y plays se resuelven desde el array estático GAMES de
// `lib/data.ts` por `id` (detalle de presentación / valores estáticos, no
// migrados). Toda función degrada a GAMES si Supabase no responde.
//
// Las funciones de servidor (getCatalog, getGame) viven en
// `./games-catalog.server` porque importan `./supabase/server` → `next/headers`,
// que no puede entrar en el bundle de los Client Components que consumen
// `fetchCatalogFromBrowser` (Home y /juego).

import { GAMES, type Game, type GameCategory } from "./data";
import { createClient } from "./supabase/client";
import type { Database } from "./supabase/database.types";

export type GamesRow = Database["public"]["Tables"]["games"]["Row"];

// Valores neutros para un `id` que exista en `games` pero no en GAMES.
const NEUTRAL = {
  cover: "cover-bricks",
  color: "cyan" as Game["color"],
  best: 0,
  plays: "0",
};

// Combina una fila de `games` con los campos presentacionales de GAMES.
export function mapRow(row: GamesRow): Game {
  const base = GAMES.find((g) => g.id === row.id);
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as GameCategory,
    cover: base?.cover ?? NEUTRAL.cover,
    color: base?.color ?? NEUTRAL.color,
    best: base?.best ?? NEUTRAL.best,
    plays: base?.plays ?? NEUTRAL.plays,
  };
}

// Catálogo completo desde el navegador (Client Components). Fallback a GAMES
// ante error, `!data` o 0 filas.
export async function fetchCatalogFromBrowser(): Promise<Game[]> {
  try {
    const { data, error } = await createClient()
      .from("games")
      .select("*")
      .order("sort_order");
    if (error || !data || data.length === 0) return GAMES;
    return data.map(mapRow);
  } catch {
    return GAMES;
  }
}
