"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CATS, GAMES, type Game } from "@/lib/data";

// Rango Unicode de marcas diacríticas combinantes (tildes, diéresis, etc.)
// que quedan sueltas tras normalize("NFD"); se construye con fromCodePoint
// para no depender de cómo el editor represente la secuencia de escape.
const DIACRITICS = new RegExp(`[${String.fromCodePoint(0x300)}-${String.fromCodePoint(0x36f)}]`, "g");

function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

function GameCard({ game }: { game: Game }) {
  const colorClass = game.color === "magenta" ? "magenta" : game.color === "yellow" ? "yellow" : "";

  return (
    <Link href={`/juego/${game.id}`} className="card">
      <div className="cover">
        <div className={"cover-bg " + game.cover} />
        <div className="label">{game.cat}</div>
      </div>
      <div className="meta">
        <div className="title">{game.title}</div>
        <div className="desc">{game.short}</div>
        <div className="row">
          <div className="score-badge">
            <span>MEJOR PUNTUACIÓN</span>
            <b>{game.best.toLocaleString("es-ES")}</b>
          </div>
          <span className={"btn " + colorClass}>JUGAR</span>
        </div>
      </div>
    </Link>
  );
}

export default function Biblioteca() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("TODOS");

  const filtered = useMemo(() => {
    return GAMES.filter(
      (g) => (cat === "TODOS" || g.cat === cat) && normalize(g.title).includes(normalize(q))
    );
  }, [q, cat]);

  return (
    <div className="fade-in">
      <section className="av-hero">
        <h1 className="flicker">ARCADE VAULT</h1>
        <div className="sub">
          INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
        </div>
      </section>

      <div className="av-filters">
        <div className="av-search">
          <span className="ico">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar un juego por nombre…"
          />
        </div>
        <div className="av-chips">
          {CATS.map((c) => (
            <button
              key={c}
              className={"chip" + (cat === c ? " active" : "")}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="av-grid">
        {filtered.map((g) => (
          <GameCard key={g.id} game={g} />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 80, color: "var(--ink-faint)" }}>
            <div className="pixel" style={{ fontSize: 14, color: "var(--magenta)", marginBottom: 12 }}>
              NO HAY RESULTADOS
            </div>
            <div>Intenta otra búsqueda o categoría.</div>
          </div>
        )}
      </div>
    </div>
  );
}
