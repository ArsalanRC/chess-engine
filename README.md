# chess-engine

**English** · [Deutsch](./README.de.md)

A complete chess engine in TypeScript. Full FIDE rules, a minimax bot with alpha-beta pruning, and **zero runtime dependencies**.

No board, no renderer, no framework. It takes a position and gives you legal moves, new positions and game results. What you draw with that is up to you.

### [Play it in your browser](https://arsalanrc.github.io/chess-engine/)

The demo puts the engine's internals on screen next to the board: live evaluation, legal move count, halfmove clock and the raw position hash used for repetition detection. It loads the compiled library as plain ES modules, with no bundler in the way.

```bash
pnpm add github:ArsalanRC/chess-engine
```

> Installed straight from the repository: the `prepare` script compiles it on install, so there is
> no build step for you. **pnpm rather than npm** is deliberate. npm runs dependency `postinstall`
> scripts by default, which is the main supply-chain attack vector in this ecosystem; pnpm blocks
> them unless each one is named. Same registry, safer default.

## Quick start

```ts
import { createInitialState, getValidMoves, applyMove, selectBotMove } from "@arsalanrc/chess-engine";

let state = createInitialState();

// Every legal move for the side to move, king safety already accounted for.
const moves = getValidMoves(state);   // 20 from the opening position

// Apply one. `state` is never mutated, a new state comes back.
state = applyMove(state, moves[0]);

// Let the bot answer.
const reply = selectBotMove(state, "hard");
if (reply) state = applyMove(state, reply);

console.log(state.turnColor, state.check, state.gameResult);
```

## Design

**The state is immutable.** `applyMove` returns a new `ChessGameState` and never touches the one you passed in. Undo becomes a matter of keeping the old reference, and the search can explore as deeply as it likes without ever corrupting the caller's position.

**Move generation is legal, not pseudo-legal.** `getValidMoves` already filters out moves that would leave your own king in check, so anything it hands back is playable. If you want the faster unfiltered version, `getPseudoLegalMovesFrom` is exported too.

**It is pure.** No I/O, no globals, no clock, no framework imports. The same code runs in a browser, in Node, and inside the bot's search loop. Give it the same position and you get the same moves every time, which is exactly what makes it testable.

## Rules covered

Everything, including the parts engines usually skip:

| | |
|---|---|
| Piece movement | All six types, sliding and stepping |
| Castling | Both sides, with the full legality check: rights, empty squares, and no castling out of, through, or into check |
| En passant | Including correct removal of the captured pawn from its own square |
| Promotion | Queen, rook, bishop, knight. Capture-and-promote generates all four |
| Check and checkmate | Full attack detection |
| Stalemate | Draw when the side to move has no legal move and is not in check |
| Fifty-move rule | Halfmove clock, reset on captures and pawn moves |
| Threefold repetition | Position hashing that excludes move counters, as the rule requires |
| Insufficient material | K vs K, K+minor vs K, and K+B vs K+B on same-coloured squares |

## The bot

Minimax with alpha-beta pruning. Evaluation is material plus piece-square tables in centipawns, positive for white, with the tables mirrored for black so each side reads its own from rank 1.

| Difficulty | Depth | Behaviour |
|---|---|---|
| `easy` | 2 | Plays an outright random legal move 20% of the time, so it is beatable on purpose |
| `medium` | 3 | Takes free material |
| `hard` | 4 | Finds mate-in-one and avoids hanging its queen |

Moves are ordered captures-first by victim value before the search runs, which is what makes the pruning actually bite. Checkmate scores carry a depth penalty, so a mate in one is always preferred over a mate in three.

Moves the evaluation rates **equally** are chosen between at random, so repeated games do not open identically. This costs no strength, since it only reorders moves the engine already considers the same. Without it, a strict `>` comparison hands every tie to whichever move generation emitted first. In a symmetric opening almost everything ties, so the engine opens the same way forever.

For a game that replays identically, supply your own generator:

```ts
selectBotMove(state, "hard", { random: seededRandom(42) });
```

## Board representation

A flat 64-element array, where `index = rank * 8 + file`.

```
rank 7  56 57 58 59 60 61 62 63   ← black's back rank (a8..h8)
rank 6  48 49 50 51 52 53 54 55
  ...
rank 1   8  9 10 11 12 13 14 15
rank 0   0  1  2  3  4  5  6  7   ← white's back rank (a1..h1)
        file 0 = a-file          file 7 = h-file
```

Empty squares are `null`. The helpers `fileOf`, `rankOf` and `frToSq` convert both ways.

## API

| Export | Purpose |
|---|---|
| `createInitialState()` | A fresh game in the standard opening position |
| `getValidMoves(state)` | Every fully-legal move for the side to move |
| `applyMove(state, move)` | New state with all bookkeeping applied |
| `selectBotMove(state, difficulty)` | The bot's choice, or `null` if the game is over |
| `evaluate(state)` | Centipawn score, positive for white |
| `isInCheck(board, color)` | Whether that colour's king is attacked |
| `isSquareAttacked(board, sq, byColor)` | Attack detection for a single square |
| `findKing(board, color)` | Square index of a king |
| `hashPosition(...)` | Position hash used for repetition detection |
| `isInsufficientMaterial(board)` | Material-draw check |
| `isThreefoldRepetition(history)` | Repetition check over a position history |

The types (`ChessGameState`, `ChessMove`, `ChessPiece`, `ChessBoard`, `CastlingRights`, `GameResult`, `DrawReason`, `BotDifficulty`) are all exported as well.

## Development

```bash
pnpm install
ppnpm test          # 47 tests
ppnpm run type-check
ppnpm run build
```

## Background

This engine started life inside a larger game platform of mine, where the architectural rule was that game logic must never import React. Extracting it here meant decoupling it from that platform's player model, which is why the API now talks about *positions* and *colours* instead of *players* and *sessions*. It is a cleaner boundary than the one it had originally.

## Author

Arsalan Khadim · [LinkedIn](https://www.linkedin.com/in/muhammad-arsalan-khadim-b87550259/) · [GitHub](https://github.com/ArsalanRC)

## Licence

MIT © Arsalan Khadim
