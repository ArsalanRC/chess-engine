/**
 * Chess engine constants — piece values, piece-square tables, and the
 * initial board layout.
 *
 * Piece-square tables are given from white's perspective (index 0 = a1,
 * index 63 = h8). For black, mirror the index with `63 - sq` when
 * evaluating.
 *
 * Values are standard engine defaults (Shannon 1949 / classical weights)
 * with mild positional bonuses; tuned for a shallow minimax search.
 */

import type { ChessBoard, ChessPieceType } from "./types.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2;
export const BOARD_SIZE = 8;
export const TOTAL_SQUARES = 64;

/** Centipawn material values. King is deliberately huge so any trade hurts. */
export const PIECE_VALUES: Record<ChessPieceType, number> = {
  P: 100,
  N: 320,
  B: 330,
  R: 500,
  Q: 900,
  K: 20000,
};

// Piece-square tables, indexed from white's perspective. Each is 64 entries
// laid out as rank 1..rank 8, file a..file h — i.e. index = rank*8 + file,
// same as the board itself.

export const PST_PAWN: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10,-20,-20, 10, 10,  5,
   5, -5,-10,  0,  0,-10, -5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5,  5, 10, 25, 25, 10,  5,  5,
  10, 10, 20, 30, 30, 20, 10, 10,
  50, 50, 50, 50, 50, 50, 50, 50,
   0,  0,  0,  0,  0,  0,  0,  0,
];

export const PST_KNIGHT: number[] = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

export const PST_BISHOP: number[] = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0,  5, 10, 10,  5,  0,-10,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

export const PST_ROOK: number[] = [
   0,  0,  5, 10, 10,  5,  0,  0,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   5, 10, 10, 10, 10, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

export const PST_QUEEN: number[] = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -10,  5,  5,  5,  5,  5,  0,-10,
    0,  0,  5,  5,  5,  5,  0, -5,
   -5,  0,  5,  5,  5,  5,  0, -5,
  -10,  0,  5,  5,  5,  5,  0,-10,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

/** Middlegame king table — penalise central king, reward castled positions. */
export const PST_KING_MIDDLE: number[] = [
   20, 30, 10,  0,  0, 10, 30, 20,
   20, 20,  0,  0,  0,  0, 20, 20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
];

export const PIECE_SQUARE_TABLES: Record<ChessPieceType, number[]> = {
  P: PST_PAWN,
  N: PST_KNIGHT,
  B: PST_BISHOP,
  R: PST_ROOK,
  Q: PST_QUEEN,
  K: PST_KING_MIDDLE,
};

/** Starting position, indexed 0 (a1) through 63 (h8). */
export const INITIAL_BOARD: ChessBoard = (() => {
  const board: ChessBoard = Array(TOTAL_SQUARES).fill(null);
  // White back rank
  const backRank: ChessPieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];
  for (let f = 0; f < 8; f++) {
    board[f] = { type: backRank[f], color: "white" };
    board[8 + f] = { type: "P", color: "white" };
    board[48 + f] = { type: "P", color: "black" };
    board[56 + f] = { type: backRank[f], color: "black" };
  }
  return board;
})();
