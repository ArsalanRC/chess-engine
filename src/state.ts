/**
 * Chess state creation — initialises a game from the standard starting
 * position. White always moves first.
 */

import type { ChessGameState } from "./types.js";
import { INITIAL_BOARD } from "./constants.js";
import { hashPosition } from "./rules.js";

/** Create the initial state for a new chess game (standard opening position). */
export function createInitialState(): ChessGameState {
  const initialCastling = {
    whiteKingside: true,
    whiteQueenside: true,
    blackKingside: true,
    blackQueenside: true,
  };
  const initialBoard = [...INITIAL_BOARD];

  return {
    board: initialBoard,
    turnColor: "white",
    castlingRights: initialCastling,
    enPassantSquare: null,
    halfmoveClock: 0,
    fullmoveNumber: 1,
    check: false,
    gameResult: "in_progress",
    lastMove: null,
    positionHistory: [
      hashPosition(initialBoard, "white", initialCastling, null),
    ],
  };
}
