/**
 * Standard Algebraic Notation.
 *
 * Disambiguation gets the most tests, because getting it wrong produces
 * notation that reads perfectly and is ambiguous, which no type checker and no
 * casual glance will catch.
 */

import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, getValidMoves, toSan } from "../src/index.js";
import type { ChessGameState } from "../src/index.js";

const sq = (t: string) => (t.charCodeAt(1) - 49) * 8 + (t.charCodeAt(0) - 97);

function moveFor(state: ChessGameState, from: string, to: string) {
  const move = getValidMoves(state).find((m) => m.from === sq(from) && m.to === sq(to));
  if (!move) throw new Error(`${from}${to} is not legal here`);
  return move;
}

function san(state: ChessGameState, from: string, to: string): string {
  return toSan(state, moveFor(state, from, to));
}

/** The piece type standing on a square, for filtering rivals in the tests. */
function state(s: ChessGameState, square: number): string | undefined {
  return s.board[square]?.type;
}

function play(state: ChessGameState, from: string, to: string): ChessGameState {
  return applyMove(state, moveFor(state, from, to));
}

/** Play a list of coordinate pairs, for setting positions up quickly. */
function line(moves: [string, string][]): ChessGameState {
  return moves.reduce((s, [f, t]) => play(s, f, t), createInitialState());
}

describe("plain moves", () => {
  it("writes a pawn push as just the destination", () => {
    expect(san(createInitialState(), "e2", "e4")).toBe("e4");
  });

  it("writes a piece move as the letter plus the destination", () => {
    expect(san(createInitialState(), "g1", "f3")).toBe("Nf3");
  });
});

describe("captures", () => {
  it("names a capturing pawn by the file it left", () => {
    const s = line([["e2", "e4"], ["d7", "d5"]]);
    expect(san(s, "e4", "d5")).toBe("exd5");
  });

  it("uses x for a piece capture", () => {
    const s = line([["e2", "e4"], ["d7", "d5"], ["g1", "f3"], ["d5", "e4"], ["f3", "g5"], ["g8", "f6"]]);
    expect(san(s, "g5", "e4")).toBe("Nxe4");
  });

  it("writes an en passant capture like any other pawn capture", () => {
    const s = line([["e2", "e4"], ["a7", "a6"], ["e4", "e5"], ["d7", "d5"]]);
    expect(san(s, "e5", "d6")).toBe("exd6");
  });
});

describe("disambiguation", () => {
  it("adds nothing when only one piece can reach the square", () => {
    expect(san(createInitialState(), "b1", "c3")).toBe("Nc3");
  });

  it("uses the file when the two knights are on different files", () => {
    // d-pawn out of the way, then knights on b1 and f3 both reach d2.
    const s = line([["d2", "d4"], ["a7", "a6"], ["g1", "f3"], ["b7", "b6"]]);
    const both = getValidMoves(s).filter(
      (m) => m.to === sq("d2") && state(s, m.from) === "N",
    );
    expect(both.length).toBe(2);
    expect(toSan(s, both.find((m) => m.from === sq("b1"))!)).toBe("Nbd2");
    expect(toSan(s, both.find((m) => m.from === sq("f3"))!)).toBe("Nfd2");
  });

  it("uses the rank when the two pieces share a file", () => {
    // Knights on b1 and b5 both reach c3, and the file cannot tell them apart.
    // Walking one knight g1-f3-d4-b5 is the shortest route to a same-file pair
    // from the opening position, which is why the line looks odd.
    const s = line([
      ["g1", "f3"], ["a7", "a6"],
      ["f3", "d4"], ["b7", "b6"],
      ["d4", "b5"], ["h7", "h6"],
    ]);
    const toC3 = getValidMoves(s).filter(
      (m) => m.to === sq("c3") && state(s, m.from) === "N",
    );
    expect(toC3.length).toBe(2);
    expect(toSan(s, toC3.find((m) => m.from === sq("b1"))!)).toBe("N1c3");
    expect(toSan(s, toC3.find((m) => m.from === sq("b5"))!)).toBe("N5c3");
  });

  it("adds nothing when the other knight cannot reach the square", () => {
    // The g1 knight has no route to a3, so there is nothing to disambiguate
    // against. Rivalry is decided by `getValidMoves`, which returns legal
    // moves rather than pseudo-legal ones, so a knight that cannot move
    // because it is pinned is not a rival either.
    const s = createInitialState();
    expect(san(s, "b1", "a3")).toBe("Na3");
  });
});

