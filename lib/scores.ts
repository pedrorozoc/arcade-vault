// ===== lib/scores.ts — sesión y puntuaciones persistidas en localStorage =====

import { seededScores, type LeaderboardRow } from "./data";

const USER_KEY = "av_user";
const SCORES_KEY = "av_scores";

export interface AvUser {
  name: string;
}

export interface ScoreEntry {
  game: string; // Game.id
  score: number;
  name: string;
  at: number; // Date.now()
}

export function getUser(): AvUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AvUser;
  } catch {
    return null;
  }
}

export function setUser(user: AvUser | null): void {
  if (typeof window === "undefined") return;
  if (user === null) {
    window.localStorage.removeItem(USER_KEY);
  } else {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
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
}

export function getBestScoreFor(gameId: string): ScoreEntry | null {
  const user = getUser();
  if (!user) return null;
  const mine = getScores().filter(
    (s) => s.game === gameId && s.name === user.name
  );
  if (mine.length === 0) return null;
  return mine.reduce((best, s) => (s.score > best.score ? s : best));
}

function formatDate(at: number): string {
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
    date: formatDate(best.at),
  };

  return [...seeded, mine]
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
