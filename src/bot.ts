/**
 * Chess bot: minimax search with alpha-beta pruning.
 *
 * Difficulty maps to search depth:
 *   easy   → depth 2
 *   medium → depth 3
 *   hard   → depth 4
 *
 * Evaluation is material + piece-square tables (centipawn units), positive
 * for white.
 *
 * Move ordering puts captures first so alpha-beta has something to cut
 * against. Within an equal capture value the root order is shuffled, because
 * a strict `>` comparison otherwise resolves every tie in favour of whichever
 * move generation happened to emit first. In a symmetric opening nearly every
 * move ties, so without the shuffle the engine opens identically forever.
 *
 * The shuffle never costs strength: it only reorders moves the evaluation
 * already considers equal. Pass a seeded `random` for reproducible games.
 */

import type { BotDifficulty, BotOptions, ChessGameState, ChessMove } from "./types.js";
import { PIECE_VALUES, PIECE_SQUARE_TABLES, TOTAL_SQUARES } from "./constants.js";
import { applyMove, getValidMoves, fileOf, rankOf } from "./rules.js";

const MATE_SCORE = 100_000;

const DEPTH_BY_DIFFICULTY: Record<BotDifficulty, number> = {
  easy: 2,
  medium: 3,
  hard: 4,
};

/**
 * Positive centipawn score = good for white. Mirrors piece-square tables
 * for black so each side reads its own table from rank 1.
 */
export function evaluate(state: ChessGameState): number {
  if (state.gameResult === "white_wins") return MATE_SCORE;
  if (state.gameResult === "black_wins") return -MATE_SCORE;
  if (state.gameResult === "draw") return 0;

  let score = 0;
  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const p = state.board[sq];
    if (!p) continue;
    const material = PIECE_VALUES[p.type];
    const pst = PIECE_SQUARE_TABLES[p.type];
    // For black, mirror vertically so black's "own" row-2 lands on rank 7.
    const idx = p.color === "white" ? sq : mirrorSquare(sq);
    const positional = pst[idx];
    const value = material + positional;
    score += p.color === "white" ? value : -value;
  }
  return score;
}

function mirrorSquare(sq: number): number {
  const f = fileOf(sq);
  const r = rankOf(sq);
  return (7 - r) * 8 + f;
}

interface SearchResult {
  score: number;
  move: ChessMove | null;
}

/**
 * Alpha-beta minimax. `maximising` is true when the side to move is white.
 *
 * `rng` is passed only by the root call. Shuffling deeper plies would cost
 * time without changing which move comes back.
 */
function search(
  state: ChessGameState,
  depth: number,
  alpha: number,
  beta: number,
  maximising: boolean,
  rng: (() => number) | null = null
): SearchResult {
  if (state.gameResult !== "in_progress") {
    return { score: evaluate(state), move: null };
  }
  if (depth === 0) {
    return { score: evaluate(state), move: null };
  }

  const moves = getValidMoves(state);
  if (moves.length === 0) {
    // Checkmate or stalemate: evaluate terminal position from the side-to-move
    // perspective. Checkmate scores include a depth penalty so earlier mates
    // beat later mates.
    if (state.check) {
      return {
        score: maximising ? -(MATE_SCORE - (100 - depth)) : MATE_SCORE - (100 - depth),
        move: null,
      };
    }
    return { score: 0, move: null };
  }

  const ordered = orderMoves(state, moves, rng);

  let best: SearchResult = { score: maximising ? -Infinity : Infinity, move: ordered[0] };

  for (const move of ordered) {
    const next = applyMove(state, move);
    const { score } = search(next, depth - 1, alpha, beta, !maximising);

    if (maximising) {
      if (score > best.score) best = { score, move };
      if (score > alpha) alpha = score;
    } else {
      if (score < best.score) best = { score, move };
      if (score < beta) beta = score;
    }
    if (beta <= alpha) break;
  }

  return best;
}

/**
 * Captures first, by victim value, which is what gives alpha-beta something to
 * cut against. When `rng` is supplied the list is shuffled first, so moves the
 * evaluation rates equally no longer resolve in array order. `Array.sort` is
 * stable, so the capture ranking survives the shuffle intact.
 */
function orderMoves(
  state: ChessGameState,
  moves: ChessMove[],
  rng: (() => number) | null
): ChessMove[] {
  const list = moves.slice();
  if (rng) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return list.sort((a, b) => captureValue(state, b) - captureValue(state, a));
}

function captureValue(state: ChessGameState, move: ChessMove): number {
  const target = state.board[move.to];
  if (target) return PIECE_VALUES[target.type];
  if (move.isEnPassant) return PIECE_VALUES.P;
  if (move.promotion) return PIECE_VALUES[move.promotion];
  return 0;
}

/**
 * Select a move for the side to move. Returns null if the position has no
 * legal moves (checkmate or stalemate).
 *
 * Moves the evaluation rates equally are chosen between at random, so repeated
 * games do not open the same way every time. This never picks a move the
 * engine considers worse. At `easy` the bot additionally plays an outright
 * random legal move 20% of the time, so a human can beat it.
 *
 * For a reproducible game, pass a seeded generator as `options.random`.
 */
export function selectBotMove(
  state: ChessGameState,
  difficulty: BotDifficulty,
  options: BotOptions = {}
): ChessMove | null {
  const rng = options.random ?? Math.random;
  const validMoves = getValidMoves(state);
  if (validMoves.length === 0) return null;

  if (difficulty === "easy" && rng() < 0.2) {
    return validMoves[Math.floor(rng() * validMoves.length)];
  }

  const depth = DEPTH_BY_DIFFICULTY[difficulty];
  const maximising = state.turnColor === "white";
  const { move } = search(state, depth, -Infinity, Infinity, maximising, rng);

  // Search always returns a move when legal moves exist; the fallback guards
  // against a future refactor breaking that invariant silently.
  return move ?? validMoves[0];
}