describe("castling", () => {
  it("writes kingside as O-O and queenside as O-O-O", () => {
    const kingside = line([
      ["e2", "e4"], ["e7", "e5"],
      ["g1", "f3"], ["b8", "c6"],
      ["f1", "c4"], ["f8", "c5"],
    ]);
    expect(san(kingside, "e1", "g1")).toBe("O-O");

    const queenside = line([
      ["d2", "d4"], ["d7", "d5"],
      ["b1", "c3"], ["b8", "c6"],
      ["c1", "f4"], ["c8", "f5"],
      ["d1", "d2"], ["d8", "d7"],
    ]);
    expect(san(queenside, "e1", "c1")).toBe("O-O-O");
  });
});

describe("check and mate", () => {
  it("appends + for a check the king survives", () => {
    // Bxf7+ and the king simply takes. This has to be a position that is check
    // and not mate, or it tests the # branch twice and leaves + unwritten.
    const s = line([["e2", "e4"], ["e7", "e5"], ["f1", "c4"], ["b8", "c6"]]);
    expect(san(s, "c4", "f7")).toBe("Bxf7+");
  });

  it("writes mate as # and never +#", () => {
    // Scholar's mate. The one thing a naive implementation gets wrong is
    // testing check and mate independently and emitting both marks.
    const s = line([["e2", "e4"], ["e7", "e5"], ["f1", "c4"], ["b8", "c6"], ["d1", "h5"], ["g8", "f6"]]);
    const text = san(s, "h5", "f7");
    expect(text).toContain("#");
    expect(text).not.toContain("+#");
    expect(text).not.toContain("+");
  });

  it("appends nothing to a quiet move", () => {
    expect(san(createInitialState(), "d2", "d4")).toBe("d4");
  });
});

describe("promotion", () => {
  it("appends the promoted piece", () => {
    // h-pawn walks to h7 taking the g-pawn on the way, then promotes on g8.
    const s = line([
      ["h2", "h4"], ["a7", "a6"],
      ["h4", "h5"], ["b7", "b6"],
      ["h5", "h6"], ["c7", "c6"],
      ["h6", "g7"], ["d7", "d6"],
    ]);
    const promo = getValidMoves(s).find(
      (m) => m.from === sq("g7") && m.to === sq("f8") && m.promotion === "Q",
    );
    expect(promo, "no promotion available").toBeDefined();

    // The whole string, not a pattern. A capture, a promotion and a check all
    // land on one move here, and a regex that only looked for =Q would pass on
    // notation that had lost the capture or the check.
    expect(toSan(s, promo!)).toBe("gxf8=Q+");
  });

  it("names the promoted piece rather than assuming a queen", () => {
    const s = line([
      ["h2", "h4"], ["a7", "a6"],
      ["h4", "h5"], ["b7", "b6"],
      ["h5", "h6"], ["c7", "c6"],
      ["h6", "g7"], ["d7", "d6"],
    ]);
    const knight = getValidMoves(s).find(
      (m) => m.from === sq("g7") && m.to === sq("h8") && m.promotion === "N",
    );

    expect(knight, "no knight promotion available").toBeDefined();
    // Underpromotion on the rook, which gives no check, so this also covers a
    // promotion that ends in nothing at all.
    expect(toSan(s, knight!)).toBe("gxh8=N");
  });
});
