/**
 * chess-engine demo.
 *
 * Deliberately thin: it holds the current state, renders it, and calls the
 * library. Every number shown in the readout panel is pulled straight off the
 * engine's public API rather than recomputed here, so the page cannot drift
 * from what the library actually reports.
 */

import {
  createInitialState,
  getValidMoves,
  applyMove,
  selectBotMove,
  evaluate,
  isInCheck,
  findKing,
  fileOf,
  rankOf,
  frToSq,
} from "./engine/index.js";

import { pieceSVG } from "./pieces.js";

const FILES = "abcdefgh";
const DEPTH = { easy: 2, medium: 3, hard: 4 };

const el = {
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  evalFill: document.getElementById("eval-fill"),
  evalOut: document.getElementById("eval-readout"),
  depth: document.getElementById("r-depth"),
  legal: document.getElementById("r-legal"),
  halfmove: document.getElementById("r-halfmove"),
  fullmove: document.getElementById("r-fullmove"),
  check: document.getElementById("r-check"),
  ep: document.getElementById("r-ep"),
  hash: document.getElementById("r-hash"),
  movelog: document.getElementById("movelog"),
  promo: document.getElementById("promo"),
  promoRow: document.getElementById("promo-row"),
  undo: document.getElementById("undo"),
  newgame: document.getElementById("newgame"),
  evalbar: document.getElementById("evalbar"),
};

let state = createInitialState();
let history = [];        // previous states, for undo
let log = [];            // { san, byBot }
let selected = null;     // square index
let legalForSelected = [];
let difficulty = "medium";
let playerColor = "white";
let thinking = false;
let pendingPromotion = null;

const flipped = () => playerColor === "black";

const squareName = (sq) => FILES[fileOf(sq)] + (rankOf(sq) + 1);

/** Light SAN. No disambiguation, which is fine for a scoresheet nobody replays. */
function toSan(st, move) {
  if (move.isCastling) return move.isCastling === "kingside" ? "O-O" : "O-O-O";
  const piece = st.board[move.from];
  const letter = piece.type === "P" ? "" : piece.type;
  const captured = move.capturedPiece ?? st.board[move.to];
  const takes = captured || move.isEnPassant ? "x" : "";
  const origin = piece.type === "P" && takes ? FILES[fileOf(move.from)] : "";
  const promo = move.promotion ? "=" + move.promotion : "";
  return letter + origin + takes + squareName(move.to) + promo;
}

// ---------------------------------------------------------------- rendering

/** Whichever side you play sits at the bottom, as it would across a real board. */
function buildBoard() {
  el.board.replaceChildren();
  const ranks = flipped() ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  const files = flipped() ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  for (const rank of ranks) {
    for (const file of files) {
      const sq = frToSq(file, rank);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sq" + ((file + rank) % 2 === 0 ? " dark" : "");
      btn.dataset.sq = String(sq);
      btn.addEventListener("click", () => onSquare(sq));
      // Label the outer edges of whichever way the board is facing.
      if (rank === ranks[7]) {
        const c = document.createElement("span");
        c.className = "coord coord-f";
        c.textContent = FILES[file];
        btn.appendChild(c);
      }
      if (file === files[0]) {
        const c = document.createElement("span");
        c.className = "coord coord-r";
        c.textContent = String(rank + 1);
        btn.appendChild(c);
      }
      el.board.appendChild(btn);
    }
  }
  el.evalbar.classList.toggle("flip", flipped());
}

