import { describe, it, expect } from "vitest";
import type {
  ChessBoard,
  ChessGameState,
  ChessPieceColor,
  ChessPieceType,
} from "../src/types.js";
import { TOTAL_SQUARES } from "../src/constants.js";
import { createInitialState } from "../src/state.js";
import { applyMove, getValidMoves, frToSq } from "../src/rules.js";
import { evaluate, selectBotMove } from "../src/bot.js";

function emptyBoard(): ChessBoard {
  return Array(TOTAL_SQUARES).fill(null);
}

function place(
  board: ChessBoard,
  type: ChessPieceType,
  color: ChessPieceColor,
  file: number,
  rank: number
): void {
  board[frToSq(file, rank)] = { type, color };
}

function customState(build: (board: ChessBoard) => void, overrides: Partial<ChessGameState> = {}): ChessGameState {
  const board = emptyBoard();
  place(board, "K", "white", 4, 0);
  place(board, "K", "black", 4, 7);
  build(board);
  return {
    ...createInitialState(),
    board,
    castlingRights: {
      whiteKingside: false,
      whiteQueenside: false,
      blackKingside: false,
      blackQueenside: false,
    },
    ...overrides,
  };
}

describe("evaluate", () => {
  it("returns 0 for a symmetric starting position", () => {
    const state = createInitialState();
    expect(evaluate(state)).toBe(0);
  });

  it("favours the side with extra material", () => {
    const state = customState((b) => {
      place(b, "Q", "white", 3, 0);
    });
    expect(evaluate(state)).toBeGreaterThan(0);
  });

  it("returns mate score for a finished game", () => {
    const state = customState((b) => {
      place(b, "Q", "white", 3, 0);
    }, { gameResult: "white_wins" });
    expect(evaluate(state)).toBe(100_000);
  });

  it("mirrors the table for black", () => {
    // A white knight on a good central square should score POSITIVE; a black
    // knight on the same square should score NEGATIVE with same magnitude.
    const whiteOnD4 = customState((b) => place(b, "N", "white", 3, 3));
    const blackOnD4 = customState((b) => place(b, "N", "black", 3, 3));
    expect(evaluate(whiteOnD4)).toBeGreaterThan(0);
    expect(evaluate(blackOnD4)).toBeLessThan(0);
  });
});

describe("selectBotMove", () => {
  it("returns a legal move from the opening position (all difficulties)", () => {
    const state = createInitialState();
    const legal = getValidMoves(state);
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const move = selectBotMove(state, difficulty);
      expect(move).not.toBeNull();
      const matched = legal.find(
        (m) =>
          m.from === move!.from &&
          m.to === move!.to &&
          (m.promotion ?? null) === (move!.promotion ?? null)
      );
      expect(matched).toBeDefined();
    }
  });

  it("returns null in a position with no legal moves", () => {
    // Stalemate: black king on h8, white queen on g6, white king on f7.
    const state = customState(
      (b) => {
        b[frToSq(4, 0)] = null;
        b[frToSq(4, 7)] = null;
        place(b, "K", "black", 7, 7);
        place(b, "K", "white", 5, 6);
        place(b, "Q", "white", 6, 5);
      },
      { turnColor: "black" }
    );
    expect(getValidMoves(state)).toHaveLength(0);
    expect(selectBotMove(state, "hard")).toBeNull();
  });

  it("prefers a free capture at medium+ difficulty", () => {
    // White queen on d4 can take a hanging rook on h8.
    const state = customState((b) => {
      place(b, "Q", "white", 3, 3);
      place(b, "R", "black", 7, 7);
    });
    const move = selectBotMove(state, "medium");
    expect(move).not.toBeNull();
    expect(move?.from).toBe(frToSq(3, 3));
    expect(move?.to).toBe(frToSq(7, 7));
  });

  it("plays the mate-in-one when available (hard)", () => {
    // Back-rank mate: white rook on a1 moves to a8 — black king is on h8 with
    // pawns on f7/g7/h7 boxing it in.
    const state = customState((b) => {
      // Wipe defaults, set up a back-rank-mate position.
      b[frToSq(4, 0)] = null;
      b[frToSq(4, 7)] = null;
      place(b, "K", "white", 4, 0);
      place(b, "K", "black", 7, 7);
      place(b, "P", "black", 5, 6);
      place(b, "P", "black", 6, 6);
      place(b, "P", "black", 7, 6);
      place(b, "R", "white", 0, 0);
    });
    const move = selectBotMove(state, "hard");
    expect(move).not.toBeNull();
    // Mating move: Ra1–a8.
    expect(move?.from).toBe(frToSq(0, 0));
    expect(move?.to).toBe(frToSq(0, 7));
    const after = applyMove(state, move!);
    expect(after.gameResult).not.toBe("in_progress");
    expect(after.gameResult).toBe("white_wins");
  });

  it("avoids a move that loses the queen for no reason (hard)", () => {
    // White queen on d1 with a black bishop on b3 staring right down the
    // diagonal to d1. A one-ply bot might happily leave the queen there; a
    // 4-ply bot should move it.
    const state = customState((b) => {
      place(b, "Q", "white", 3, 0);
      place(b, "B", "black", 1, 2);
      place(b, "P", "white", 0, 1);
      place(b, "P", "white", 7, 1);
    });
    const move = selectBotMove(state, "hard");
    expect(move).not.toBeNull();
    // The chosen move should either move the queen or block the bishop. Either
    // way, after the move the queen should not be immediately capturable on d1
    // (unless the bot captured the bishop).
    const after = applyMove(state, move!);
    expect(after.gameResult).toBe("in_progress");
    // If the queen stayed on d1, the bishop on b3 must be gone.
    if (after.board[frToSq(3, 0)]?.type === "Q") {
      expect(after.board[frToSq(1, 2)]).toBeNull();
    }
  });
});
