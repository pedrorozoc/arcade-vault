"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";

import { GAMES, seededScores } from "@/lib/data";
import {
  getBestScoreFor,
  getLeaderboard,
  getUser,
  getVersion,
  subscribe,
  type LeaderboardEntry,
} from "@/lib/scores";

export default function SalonPage() {
  const [tab, setTab] = useState(GAMES[0].id);
  const game = GAMES.find((g) => g.id === tab)!;
  const seed = tab.length * 23 + 7;

  // `version` cambia con cada guardado (notify()): refresca filas y "tu mejor
  // marca" sin recargar la página.
  const version = useSyncExternalStore(subscribe, getVersion, () => 0);

  // Estado inicial determinista → sin mismatch de hidratación. Cuando el juego
  // ya tiene puntuaciones reales, `getLeaderboard` devuelve solo esas (pueden
  // ser menos de 3), así que cada slot del podio se renderiza solo si existe.
  const [rows, setRows] = useState<LeaderboardEntry[]>(() =>
    seededScores(seed, 12)
  );
  const [best, setBest] = useState<LeaderboardEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    getLeaderboard(tab, tab.length * 23 + 7, 12).then((next) => {
      if (!cancelled) setRows(next);
    });
    getBestScoreFor(tab, getUser()?.name ?? null).then((next) => {
      if (!cancelled) setBest(next);
    });
    return () => {
      cancelled = true;
    };
  }, [tab, version]);

  const youRank = best
    ? 1 + rows.filter((r) => r.score > best.score).length
    : null;

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className={"chip" + (tab === g.id ? " active" : "")}
            onClick={() => setTab(g.id)}
          >
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        {rows[1] && (
          <div className="podium-slot silver">
            <div className="rank-num">02</div>
            <div className="name">{rows[1].name}</div>
            <div className="score">
              {rows[1].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{rows[1].date}</div>
          </div>
        )}
        {rows[0] && (
          <div className="podium-slot gold">
            <div
              className="pixel"
              style={{
                fontSize: 9,
                color: "var(--gold)",
                letterSpacing: "0.18em",
              }}
            >
              CAMPEÓN
            </div>
            <div className="rank-num" style={{ fontSize: 36, marginTop: 4 }}>
              01
            </div>
            <div className="name">{rows[0].name}</div>
            <div className="score" style={{ fontSize: 20 }}>
              {rows[0].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{rows[0].date}</div>
          </div>
        )}
        {rows[2] && (
          <div className="podium-slot bronze">
            <div className="rank-num">03</div>
            <div className="name">{rows[2].name}</div>
            <div className="score">
              {rows[2].score.toLocaleString("es-ES")}
            </div>
            <div className="date">{rows[2].date}</div>
          </div>
        )}
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.name + i}
            className={
              "tr" +
              (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")
            }
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
            <div className="pl">{r.name}</div>
            <div className="sc">{r.score.toLocaleString("es-ES")}</div>
            <div className="dt">{r.date}</div>
          </div>
        ))}
        {best && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div
              className="tr you"
              style={{ animationDelay: `${rows.length * 50 + 50}ms` }}
            >
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(youRank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {best.name}
              </div>
              <div
                className="sc"
                style={{
                  color: "var(--yellow)",
                  textShadow: "0 0 6px rgba(245,255,0,0.5)",
                }}
              >
                {best.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{best.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
