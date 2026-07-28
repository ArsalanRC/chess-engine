/**
 * Chess rules — move generation, legality filtering, application, and
 * end-of-game detection.
 *
 * The public surface is:
 *   - `getValidMoves(state)` — all fully-legal moves for the side to move
 *   - `applyMove(state, move)` — apply a move and return the new state
 *                                (handles castling, en passant, promotion,
 *                                 updates rights / counters / game result)
 *   - `isInCheck(board, color)` — utility used by the bot + UI
 *   - `hashPosition(...)` — FEN-ish position hash for repetition detection
 *
 * Internal helpers (exported for testing):
 *   - `isSquareAttacked`, `getPseudoLegalMoves`, `findKing`.
 */

import type {
  ChessBoard,
  ChessGameState,
  ChessMove,
  ChessPiece,
  ChessPieceColor,
  ChessPieceType,
  CastlingRights,
} from "./types.js";
import { BOARD_SIZE, TOTAL_SQUARES } from "./constants.js";

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export const fileOf = (sq: number): number => sq % BOARD_SIZE;
export const rankOf = (sq: number): number => Math.floor(sq / BOARD_SIZE);
export const frToSq = (file: number, rank: number): number =>
  rank * BOARD_SIZE + file;
export const onBoard = (file: number, rank: number): boolean =>
  file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;

const opposite = (c: ChessPieceColor): ChessPieceColor =>
  c === "white" ? "black" : "white";

// ---------------------------------------------------------------------------
// Square-attack detection
// ---------------------------------------------------------------------------

/**
 * Returns true iff any piece of `byColor` attacks `targetSq`.
 * Used for check detection and castling legality. Rays are shot OUT FROM
 * targetSq to avoid scanning every piece on the board.
 */
export function isSquareAttacked(
  board: ChessBoard,
  targetSq: number,
  byColor: ChessPieceColor
): boolean {
  const tf = fileOf(targetSq);
  const tr = rankOf(targetSq);

  // Knight
  const knightJumps = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ] as const;
  for (const [df, dr] of knightJumps) {
    const f = tf + df;
    const r = tr + dr;
    if (!onBoard(f, r)) continue;
    const p = board[frToSq(f, r)];
    if (p && p.color === byColor && p.type === "N") return true;
  }

  // Pawn — attacks diagonally forward from its own perspective.
  // A white pawn attacking `targetSq` sits one rank BELOW it; a black
  // pawn sits one rank above.
  const pawnFromRank = byColor === "white" ? tr - 1 : tr + 1;
  for (const df of [-1, 1] as const) {
    const f = tf + df;
    if (!onBoard(f, pawnFromRank)) continue;
    const p = board[frToSq(f, pawnFromRank)];
    if (p && p.color === byColor && p.type === "P") return true;
  }

  // King (adjacent squares)
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      if (df === 0 && dr === 0) continue;
      const f = tf + df;
      const r = tr + dr;
      if (!onBoard(f, r)) continue;
      const p = board[frToSq(f, r)];
      if (p && p.color === byColor && p.type === "K") return true;
    }
  }

  // Rook / queen rays (horizontal + vertical)
  const straights = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
  ] as const;
  for (const [df, dr] of straights) {
    for (let step = 1; step < BOARD_SIZE; step++) {
      const f = tf + df * step;
      const r = tr + dr * step;
      if (!onBoard(f, r)) break;
      const p = board[frToSq(f, r)];
      if (!p) continue;
      if (p.color === byColor && (p.type === "R" || p.type === "Q")) return true;
      break;
    }
  }

  // Bishop / queen rays (diagonals)
  const diagonals = [
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ] as const;
  for (const [df, dr] of diagonals) {
    for (let step = 1; step < BOARD_SIZE; step++) {
      const f = tf + df * step;
      const r = tr + dr * step;
      if (!onBoard(f, r)) break;
      const p = board[frToSq(f, r)];
      if (!p) continue;
      if (p.color === byColor && (p.type === "B" || p.type === "Q")) return true;
      break;
    }
  }

  return false;
}

