// ===== lib/games-catalog.ts — catálogo leído de Supabase con fallback a GAMES =====
// La tabla `games` guarda title/short/long/cat/sort_order (SPEC 06); cover,
// color, best y plays se resuelven desde el array estático GAMES de
// `lib/data.ts` por `id` (detalle de presentación / valores estáticos, no
// migrados). Toda función degrada a GAMES si Supabase no responde.

import { GAMES, type Game, type GameCategory } from "./data";
import type { Database } from "./supabase/database.types";

type GamesRow = Database["public"]["Tables"]["games"]["Row"];

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

// Catálogo completo (Server Components). Fallback a GAMES ante error o 0 filas.
export async function getCatalog(): Promise<Game[]> {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .order("sort_order");
    if (error || !data || data.length === 0) return GAMES;
    return data.map(mapRow);
  } catch {
    return GAMES;
  }
}

// Un juego por id (Server Components). Fallback a GAMES.find ante error.
export async function getGame(id: string): Promise<Game | null> {
  try {
    const { createClient } = await import("./supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("games")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) return GAMES.find((g) => g.id === id) ?? null;
    return data ? mapRow(data) : null;
  } catch {
    return GAMES.find((g) => g.id === id) ?? null;
  }
}

// Catálogo completo desde el navegador (Client Components). Mismo fallback.
export async function fetchCatalogFromBrowser(): Promise<Game[]> {
  try {
    const { createClient } = await import("./supabase/client");
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
