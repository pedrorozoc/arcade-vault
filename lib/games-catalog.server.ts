// ===== lib/games-catalog.server.ts — catálogo (parte de servidor) =====
// getCatalog y getGame usan `./supabase/server` (→ next/headers), por lo que
// solo pueden importarse desde Server Components. `mapRow` y los tipos se
// reexportan desde `./games-catalog` (parte compartida). Ambas funciones
// degradan a GAMES si Supabase no responde.

import { GAMES, type Game } from "./data";
import { mapRow } from "./games-catalog";
import { createClient } from "./supabase/server";

// Catálogo completo (Server Components). Fallback a GAMES ante error o 0 filas.
export async function getCatalog(): Promise<Game[]> {
  try {
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
