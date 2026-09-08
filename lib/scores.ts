// ===== lib/scores.ts — sesión (localStorage) y puntuaciones (Supabase) =====
// La sesión sigue siendo mock: solo un nombre en `av_user` de localStorage.
// Las puntuaciones viven en la tabla `scores` de Supabase (SPEC 06): se
// escriben desde el navegador con la publishable key contra una policy de
// insert público, y se leen en cliente con relleno determinista de
// `seededScores` cuando hay menos filas reales que las pedidas.

import { seededScores } from "./data";
import { createClient } from "./supabase/client";

const USER_KEY = "av_user";

export interface AvUser {
  name: string;
}

// Notifica cambios de sesión/puntuaciones a quienes lean estos datos con
// useSyncExternalStore (la única forma segura de sincronizar estado externo
// con el render sin disparar la regla react-hooks/set-state-in-effect).
type Listener = () => void;
const listeners = new Set<Listener>();

// Contador que `notify()` incrementa en cada cambio. Sirve de getSnapshot
// para useSyncExternalStore en los componentes que deben refetch el
// leaderboard tras un guardado (`getLeaderboard` / `getBestScoreFor` son
// async y no pueden ser el snapshot en sí).
let version = 0;

export function getVersion(): number {
  return version;
}

function notify(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Cachea el objeto parseado por el string crudo de localStorage: getUser()
// se usa como getSnapshot de useSyncExternalStore, que exige una referencia
// estable entre llamadas mientras el valor subyacente no cambie (si no,
// dispara un bucle de renders).
let userCache: { raw: string | null; user: AvUser | null } = {
  raw: null,
  user: null,
};

export function getUser(): AvUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (raw === userCache.raw) return userCache.user;
  let user: AvUser | null = null;
  try {
    user = raw ? (JSON.parse(raw) as AvUser) : null;
  } catch {
    user = null;
  }
  userCache = { raw, user };
  return user;
}

export function setUser(user: AvUser | null): void {
  if (typeof window === "undefined") return;
  if (user === null) {
    window.localStorage.removeItem(USER_KEY);
  } else {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
  notify();
}

// dd/mm/aaaa. Acepta el ISO string de `scores.created_at` además del number
// histórico de Date.now().
export function formatScoreDate(at: string | number): string {
  const d = new Date(at);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/aaaa
}

// Inserta una puntuación en `scores`. Normaliza `name` (mayúsculas, ≤10, o
// "INVITADO" si queda vacío) y `score` (entero ≥0). Si el insert falla,
// relanza el error para que el componente lo muestre.
export async function saveScore(entry: {
  game: string;
  score: number;
  name: string;
}): Promise<void> {
  const player_name =
    entry.name.trim().toUpperCase().slice(0, 10) || "INVITADO";
  const score = Math.max(0, Math.floor(entry.score));

  const { error } = await createClient()
    .from("scores")
    .insert({ game_id: entry.game, player_name, score });

  if (error) throw error;
  notify();
}

// Lee el leaderboard de un juego. Devuelve como mucho `count` filas
// ordenadas por score desc con `rank` recalculado. Si la consulta falla,
// devuelve `seededScores(seed, count)` puro. Si hay menos de `count` filas
// reales, rellena el hueco con `seededScores` y reordena.
export async function getLeaderboard(
  gameId: string,
  seed: number,
  count = 12
): Promise<LeaderboardEntry[]> {
  const { data, error } = await createClient()
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .order("score", { ascending: false })
    .limit(count);

  if (error || !data) return seededScores(seed, count);

  const real: LeaderboardEntry[] = data.map((row, i) => ({
    rank: i + 1,
    name: row.player_name,
    score: row.score,
    date: formatScoreDate(row.created_at),
  }));

  if (real.length >= count) return real;

  return [...real, ...seededScores(seed, count)]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

// Mejor marca de un jugador en un juego. Si `playerName` es null (sin mock
// user) devuelve null sin consultar Supabase.
export async function getBestScoreFor(
  gameId: string,
  playerName: string | null
): Promise<LeaderboardEntry | null> {
  if (playerName === null) return null;

  const { data, error } = await createClient()
    .from("scores")
    .select("player_name, score, created_at")
    .eq("game_id", gameId)
    .eq("player_name", playerName)
    .order("score", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    rank: 0,
    name: row.player_name,
    score: row.score,
    date: formatScoreDate(row.created_at),
  };
}
