"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { seededScores } from "@/lib/data";
import {
  getLeaderboard,
  getVersion,
  subscribe,
  type LeaderboardEntry,
} from "@/lib/scores";

export default function GameLeaderboard({
  gameId,
  seed,
  count = 10,
}: {
  gameId: string;
  seed: number;
  count?: number;
}) {
  // Estado inicial determinista (mismo valor en SSR y en el primer render de
  // cliente) → sin mismatch de hidratación. Se reemplaza por datos reales en
  // el useEffect de abajo.
  const [rows, setRows] = useState<LeaderboardEntry[]>(() =>
    seededScores(seed, count)
  );

  // `version` cambia cada vez que se guarda una puntuación (notify()): fuerza
  // el refetch del leaderboard sin recargar la página.
  const version = useSyncExternalStore(subscribe, getVersion, () => 0);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(gameId, seed, count).then((next) => {
      // Mientras recarga se mantienen las filas previas; solo se sustituyen
      // cuando la respuesta llega y el efecto sigue vigente.
      if (!cancelled) setRows(next);
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, seed, count, version]);

  return (
    <div className="leaderboard">
      <h3>MEJORES PUNTUACIONES</h3>
      {rows.map((r, i) => (
        <div
          key={`${r.rank}-${r.name}`}
          className={
            "lb-row" +
            (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
          }
        >
          <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
          <div className="pl">
            {r.name}
            <div
              style={{
                fontSize: 10,
                color: "var(--ink-faint)",
                letterSpacing: "0.1em",
              }}
            >
              {r.date}
            </div>
          </div>
          <div className="sc">{r.score.toLocaleString("es-ES")}</div>
        </div>
      ))}
    </div>
  );
}
