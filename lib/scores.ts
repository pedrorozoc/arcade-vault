// ===== lib/scores.ts — sesión y puntuaciones persistidas en localStorage =====

import { seededScores, type LeaderboardRow } from "./data";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export interface AvUser {
  name: string;
}

// Notifica cambios de sesión/puntuaciones a quienes lean estos datos con
// useSyncExternalStore (la única forma segura de sincronizar localStorage
// con el render sin disparar la regla react-hooks/set-state-in-effect).
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export interface ScoreEntry {
  game: string; // Game.id
  score: number;
  name: string;
  at: number; // Date.now()
}

// Cachea el objeto parseado por el string crudo de localStorage: getUser()
// se usa como getSnapshot de useSyncExternalStore, que exige una referencia
// estable entre llamadas mientras el valor subyacente no cambie (si no,
// dispara un bucle de renders).
let userCache: { raw: string | null; user: AvUser | null } = { raw: null, user: null };

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

export function getScores(): ScoreEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ScoreEntry[];
  } catch {
    return [];
  }
}

export function saveScore(entry: Omit<ScoreEntry, "at">): void {
  if (typeof window === "undefined") return;
  const scores = getScores();
  scores.push({ ...entry, at: Date.now() });
  window.localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  notify();
}

// Igual que getUser(), se cachea por el contenido crudo de localStorage
// (esta vez de av_user + av_scores) para devolver una referencia estable
// mientras nada haya cambiado, requisito de useSyncExternalStore.
const bestScoreCache = new Map<
  string,
  { userRaw: string | null; scoresRaw: string | null; entry: ScoreEntry | null }
>();

export function getBestScoreFor(gameId: string): ScoreEntry | null {
  if (typeof window === "undefined") return null;
  const userRaw = window.localStorage.getItem(USER_KEY);
  const scoresRaw = window.localStorage.getItem(SCORES_KEY);
  const cached = bestScoreCache.get(gameId);
  if (cached && cached.userRaw === userRaw && cached.scoresRaw === scoresRaw) {
    return cached.entry;
  }

  const user = getUser();
  let entry: ScoreEntry | null = null;
  if (user) {
    const mine = getScores().filter((s) => s.game === gameId && s.name === user.name);
    if (mine.length > 0) {
      entry = mine.reduce((best, s) => (s.score > best.score ? s : best));
    }
  }
  bestScoreCache.set(gameId, { userRaw, scoresRaw, entry });
  return entry;
}

export function formatScoreDate(at: number): string {
  const d = new Date(at);
  const day = String(d.getDate()).padStart(2, "0");
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}/${mon}/${d.getFullYear()}`;
}

export function getMergedLeaderboard(
  gameId: string,
  seed: number,
  count = 12
): LeaderboardRow[] {
  const seeded = seededScores(seed, count);
  const best = getBestScoreFor(gameId);
  if (!best) return seeded;

  const mine: LeaderboardRow = {
    rank: 0,
    name: best.name,
    score: best.score,
    date: formatScoreDate(best.at),
  };

  return [...seeded, mine]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