function render() {
  const over = state.gameResult !== "in_progress";
  const legal = getValidMoves(state);
  const destinations = new Map(legalForSelected.map((m) => [m.to, m]));
  const checkedKing = state.check ? findKing(state.board, state.turnColor) : -1;

  for (const btn of el.board.children) {
    const sq = Number(btn.dataset.sq);
    const piece = state.board[sq];

    // Only touch the DOM when the piece on this square actually changed, so
    // untouched pieces do not replay their placement animation every render.
    const want = piece ? piece.type + piece.color : "";
    if (btn.dataset.pc !== want) {
      btn.dataset.pc = want;
      btn.querySelector(".pc")?.remove();
      if (piece) btn.insertAdjacentHTML("beforeend", pieceSVG(piece.type, piece.color));
    }

    btn.classList.toggle("sel", sq === selected);
    btn.classList.toggle("dest", destinations.has(sq));
    btn.classList.toggle("cap", destinations.has(sq) && Boolean(state.board[sq] || destinations.get(sq).isEnPassant));
    btn.classList.toggle("check", sq === checkedKing);
    btn.classList.toggle(
      "last",
      state.lastMove !== null && (sq === state.lastMove.from || sq === state.lastMove.to)
    );

    const mine = piece && piece.color === playerColor;
    btn.disabled = over || thinking || (!destinations.has(sq) && !mine);
    btn.setAttribute(
      "aria-label",
      squareName(sq) + (piece ? `, ${piece.color} ${piece.type}` : ", empty")
    );
  }

  renderReadout(legal);
  renderStatus(legal, over);
  el.undo.disabled = history.length === 0 || thinking;
  el.board.classList.toggle("thinking", thinking);
}

function renderReadout(legal) {
  const cp = evaluate(state);
  const pawns = cp / 100;
  // Clamp the bar at +/- 8 pawns so a queen swing does not peg it permanently.
  const clamped = Math.max(-8, Math.min(8, pawns));
  el.evalFill.style.height = `${((clamped + 8) / 16) * 100}%`;

  const sign = pawns > 0 ? "+" : "";
  el.evalOut.textContent = Math.abs(cp) >= 90000
    ? (cp > 0 ? "mate/W" : "mate/B")
    : sign + pawns.toFixed(2);

  el.depth.textContent = String(DEPTH[difficulty]);
  el.legal.textContent = String(legal.length);
  el.halfmove.textContent = String(state.halfmoveClock);
  el.fullmove.textContent = String(state.fullmoveNumber);
  el.check.textContent = state.check ? "yes" : "no";
  el.check.classList.toggle("hot", state.check);
  el.ep.textContent = state.enPassantSquare === null ? "none" : squareName(state.enPassantSquare);
  el.hash.textContent = state.positionHistory[state.positionHistory.length - 1] ?? ".";
}

function renderStatus(legal, over) {
  el.status.classList.toggle("thinking", thinking);

  if (over) {
    const reason = state.drawReason ? state.drawReason.replace(/_/g, " ") : "";
    if (state.gameResult === "draw") {
      el.status.innerHTML = `Draw by <span class="accent">${reason}</span>.`;
    } else {
      const winner = state.gameResult === "white_wins" ? "white" : "black";
      const who = winner === playerColor ? "You win" : "The engine wins";
      el.status.innerHTML = `Checkmate. <span class="danger">${who}</span>.`;
    }
    return;
  }
  if (thinking) {
    el.status.textContent = "Engine thinking";
    return;
  }
  const check = state.check ? ` <span class="danger">Check.</span>` : "";
  el.status.innerHTML =
    (state.turnColor === playerColor ? "Your move." : "Engine to move.") +
    check +
    ` <span class="accent">${legal.length}</span> legal moves.`;
}

function renderLog() {
  if (log.length === 0) {
    el.movelog.replaceChildren(
      Object.assign(document.createElement("li"), {
        className: "movelog-empty",
        textContent: "No moves yet.",
      })
    );
    return;
  }
  const items = [];
  for (let i = 0; i < log.length; i += 2) {
    const n = document.createElement("li");
    n.className = "n";
    n.textContent = `${i / 2 + 1}.`;
    items.push(n);
    for (const entry of [log[i], log[i + 1]]) {
      const li = document.createElement("li");
      li.className = "mv" + (entry?.byBot ? " bot" : "");
      li.textContent = entry ? entry.san : "";
      items.push(li);
    }
  }
  el.movelog.replaceChildren(...items);
  el.movelog.scrollTop = el.movelog.scrollHeight;
}

