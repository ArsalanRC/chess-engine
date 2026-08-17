/**
 * Standard Algebraic Notation: writing a move the way a person reads it.
 *
 * `e4` rather than `{from: 12, to: 28}`. Every chess book, every score sheet
 * and every online game uses SAN, so a move log printed in square indices is
 * a move log nobody can follow.
 *
 * SAN is mostly obvious and has one genuinely hard rule, which is why this is
 * its own file. **Disambiguation**: when two identical pieces can reach the
 * same square, the notation has to say which one moved, and the tie is broken
 * by file first, then rank, then both. `Nbd2` when the knights are on
 * different files, `N1d2` when they share a file, `Nb1d2` only when they share
 * both, which needs three knights and therefore a promotion.
 *
 * Getting that rule wrong produces notation that reads perfectly and is
 * ambiguous, so it is the part with the most tests.
 */

import { applyMove, getValidMoves } from "./rules.js";
import { squareToAlgebraic } from "./fen.js";
import type { ChessGameState, ChessMove } from "./types.js";

/**
 * Render one legal move as SAN, in the context of the position before it.
 *
 * The position matters: disambiguation, check and mate all depend on what else
 * is on the board, so a move cannot be named on its own.
 */
export function toSan(state: ChessGameState, move: ChessMove): string {
  // Castling is written by where the king went and ignores everything else,
  // including whether it gives check, which is appended below like any move.
  if (move.isCastling) {
    return decorate(state, move, move.isCastling === "kingside" ? "O-O" : "O-O-O");
  }

  const piece = state.board[move.from];
  if (!piece) throw new Error(`no piece on ${squareToAlgebraic(move.from)}`);

  const target = squareToAlgebraic(move.to);
  const isCapture = move.capturedPiece !== undefined || move.isEnPassant === true;

  let body: string;

  if (piece.type === "P") {
    // A capturing pawn is named by the file it left, which is the only time a
    // pawn move mentions where it came from.
    body = isCapture ? `${squareToAlgebraic(move.from)[0]}x${target}` : target;
    if (move.promotion) body += `=${move.promotion}`;
  } else {
    body = `${piece.type}${disambiguate(state, move)}${isCapture ? "x" : ""}${target}`;
  }

  return decorate(state, move, body);
}

/**
 * The minimum that identifies which piece moved: nothing, the file, the rank,
 * or the whole square.
 *
 * Only pieces of the same type and colour that can legally reach the same
 * square count. Pinned pieces are already excluded because `getValidMoves`
 * returns legal moves rather than pseudo-legal ones, which matters: a knight
 * that cannot move because it is pinned is not a source of ambiguity, and
 * writing `Nbd2` when the b-knight is pinned is wrong.
 */
function disambiguate(state: ChessGameState, move: ChessMove): string {
  const piece = state.board[move.from];
  if (!piece) return "";

  const rivals = getValidMoves(state).filter((other) => {
    if (other.to !== move.to || other.from === move.from) return false;
    const candidate = state.board[other.from];
    return candidate?.type === piece.type && candidate.color === piece.color;
  });

  if (rivals.length === 0) return "";

  const from = squareToAlgebraic(move.from);
  const file = from[0]!;
  const rank = from[1]!;

  const sharesFile = rivals.some((r) => squareToAlgebraic(r.from)[0] === file);
  const sharesRank = rivals.some((r) => squareToAlgebraic(r.from)[1] === rank);

  // File first, then rank, then both. The order is the standard's, not a
  // preference: `N1d2` where `Nbd2` would do is legal but nobody writes it.
  if (!sharesFile) return file;
  if (!sharesRank) return rank;
  return from;
}

/**
 * Append `+` for check or `#` for mate, never both.
 *
 * Mate is check, so a naive implementation that tests them independently
 * produces `+#`. This asks the resulting position which it is and appends one
 * character.
 */
function decorate(state: ChessGameState, move: ChessMove, body: string): string {
  const after = applyMove(state, move);
  // A decisive result can only be checkmate here: this engine has no
  // resignation and no clock, so a win is a mate. Checked before `check`
  // because mate IS check, and testing them independently yields "+#".
  const mated = after.gameResult === "white_wins" || after.gameResult === "black_wins";
  if (mated) return `${body}#`;
  if (after.check) return `${body}+`;
  return body;
}