/** Locate the king of a given color. Returns -1 if missing (never should). */
export function findKing(board: ChessBoard, color: ChessPieceColor): number {
  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const p = board[sq];
    if (p && p.type === "K" && p.color === color) return sq;
  }
  return -1;
}

/** Is the given color currently in check? */
export function isInCheck(board: ChessBoard, color: ChessPieceColor): boolean {
  const kingSq = findKing(board, color);
  if (kingSq < 0) return false;
  return isSquareAttacked(board, kingSq, opposite(color));
}

// ---------------------------------------------------------------------------
// Pseudo-legal move generation (ignores own-king safety)
// ---------------------------------------------------------------------------

const SLIDE_DIRS: Record<"R" | "B" | "Q", ReadonlyArray<readonly [number, number]>> = {
  R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  Q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

const KNIGHT_JUMPS: ReadonlyArray<readonly [number, number]> = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];

function pushMove(
  moves: Partial<ChessMove>[],
  from: number,
  to: number,
  extras: Partial<ChessMove> = {}
): void {
  moves.push({ from, to, ...extras });
}

/** Generate pseudo-legal moves for the piece on `from` in `state`. */
export function getPseudoLegalMovesFrom(
  state: ChessGameState,
  from: number
): Partial<ChessMove>[] {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turnColor) return [];

  const moves: Partial<ChessMove>[] = [];
  const f = fileOf(from);
  const r = rankOf(from);

  switch (piece.type) {
    case "P":
      generatePawnMoves(state, piece, from, f, r, moves);
      break;
    case "N":
      for (const [df, dr] of KNIGHT_JUMPS) {
        const nf = f + df;
        const nr = r + dr;
        if (!onBoard(nf, nr)) continue;
        const to = frToSq(nf, nr);
        const target = state.board[to];
        if (!target || target.color !== piece.color) {
          pushMove(moves, from, to, target ? { capturedPiece: target } : {});
        }
      }
      break;
    case "B":
    case "R":
    case "Q": {
      const dirs = SLIDE_DIRS[piece.type];
      for (const [df, dr] of dirs) {
        for (let step = 1; step < BOARD_SIZE; step++) {
          const nf = f + df * step;
          const nr = r + dr * step;
          if (!onBoard(nf, nr)) break;
          const to = frToSq(nf, nr);
          const target = state.board[to];
          if (!target) {
            pushMove(moves, from, to);
          } else {
            if (target.color !== piece.color) {
              pushMove(moves, from, to, { capturedPiece: target });
            }
            break;
          }
        }
      }
      break;
    }
    case "K":
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          if (df === 0 && dr === 0) continue;
          const nf = f + df;
          const nr = r + dr;
          if (!onBoard(nf, nr)) continue;
          const to = frToSq(nf, nr);
          const target = state.board[to];
          if (!target || target.color !== piece.color) {
            pushMove(moves, from, to, target ? { capturedPiece: target } : {});
          }
        }
      }
      // Castling is added as a legal-move pass below (in getValidMoves) so we
      // can check intermediate-square safety once.
      break;
  }

  return moves;
}