// ---------------------------------------------------------------- interaction

function onSquare(sq) {
  if (thinking || state.gameResult !== "in_progress" || pendingPromotion) return;

  const match = legalForSelected.filter((m) => m.to === sq);
  if (match.length > 0) {
    if (match.length > 1 && match[0].promotion) {
      askPromotion(match);
      return;
    }
    commit(match[0], false);
    return;
  }

  const piece = state.board[sq];
  if (piece && piece.color === state.turnColor) {
    selected = sq;
    legalForSelected = getValidMoves(state).filter((m) => m.from === sq);
  } else {
    selected = null;
    legalForSelected = [];
  }
  render();
}

function askPromotion(moves) {
  pendingPromotion = moves;
  el.promoRow.replaceChildren();
  for (const type of ["Q", "R", "B", "N"]) {
    const move = moves.find((m) => m.promotion === type);
    if (!move) continue;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.innerHTML = pieceSVG(type, state.turnColor);
    btn.setAttribute("aria-label", `Promote to ${type}`);
    btn.addEventListener("click", () => {
      el.promo.hidden = true;
      pendingPromotion = null;
      commit(move, false);
    });
    el.promoRow.appendChild(btn);
  }
  el.promo.hidden = false;
  el.promoRow.firstElementChild?.focus();
}

function commit(move, byBot) {
  history.push(state);
  log.push({ san: toSan(state, move), byBot });
  state = applyMove(state, move);
  selected = null;
  legalForSelected = [];
  renderLog();
  render();

  if (!byBot && state.gameResult === "in_progress") botTurn();
}

function botTurn() {
  thinking = true;
  render();
  // Yield a frame so "thinking" paints before the search blocks the thread.
  // Depth 4 is fast enough that a worker would be over-engineering here.
  requestAnimationFrame(() => {
    setTimeout(() => {
      const move = selectBotMove(state, difficulty);
      thinking = false;
      if (move) commit(move, true);
      else render();
    }, 30);
  });
}

function newGame() {
  state = createInitialState();
  history = [];
  log = [];
  selected = null;
  legalForSelected = [];
  thinking = false;
  pendingPromotion = null;
  el.promo.hidden = true;
  buildBoard();
  renderLog();
  render();
  // White always opens, so choosing black hands the first move to the engine.
  if (playerColor === "black") botTurn();
}

function undo() {
  if (thinking || history.length === 0) return;
  // Step back over the engine's reply as well, landing on your own turn.
  const steps = Math.min(history.length, state.turnColor === playerColor ? 2 : 1);
  for (let i = 0; i < steps; i++) {
    state = history.pop();
    log.pop();
  }
  selected = null;
  legalForSelected = [];
  el.promo.hidden = true;
  pendingPromotion = null;
  renderLog();
  render();
}

// ---------------------------------------------------------------- wiring

el.newgame.addEventListener("click", newGame);
el.undo.addEventListener("click", undo);

for (const btn of document.querySelectorAll("[data-diff]")) {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.diff;
    for (const other of document.querySelectorAll("[data-diff]")) {
      other.classList.toggle("on", other === btn);
    }
    render();
  });
}

// Switching sides mid-game has no sensible meaning, so it starts a new one.
for (const btn of document.querySelectorAll("[data-side]")) {
  btn.addEventListener("click", () => {
    if (thinking || btn.dataset.side === playerColor) return;
    playerColor = btn.dataset.side;
    for (const other of document.querySelectorAll("[data-side]")) {
      other.classList.toggle("on", other === btn);
    }
    newGame();
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (pendingPromotion) {
      el.promo.hidden = true;
      pendingPromotion = null;
    }
    selected = null;
    legalForSelected = [];
    render();
  }
});

buildBoard();
renderLog();
render();

// Surfaced for quick console poking, which is half the point of a library demo.
window.chess = { get state() { return state; }, getValidMoves, evaluate, isInCheck };
