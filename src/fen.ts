/**
 * FEN export: handing a position to the rest of the chess world.
 *
 * The engine can play a full game and, until now, could not tell anything else
 * what it was looking at. FEN is the lingua franca: every GUI, every database
 * and every puzzle set reads it. One function closes that gap, and it unlocks
 * more than it costs, because a position you can serialise is a position you
 * can paste into Lichess to check the engine agrees with somebody else.
 *
 * `hashPosition` in `rules.ts` builds something that looks close to this and is
 * deliberately not the same thing. It is a repetition key: it only has to be
 * equal for equal positions, so it uses one character per square with no
 * run-length encoding and prints the en passant square as a raw index. FEN has
 * to be readable by other software, so every field is spelled the way the
 * standard says. Sharing one function between the two jobs would mean the
 * repetition key changing shape whenever the FEN format was tidied, which is a
 * bad trade for the twenty lines it saves.
 */

import { BOARD_SIZE } from "./constants.js";
import { fileOf, rankOf } from "./rules.js";
import type { ChessGameState } from "./types.js";

/**
 * The square index as algebraic notation, so `0` becomes `a1` and `63` `h8`.
 *
 * Exported because it is useful on its own: any caller printing a move for a
 * human needs exactly this, and every one of them would otherwise write it
 * again slightly differently.
 */
export function squareToAlgebraic(square: number): string {
  const file = String.fromCharCode(97 + fileOf(square));
  const rank = rankOf(square) + 1;
  return `${file}${rank}`;
}

/**
 * Serialise a position as a FEN string.
 *
 * Six space-separated fields: placement, side to move, castling rights, en
 * passant target, halfmove clock, fullmove number.
 *
 * The board is indexed from a1, so the ranks are walked backwards. FEN starts
 * at rank 8 because that is how a board is drawn from white's side, and
 * getting this the wrong way round produces a string that looks entirely
 * plausible and describes a mirrored position.
 */
export function toFen(state: ChessGameState): string {
  const ranks: string[] = [];

  for (let rank = BOARD_SIZE - 1; rank >= 0; rank--) {
    let line = "";
    let empty = 0;

    for (let file = 0; file < BOARD_SIZE; file++) {
      const piece = state.board[rank * BOARD_SIZE + file];
      if (!piece) {
        empty += 1;
        continue;
      }
      // Runs are flushed on the first piece after them, and again at the end
      // of the rank. Missing the second flush leaves a trailing run off the
      // string entirely, which is the classic way a rank comes out short.
      if (empty > 0) {
        line += String(empty);
        empty = 0;
      }
      line += piece.color === "white" ? piece.type : piece.type.toLowerCase();
    }

    if (empty > 0) line += String(empty);
    ranks.push(line);
  }

  const placement = ranks.join("/");
  const side = state.turnColor === "white" ? "w" : "b";

  const castling =
    (state.castlingRights.whiteKingside ? "K" : "") +
    (state.castlingRights.whiteQueenside ? "Q" : "") +
    (state.castlingRights.blackKingside ? "k" : "") +
    (state.castlingRights.blackQueenside ? "q" : "") || "-";

  // The state already stores the square *behind* the pawn, which is what FEN
  // wants, so this is a straight conversion rather than an offset calculation.
  // Storing the pawn's own square and adjusting here is the usual mistake and
  // produces a target one rank out.
  const enPassant =
    state.enPassantSquare === null ? "-" : squareToAlgebraic(state.enPassantSquare);

  return [
    placement,
    side,
    castling,
    enPassant,
    String(state.halfmoveClock),
    String(state.fullmoveNumber),
  ].join(" ");
}
