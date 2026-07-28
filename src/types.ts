/**
 * Chess engine types.
 *
 * Two-player, turn-based. White always moves first.
 *
 * Board representation: a flat 64-element array. Index = rank * 8 + file.
 *   - rank 0 = white's back rank (a1..h1 → indices 0..7)
 *   - rank 7 = black's back rank (a8..h8 → indices 56..63)
 *   - file 0 = a-file, file 7 = h-file
 */

export type ChessPieceType = "K" | "Q" | "R" | "B" | "N" | "P";
export type ChessPieceColor = "white" | "black";

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessPieceColor;
}

/** 64-element board, null = empty square. */
export type ChessBoard = (ChessPiece | null)[];

/** Castling availability. Cleared permanently when the king or rook moves. */
export interface CastlingRights {
  whiteKingside: boolean;
  whiteQueenside: boolean;
  blackKingside: boolean;
  blackQueenside: boolean;
}

/**
 * A single move.
 *
 * `from` and `to` are 0..63 board indices. `promotion` is set only on
 * pawn moves that reach the back rank. `isCastling` is "kingside" or
 * "queenside" when the move is a castle (the `from`/`to` are the king's
 * squares; the rook move is derived). `isEnPassant` flags an en passant
 * capture. `capturedPiece` in that case is the pawn removed from the
 * square behind `to`, not the `to` square itself.
 */
export interface ChessMove {
  from: number;
  to: number;
  promotion?: ChessPieceType;
  isCastling?: "kingside" | "queenside";
  isEnPassant?: boolean;
  capturedPiece?: ChessPiece;
}

export type DrawReason =
  | "stalemate"
  | "insufficient_material"
  | "fifty_move"
  | "threefold_repetition";

export type GameResult =
  | "in_progress"
  | "white_wins"
  | "black_wins"
  | "draw";

/** Search-depth preset for {@link selectBotMove}. */
export type BotDifficulty = "easy" | "medium" | "hard";

export interface BotOptions {
  /**
   * Source of randomness, defaulting to `Math.random`. Supply a seeded
   * generator when a game needs to replay identically, for a regression test
   * or a reproducible bug report.
   */
  random?: () => number;
}

/**
 * Complete game state. Treat as immutable. `applyMove` returns a new state
 * and never mutates its argument.
 */
export interface ChessGameState {
  board: ChessBoard;
  /** Whose turn it is to move. */
  turnColor: ChessPieceColor;
  castlingRights: CastlingRights;
  /**
   * If the last move was a pawn moving two squares, this is the square
   * BEHIND that pawn (i.e. where an en passant capture would land). null
   * otherwise.
   */
  enPassantSquare: number | null;
  /** Halfmoves since the last capture or pawn move (50-move rule). */
  halfmoveClock: number;
  /** Fullmove counter: increments after each black move. */
  fullmoveNumber: number;
  /** Is the side to move in check? */
  check: boolean;
  gameResult: GameResult;
  drawReason?: DrawReason;
  lastMove: ChessMove | null;
  /**
   * FEN-style position hashes for threefold repetition detection. Only the
   * board + side-to-move + castling rights + en-passant square count for
   * repetition; move counters are excluded.
   */
  positionHistory: string[];
}
