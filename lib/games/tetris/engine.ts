// ===== lib/games/tetris/engine.ts =====
// Motor del juego Tetris. Port fiel de
// `references/started-games/03-tetris/game.js` a un módulo TypeScript con
// ciclo de vida controlable: sin auto-arranque a nivel de módulo, sin
// `document.getElementById`, sin globals de módulo y sin el toggle de tema
// (`#theme-toggle`, `light-mode`, `localStorage 'tetris-theme'`). Toda la
// simulación (canvas, `window`, `requestAnimationFrame`) vive dentro de
// `createTetrisGame`, que registra su listener `keydown` y lo retira en
// `destroy()`.
//
// Diferencias con el prototipo (ver SPEC 07):
//  - Lienzo `460 × 600`: tablero `300 × 600` (10 × 20 celdas de 30 px) a la
//    izquierda y un panel lateral in-canvas (SCORE / LINES / LEVEL + caja
//    NEXT) a la derecha, en `x ∈ [300, 460)`. El motor no toca el DOM.
//  - HUD y overlays (`PAUSA`, `GAME OVER`) dibujados dentro del canvas.
//  - El color de la grilla es una constante interna (el prototipo lo leía de
//    `getComputedStyle(document.body)`).
//  - Tope de `dt` en 50 ms antes de acumular en `dropAccum`.
//  - El loop corre siempre mientras no esté `destroyed`; `paused` solo salta
//    el avance de la simulación y sigue dibujando (se abandona el patrón del
//    prototipo de cancelar el `rAF` al pausar).

export interface TetrisCallbacks {
  onScore(score: number): void;
  onLines(lines: number): void;
  onLevel(level: number): void;
  onPause(paused: boolean): void;
  onGameOver(finalScore: number): void;
  onRestart(): void;
}

export interface TetrisHandle {
  pause(): void;
  resume(): void;
  restart(): void;
  endNow(): void;
  destroy(): void;
}

interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

// ── Constantes del tablero ───────────────────────────────────────────────────
const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const BOARD_W = COLS * BLOCK; // 300
const CANVAS_H = ROWS * BLOCK; // 600
const PANEL_X = BOARD_W; // el panel lateral empieza aquí

// Color de las líneas de grilla (el prototipo lo leía de `--grid-line`).
const GRID_LINE = "rgba(255,255,255,0.08)";

const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
  "#9e9e9e", // N - tuerca (gris metálico)
];