function generatePawnMoves(
  state: ChessGameState,
  piece: ChessPiece,
  from: number,
  f: number,
  r: number,
  moves: Partial<ChessMove>[]
): void {
  const dir = piece.color === "white" ? 1 : -1;
  const startRank = piece.color === "white" ? 1 : 6;
  const promotionRank = piece.color === "white" ? 7 : 0;

  // Single push
  const oneAheadR = r + dir;
  if (onBoard(f, oneAheadR)) {
    const oneAheadSq = frToSq(f, oneAheadR);
    if (!state.board[oneAheadSq]) {
      if (oneAheadR === promotionRank) {
        for (const promo of ["Q", "R", "B", "N"] as ChessPieceType[]) {
          pushMove(moves, from, oneAheadSq, { promotion: promo });
        }
      } else {
        pushMove(moves, from, oneAheadSq);
      }

      // Double push from starting rank
      if (r === startRank) {
        const twoAheadR = r + 2 * dir;
        const twoAheadSq = frToSq(f, twoAheadR);
        if (!state.board[twoAheadSq]) {
          pushMove(moves, from, twoAheadSq);
        }
      }
    }
  }

  // Diagonal captures (including en passant)
  for (const df of [-1, 1] as const) {
    const nf = f + df;
    const nr = r + dir;
    if (!onBoard(nf, nr)) continue;
    const to = frToSq(nf, nr);
    const target = state.board[to];
    if (target && target.color !== piece.color) {
      if (nr === promotionRank) {
        for (const promo of ["Q", "R", "B", "N"] as ChessPieceType[]) {
          pushMove(moves, from, to, { promotion: promo, capturedPiece: target });
        }
      } else {
        pushMove(moves, from, to, { capturedPiece: target });
      }
    } else if (!target && state.enPassantSquare === to) {
      // En passant — the captured pawn is on the same file as `to` but one
      // rank BACK (towards the mover's side).
      const capturedSq = frToSq(nf, r);
      const capturedPawn = state.board[capturedSq];
      if (capturedPawn && capturedPawn.type === "P" && capturedPawn.color !== piece.color) {
        pushMove(moves, from, to, {
          isEnPassant: true,
          capturedPiece: capturedPawn,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Castling
// ---------------------------------------------------------------------------

function generateCastlingMoves(state: ChessGameState): Partial<ChessMove>[] {
  const color = state.turnColor;
  const moves: Partial<ChessMove>[] = [];
  const backRank = color === "white" ? 0 : 7;
  const kingSq = frToSq(4, backRank);
  const king = state.board[kingSq];
  if (!king || king.type !== "K" || king.color !== color) return moves;
  if (isInCheck(state.board, color)) return moves;

  const opp = opposite(color);
  const rights = state.castlingRights;
  const canKingside =
    color === "white" ? rights.whiteKingside : rights.blackKingside;
  const canQueenside =
    color === "white" ? rights.whiteQueenside : rights.blackQueenside;

  if (canKingside) {
    const f5 = frToSq(5, backRank);
    const f6 = frToSq(6, backRank);
    const rookSq = frToSq(7, backRank);
    const rook = state.board[rookSq];
    if (
      rook &&
      rook.type === "R" &&
      rook.color === color &&
      !state.board[f5] &&
      !state.board[f6] &&
      !isSquareAttacked(state.board, f5, opp) &&
      !isSquareAttacked(state.board, f6, opp)
    ) {
      pushMove(moves, kingSq, f6, { isCastling: "kingside" });
    }
  }

  if (canQueenside) {
    const f3 = frToSq(3, backRank);
    const f2 = frToSq(2, backRank);
    const f1 = frToSq(1, backRank);
    const rookSq = frToSq(0, backRank);
    const rook = state.board[rookSq];
    if (
      rook &&
      rook.type === "R" &&
      rook.color === color &&
      !state.board[f1] &&
      !state.board[f2] &&
      !state.board[f3] &&
      !isSquareAttacked(state.board, f3, opp) &&
      !isSquareAttacked(state.board, f2, opp)
    ) {
      pushMove(moves, kingSq, f2, { isCastling: "queenside" });
    }
  }

  return moves;
}

// ---------------------------------------------------------------------------
// Legal move generation — filters pseudo-legal moves by king safety.
// ---------------------------------------------------------------------------

/** All fully-legal moves for the side to move. */
export function getValidMoves(state: ChessGameState): ChessMove[] {
  if (state.gameResult !== "in_progress") return [];

  const pseudoLegal: Partial<ChessMove>[] = [];

  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const piece = state.board[sq];
    if (!piece || piece.color !== state.turnColor) continue;
    pseudoLegal.push(...getPseudoLegalMovesFrom(state, sq));
  }
  pseudoLegal.push(...generateCastlingMoves(state));

  const legal: ChessMove[] = [];
  for (const m of pseudoLegal) {
    const after = simulateMoveOnBoard(state, m as ChessMove);
    if (!isInCheck(after, state.turnColor)) {
      legal.push(m as ChessMove);
    }
  }
  return legal;
}

/**
 * Apply a move to a copy of the board only (no state bookkeeping). Used to
 * test king-safety during legal-move filtering.
 */
function simulateMoveOnBoard(
  state: ChessGameState,
  move: ChessMove
): ChessBoard {
  const board = [...state.board];
  const moving = board[move.from];
  if (!moving) return board;

  board[move.from] = null;
  board[move.to] = move.promotion
    ? { type: move.promotion, color: moving.color }
    : moving;

  if (move.isEnPassant) {
    const capturedSq = frToSq(fileOf(move.to), rankOf(move.from));
    board[capturedSq] = null;
  }

  if (move.isCastling) {
    const rank = rankOf(move.from);
    if (move.isCastling === "kingside") {
      board[frToSq(5, rank)] = board[frToSq(7, rank)];
      board[frToSq(7, rank)] = null;
    } else {
      board[frToSq(3, rank)] = board[frToSq(0, rank)];
      board[frToSq(0, rank)] = null;
    }
  }

  return board;
}

// ---------------------------------------------------------------------------
// applyMove — full state transition with bookkeeping.
// ---------------------------------------------------------------------------

export function applyMove(
  state: ChessGameState,
  move: ChessMove
): ChessGameState {
  if (state.gameResult !== "in_progress") {
    throw new Error("Game is not in progress");
  }
  const piece = state.board[move.from];
  if (!piece || piece.color !== state.turnColor) {
    throw new Error(`Invalid move: no ${state.turnColor} piece on from-square`);
  }

  const board: ChessBoard = [...state.board];
  const captured = move.capturedPiece ?? board[move.to] ?? null;

  // Reset en passant unless this move sets it.
  let newEnPassant: number | null = null;

  // Halfmove clock: reset on capture or pawn move, else increment.
  const isPawnMove = piece.type === "P";
  const isCapture = captured !== null;
  const newHalfmove = isPawnMove || isCapture ? 0 : state.halfmoveClock + 1;

  // Place the piece at destination (with promotion if applicable).
  board[move.from] = null;
  board[move.to] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece;

  // En passant capture — remove the captured pawn from its own square.
  if (move.isEnPassant) {
    const capturedSq = frToSq(fileOf(move.to), rankOf(move.from));
    board[capturedSq] = null;
  }

  // Castling — move the rook alongside the king.
  if (move.isCastling) {
    const rank = rankOf(move.from);
    if (move.isCastling === "kingside") {
      board[frToSq(5, rank)] = board[frToSq(7, rank)];
      board[frToSq(7, rank)] = null;
    } else {
      board[frToSq(3, rank)] = board[frToSq(0, rank)];
      board[frToSq(0, rank)] = null;
    }
  }

  // Pawn double-push sets the en passant square.
  if (isPawnMove && Math.abs(rankOf(move.to) - rankOf(move.from)) === 2) {
    newEnPassant = frToSq(fileOf(move.from), (rankOf(move.from) + rankOf(move.to)) / 2);
  }

  // Update castling rights when king or rook moves (or when a rook is captured
  // on its home square).
  const newCastling = updateCastlingRights(state.castlingRights, move, piece, captured);

  // Next side to move.
  const nextTurnColor = opposite(state.turnColor);

  // Position hash for repetition detection.
  const newHash = hashPosition(board, nextTurnColor, newCastling, newEnPassant);
  const newHistory = [...state.positionHistory, newHash];

  // Assemble preliminary next-state, then detect game result.
  const nextState: ChessGameState = {
    ...state,
    board,
    turnColor: nextTurnColor,
    fullmoveNumber:
      piece.color === "black" ? state.fullmoveNumber + 1 : state.fullmoveNumber,
    castlingRights: newCastling,
    enPassantSquare: newEnPassant,
    halfmoveClock: newHalfmove,
    check: isInCheck(board, nextTurnColor),
    lastMove: { ...move, capturedPiece: captured ?? undefined },
    positionHistory: newHistory,
    gameResult: "in_progress",
    drawReason: undefined,
  };

  return finaliseGameResult(nextState);
}

function updateCastlingRights(
  prev: CastlingRights,
  move: ChessMove,
  moved: ChessPiece,
  captured: ChessPiece | null
): CastlingRights {
  const r: CastlingRights = { ...prev };

  if (moved.type === "K") {
    if (moved.color === "white") {
      r.whiteKingside = false;
      r.whiteQueenside = false;
    } else {
      r.blackKingside = false;
      r.blackQueenside = false;
    }
  }
  if (moved.type === "R") {
    if (moved.color === "white" && move.from === frToSq(0, 0)) r.whiteQueenside = false;
    if (moved.color === "white" && move.from === frToSq(7, 0)) r.whiteKingside = false;
    if (moved.color === "black" && move.from === frToSq(0, 7)) r.blackQueenside = false;
    if (moved.color === "black" && move.from === frToSq(7, 7)) r.blackKingside = false;
  }
  // Captured rook on its home square — strip the corresponding right.
  if (captured && captured.type === "R") {
    if (move.to === frToSq(0, 0)) r.whiteQueenside = false;
    if (move.to === frToSq(7, 0)) r.whiteKingside = false;
    if (move.to === frToSq(0, 7)) r.blackQueenside = false;
    if (move.to === frToSq(7, 7)) r.blackKingside = false;
  }

  return r;
}

function finaliseGameResult(state: ChessGameState): ChessGameState {
  const legal = getValidMoves(state);

  if (legal.length === 0) {
    if (state.check) {
      // Side-to-move is checkmated; the OTHER side wins.
      const winnerColor = opposite(state.turnColor);
      return {
        ...state,
        gameResult: winnerColor === "white" ? "white_wins" : "black_wins",
      };
    }
    return {
      ...state,
      gameResult: "draw",
      drawReason: "stalemate",
    };
  }

  if (state.halfmoveClock >= 100) {
    return {
      ...state,
      gameResult: "draw",
      drawReason: "fifty_move",
    };
  }

  if (isInsufficientMaterial(state.board)) {
    return {
      ...state,
      gameResult: "draw",
      drawReason: "insufficient_material",
    };
  }

  if (isThreefoldRepetition(state.positionHistory)) {
    return {
      ...state,
      gameResult: "draw",
      drawReason: "threefold_repetition",
    };
  }

  return state;
}

// ---------------------------------------------------------------------------
// Draw detection
// ---------------------------------------------------------------------------

export function isInsufficientMaterial(board: ChessBoard): boolean {
  const pieces: ChessPiece[] = board.filter((p): p is ChessPiece => p !== null);
  // K vs K
  if (pieces.length === 2) return true;
  // K + minor vs K
  if (pieces.length === 3) {
    const minor = pieces.find((p) => p.type === "B" || p.type === "N");
    if (minor) return true;
  }
  // K + B vs K + B, both bishops on same color square
  if (pieces.length === 4) {
    const bishops = board
      .map((p, sq) => (p && p.type === "B" ? { p, sq } : null))
      .filter((x): x is { p: ChessPiece; sq: number } => x !== null);
    if (bishops.length === 2 && bishops[0].p.color !== bishops[1].p.color) {
      const squareColor = (sq: number) => (fileOf(sq) + rankOf(sq)) % 2;
      if (squareColor(bishops[0].sq) === squareColor(bishops[1].sq)) return true;
    }
  }
  return false;
}

export function isThreefoldRepetition(positionHistory: string[]): boolean {
  const counts = new Map<string, number>();
  for (const hash of positionHistory) {
    const next = (counts.get(hash) ?? 0) + 1;
    counts.set(hash, next);
    if (next >= 3) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Position hashing (FEN-ish, move counters excluded for repetition).
// ---------------------------------------------------------------------------

export function hashPosition(
  board: ChessBoard,
  turnColor: ChessPieceColor,
  castling: CastlingRights,
  enPassantSquare: number | null
): string {
  let pieces = "";
  for (let sq = 0; sq < TOTAL_SQUARES; sq++) {
    const p = board[sq];
    if (!p) {
      pieces += ".";
    } else {
      pieces += p.color === "white" ? p.type : p.type.toLowerCase();
    }
  }
  const cr =
    (castling.whiteKingside ? "K" : "") +
    (castling.whiteQueenside ? "Q" : "") +
    (castling.blackKingside ? "k" : "") +
    (castling.blackQueenside ? "q" : "") || "-";
  return `${pieces}|${turnColor[0]}|${cr}|${enPassantSquare ?? "-"}`;
}
