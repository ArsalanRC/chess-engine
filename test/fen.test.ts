/**
 * FEN export.
 *
 * Every expected string here is written out by hand from the standard rather
 * than captured from a run, because a test that records whatever the code
 * produced only proves the code is deterministic.
 */

import { describe, expect, it } from "vitest";
import { applyMove, createInitialState, getValidMoves, toFen } from "../src/index.js";
import type { ChessGameState } from "../src/index.js";

/** Play a move given in plain coordinates, so the tests read like a game. */
function play(state: ChessGameState, from: string, to: string): ChessGameState {
  const sq = (s: string) => (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
  const move = getValidMoves(state).find((m) => m.from === sq(from) && m.to === sq(to));
  if (!move) throw new Error(`${from}${to} is not legal here`);
  return applyMove(state, move);
}

describe("toFen", () => {
  it("writes the starting position exactly", () => {
    expect(toFen(createInitialState())).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });

  it("run-length encodes empty squares rather than repeating ones", () => {
    const fen = toFen(createInitialState());
    expect(fen).toContain("/8/8/8/8/");
    expect(fen).not.toContain("11111111");
  });

  it("puts rank 8 first, not rank 1", () => {
    // A board written the wrong way round is still a valid-looking FEN and
    // describes a mirrored position, so this is checked explicitly.
    const placement = toFen(createInitialState()).split(" ")[0]!;
    expect(placement.split("/")[0]).toBe("rnbqkbnr");
    expect(placement.split("/")[7]).toBe("RNBQKBNR");
  });
});

describe("the en passant field", () => {
  it("is the square behind the pawn, not the pawn's own square", () => {
    // The field people get wrong. After 1. e4 the pawn stands on e4 and the
    // target is e3, the square a capturing pawn would land on.
    const afterE4 = play(createInitialState(), "e2", "e4");
    expect(toFen(afterE4).split(" ")[3]).toBe("e3");

    const afterC5 = play(afterE4, "c7", "c5");
    expect(toFen(afterC5).split(" ")[3]).toBe("c6");
  });

  it("clears once the chance has passed", () => {
    let s = play(createInitialState(), "e2", "e4");
    s = play(s, "b8", "c6");
    expect(toFen(s).split(" ")[3]).toBe("-");
  });

  it("is not set by a one-square pawn move", () => {
    const s = play(createInitialState(), "e2", "e3");
    expect(toFen(s).split(" ")[3]).toBe("-");
  });
});

describe("the clocks", () => {
  it("resets the halfmove clock on a pawn move and increments otherwise", () => {
    let s = play(createInitialState(), "g1", "f3");
    expect(toFen(s).split(" ")[4]).toBe("1");
    s = play(s, "g8", "f6");
    expect(toFen(s).split(" ")[4]).toBe("2");
    s = play(s, "e2", "e4");
    expect(toFen(s).split(" ")[4]).toBe("0");
  });

  it("resets the halfmove clock on a capture", () => {
    let s = play(createInitialState(), "e2", "e4");
    s = play(s, "d7", "d5");
    s = play(s, "g1", "f3");
    expect(toFen(s).split(" ")[4]).toBe("1");
    s = play(s, "d5", "e4");
    expect(toFen(s).split(" ")[4]).toBe("0");
  });

  it("increments the fullmove number after black moves, not after white", () => {
    let s = createInitialState();
    expect(toFen(s).split(" ")[5]).toBe("1");
    s = play(s, "e2", "e4");
    expect(toFen(s).split(" ")[5]).toBe("1");
    s = play(s, "e7", "e5");
    expect(toFen(s).split(" ")[5]).toBe("2");
  });
});

describe("castling rights", () => {
  it("drops one side when its rook moves", () => {
    let s = play(createInitialState(), "h2", "h4");
    s = play(s, "a7", "a5");
    s = play(s, "h1", "h3");
    expect(toFen(s).split(" ")[2]).toBe("Qkq");
  });

  it("drops both when the king moves", () => {
    let s = play(createInitialState(), "e2", "e4");
    s = play(s, "e7", "e5");
    s = play(s, "e1", "e2");
    expect(toFen(s).split(" ")[2]).toBe("kq");
  });

  it("writes a dash when nobody can castle", () => {
    let s = play(createInitialState(), "e2", "e4");
    s = play(s, "e7", "e5");
    s = play(s, "e1", "e2");
    s = play(s, "e8", "e7");
    expect(toFen(s).split(" ")[2]).toBe("-");
  });
});

describe("the side to move", () => {
  it("flips after each move", () => {
    const s = createInitialState();
    expect(toFen(s).split(" ")[1]).toBe("w");
    expect(toFen(play(s, "e2", "e4")).split(" ")[1]).toBe("b");
  });
});
