"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Game } from "@/lib/data";
import { getUser, saveScore, subscribe } from "@/lib/scores";
import { createTetrisGame, type TetrisHandle } from "@/lib/games/tetris/engine";

// Reproductor real del juego Tetris. Reemplaza a GamePlayer solo para este
// juego: misma estructura visual (barra .player-hud + marco .crt/.crt-screen)
// pero con un <canvas> movido por el motor de lib/games/tetris/engine.ts en
// lugar de la simulación .game-arena. El HUD de React es un espejo de los
// callbacks del motor; la fuente de verdad visible sigue siendo el canvas.
// A diferencia de Asteroides, la barra muestra "Líneas" (Tetris no tiene
// vidas) y el estado `paused` lo fija siempre el callback onPause, sirva la
// tecla P o el botón PAUSA.
export default function TetrisGame({ game }: { game: Game }) {
  const loggedInName = useSyncExternalStore(
    subscribe,
    () => getUser()?.name ?? null,
    () => null
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<TetrisHandle | null>(null);

  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [nameOverride, setNameOverride] = useState<string | null>(null);

  const name = nameOverride ?? loggedInName ?? "INVITADO";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handle = createTetrisGame(canvas, {
      onScore: setScore,
      onLines: setLines,
      onLevel: setLevel,
      onPause: setPaused,
      onGameOver: (finalScore) => {
        setScore(finalScore);
        setOver(true);
      },
      onRestart: () => {
        setOver(false);
        setSaved(false);
        setSaveError(false);
        setScore(0);
        setLines(0);
        setLevel(1);
      },
    });
    handleRef.current = handle;

    return () => {
      handle.destroy();
      handleRef.current = null;
    };
  }, []);

  // El botón solo pide pausar/reanudar al motor; `paused` lo fija onPause
  // (una sola fuente de verdad, sirva la tecla P o el botón).
  const togglePause = () => {
    if (paused) handleRef.current?.resume();
    else handleRef.current?.pause();
  };

  const endGame = () => handleRef.current?.endNow();
  const playAgain = () => handleRef.current?.restart();

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await saveScore({ game: "tetris", score, name });
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Líneas</div>
            <div className="v">{String(lines).padStart(2, "0")}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={togglePause}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juego/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen crt-tetris">
          <canvas ref={canvasRef} width={460} height={600} />
          {paused && !over && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal" style={{ margin: "18px auto 0" }}>
          <h2>FIN DEL JUEGO</h2>
          <div className="final-label">PUNTUACIÓN FINAL</div>
          <div className="final">{score.toLocaleString("es-ES")}</div>
          {!saved ? (
            <>
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setNameOverride(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
              </div>
              {saveError && (
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--magenta)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  ▸ NO SE PUDO GUARDAR. INTÉNTALO DE NUEVO.
                </div>
              )}
            </>
          ) : (
            <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
          )}
          <div className="actions">
            <button className="btn" onClick={playAgain}>
              JUGAR DE NUEVO
            </button>
            <Link href="/" className="btn magenta">
              VOLVER AL VAULT
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