const PIECES: (number[][] | null)[] = [
  null,
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
  [
    [8, 8, 8],
    [8, 0, 8],
    [8, 8, 8],
  ], // N (tuerca hueca de 3×3 — pieza exclusiva del Vault)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

export function createTetrisGame(
  canvas: HTMLCanvasElement,
  callbacks: TetrisCallbacks
): TetrisHandle {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("createTetrisGame: el canvas no expone un contexto 2D");
  }
  const ctx: CanvasRenderingContext2D = context;

  // ── Estado del juego (antes globals de módulo) ────────────────────────────
  let board: number[][] = [];
  let current!: Piece;
  let next!: Piece;
  let score = 0;
  let lines = 0;
  let level = 1;
  let paused = false;
  let gameOver = false;
  let destroyed = false;
  let dropInterval = 1000;
  let dropAccum = 0;
  let lastTime: number | null = null;
  let rafId = 0;

  // ── Input ────────────────────────────────────────────────────────────────
  const PREVENT_CODES = new Set([
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Space",
  ]);

  function onKeyDown(e: KeyboardEvent): void {
    if (destroyed) return;
    // Mientras el juego está montado y NO en `gameOver`, evita el scroll de la
    // página con las flechas y el Espacio (no con `KeyP` / `KeyX`).
    if (!gameOver && PREVENT_CODES.has(e.code)) e.preventDefault();

    if (e.code === "KeyP") {
      togglePause();
      return;
    }
    if (paused || gameOver) return;

    switch (e.code) {
      case "ArrowLeft":
        if (!collide(current.shape, current.x - 1, current.y)) current.x--;
        break;
      case "ArrowRight":
        if (!collide(current.shape, current.x + 1, current.y)) current.x++;
        break;
      case "ArrowDown":
        softDrop();
        break;
      case "ArrowUp":
      case "KeyX":
        tryRotate();
        break;
      case "Space":
        hardDrop();
        break;
    }
  }

  // ── Lógica de tablero y piezas (port de game.js) ─────────────────────────
  function createBoard(): number[][] {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPiece(): Piece {
    const type = Math.floor(Math.random() * 8) + 1;
    const shape = (PIECES[type] as number[][]).map((row) => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function collide(shape: number[][], ox: number, oy: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const nx = ox + c;
        const ny = oy + r;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
        if (ny >= 0 && board[ny][nx]) return true;
      }
    }
    return false;
  }

  function rotateCW(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const result: number[][] = Array.from({ length: cols }, () =>
      new Array(rows).fill(0)
    );
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
    return result;
  }

  function tryRotate(): void {
    const rotated = rotateCW(current.shape);
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (!collide(rotated, current.x + kick, current.y)) {
        current.shape = rotated;
        current.x += kick;
        return;
      }
    }
  }

  function merge(): void {
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          board[current.y + r][current.x + c] = current.shape[r][c];
  }

  function clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((v) => v !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (cleared) {
      lines += cleared;
      score += (LINE_SCORES[cleared] || 0) * level;
      level = Math.floor(lines / 10) + 1;
      dropInterval = Math.max(100, 1000 - (level - 1) * 90);
      // Espejo para React, en el mismo punto donde el motor muta cada valor.
      callbacks.onLines(lines);
      callbacks.onLevel(level);
      callbacks.onScore(score);
    }
  }

  function ghostY(): number {
    let gy = current.y;
    while (!collide(current.shape, current.x, gy + 1)) gy++;
    return gy;
  }

  function hardDrop(): void {
    const gy = ghostY();
    score += (gy - current.y) * 2;
    current.y = gy;
    callbacks.onScore(score);
    lockPiece();
  }

  function softDrop(): void {
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      score += 1;
      callbacks.onScore(score);
    } else {
      lockPiece();
    }
  }

  function lockPiece(): void {
    merge();
    clearLines();
    spawn();
  }

  function spawn(): void {
    current = next;
    next = randomPiece();
    if (collide(current.shape, current.x, current.y)) {
      endGame();
    }
  }

  // ── Dibujo ──────────────────────────────────────────────────────────────
  function drawBlock(
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
    ox = 0,
    oy = 0
  ): void {
    if (!colorIndex) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = COLORS[colorIndex] as string;
    ctx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, size - 2);
    // highlight
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(ox + x * size + 1, oy + y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  function drawGrid(): void {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
  }

  function drawNext(box: { x: number; y: number; w: number; h: number }): void {
    const NB = 24;
    const shape = next.shape;
    const gridPx = 4 * NB;
    const originX = box.x + (box.w - gridPx) / 2;
    const originY = box.y + (box.h - gridPx) / 2;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        drawBlock(offX + c, offY + r, shape[r][c], NB, 1, originX, originY);
  }

  function drawPanel(): void {
    // Divisor tablero / panel.
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PANEL_X + 0.5, 0);
    ctx.lineTo(PANEL_X + 0.5, CANVAS_H);
    ctx.stroke();

    const labelX = PANEL_X + 20;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const stats: [string, string][] = [
      ["SCORE", score.toLocaleString()],
      ["LINES", String(lines)],
      ["LEVEL", String(level)],
    ];
    stats.forEach(([label, value], i) => {
      const y = 44 + i * 66;
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = "12px monospace";
      ctx.fillText(label, labelX, y);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px monospace";
      ctx.fillText(value, labelX, y + 26);
    });

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "12px monospace";
    ctx.fillText("NEXT", labelX, 262);

    const box = { x: PANEL_X + 20, y: 278, w: 120, h: 120 };
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 1;
    ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
    drawNext(box);
  }

  function drawOverlay(title: string, sub: string): void {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(0, 0, BOARD_W, CANVAS_H);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px monospace";
    ctx.fillText(title, BOARD_W / 2, CANVAS_H / 2 - 6);
    if (sub) {
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillText(sub, BOARD_W / 2, CANVAS_H / 2 + 24);
    }
    ctx.restore();
  }

  function draw(): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid();

    // board
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) drawBlock(c, r, board[r][c], BLOCK);

    // ghost
    const gy = ghostY();
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

    // current piece
    for (let r = 0; r < current.shape.length; r++)
      for (let c = 0; c < current.shape[r].length; c++)
        if (current.shape[r][c])
          drawBlock(current.x + c, current.y + r, current.shape[r][c], BLOCK);

    drawPanel();

    if (paused && !gameOver) drawOverlay("PAUSA", "");
    if (gameOver)
      drawOverlay("GAME OVER", `Puntuación: ${score.toLocaleString()}`);
  }

  // ── Ciclo de vida de la partida ─────────────────────────────────────────
  function endGame(): void {
    if (gameOver) return;
    gameOver = true;
    callbacks.onGameOver(score);
  }

  function togglePause(): void {
    if (gameOver) return;
    paused = !paused;
    callbacks.onPause(paused);
  }

  function init(): void {
    board = createBoard();
    score = 0;
    lines = 0;
    level = 1;
    paused = false;
    gameOver = false;
    dropInterval = 1000;
    dropAccum = 0;
    lastTime = null;
    next = randomPiece();
    spawn();
    // Espejo para React: mismo punto donde el motor fija score/lines/level.
    callbacks.onScore(score);
    callbacks.onLines(lines);
    callbacks.onLevel(level);
  }

  function doRestart(): void {
    const wasPaused = paused;
    init();
    if (wasPaused) callbacks.onPause(false);
    callbacks.onRestart();
  }

  // ── Loop principal ─────────────────────────────────────────────────────
  function loop(ts: number): void {
    if (destroyed) return;

    if (paused) {
      // Congela el avance: no se acumula `dt`, pero se sigue dibujando.
      lastTime = ts;
      draw();
      rafId = requestAnimationFrame(loop);
      return;
    }

    const dt = lastTime === null ? 0 : Math.min(ts - lastTime, 50);
    lastTime = ts;

    if (!gameOver) {
      dropAccum += dt;
      if (dropAccum >= dropInterval) {
        dropAccum = 0;
        if (!collide(current.shape, current.x, current.y + 1)) {
          current.y++;
        } else {
          lockPiece();
        }
      }
    }

    draw();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener("keydown", onKeyDown);
  init();
  rafId = requestAnimationFrame(loop);

  return {
    pause(): void {
      if (gameOver || paused) return;
      paused = true;
      callbacks.onPause(true);
    },
    resume(): void {
      if (gameOver || !paused) return;
      paused = false;
      callbacks.onPause(false);
    },
    restart(): void {
      doRestart();
    },
    endNow(): void {
      endGame();
    },
    destroy(): void {
      destroyed = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener("keydown", onKeyDown);
    },
  };
}
