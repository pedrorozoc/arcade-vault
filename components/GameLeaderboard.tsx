"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import { subscribe, getMergedLeaderboard } from "@/lib/scores";
import { seededScores, type LeaderboardRow } from "@/lib/data";

// Envuelve una función de cómputo para que devuelva siempre la misma
// referencia mientras el contenido no cambie: useSyncExternalStore exige
// snapshots estables o entra en un bucle de renders.
function useStableRows(compute: () => LeaderboardRow[]): () => LeaderboardRow[] {
  const cacheRef = useRef<{ fingerprint: string; rows: LeaderboardRow[] } | null>(null);
  return useCallback(() => {
    const rows = compute();
    const fingerprint = JSON.stringify(rows);
    if (cacheRef.current && cacheRef.current.fingerprint === fingerprint) {
      return cacheRef.current.rows;
    }
    cacheRef.current = { fingerprint, rows };
    return rows;
  }, [compute]);
}

export default function GameLeaderboard({
  gameId,
  seed,
  count = 10,
}: {
  gameId: string;
  seed: number;
  count?: number;
}) {
  const getSnapshot = useStableRows(
    useCallback(() => getMergedLeaderboard(gameId, seed, count), [gameId, seed, count])
  );
  const getServerSnapshot = useStableRows(useCallback(() => seededScores(seed, count), [seed, count]));
  const rows = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.map((r, i) => (
        <div
          key={`${r.rank}-${r.name}`}
          className={"lb-row" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div style={{ fontSize: 10, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>{r.date}</div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </div>
  );
}
