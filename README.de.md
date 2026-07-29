# chess-engine

[English](./README.md) · **Deutsch**

Eine vollständige Schach-Engine in TypeScript. Alle FIDE-Regeln, ein Minimax-Bot mit Alpha-Beta-Pruning und **keine einzige Laufzeit-Abhängigkeit**.

Kein Brett, kein Renderer, kein Framework. Die Engine nimmt eine Stellung entgegen und liefert legale Züge, neue Stellungen und das Partieergebnis. Was du damit zeichnest, bleibt dir überlassen.

### [Im Browser spielen](https://arsalanrc.github.io/chess-engine/)

Die Demo legt die Innenansicht der Engine neben das Brett: laufende Bewertung, Anzahl legaler Züge, Halbzugzähler und der rohe Stellungs-Hash, mit dem die dreifache Stellungswiederholung erkannt wird. Geladen wird die kompilierte Bibliothek als reine ES-Module, ohne Bundler dazwischen.

```bash
npm install @arsalanrc/chess-engine
```

## Schnellstart

```ts
import { createInitialState, getValidMoves, applyMove, selectBotMove } from "@arsalanrc/chess-engine";

let state = createInitialState();

// Alle legalen Züge der Seite am Zug, Königssicherheit ist bereits berücksichtigt.
const moves = getValidMoves(state);   // 20 in der Grundstellung

// Einen davon anwenden. `state` wird nie verändert, es kommt ein neuer zurück.
state = applyMove(state, moves[0]);

// Die Engine antworten lassen.
const reply = selectBotMove(state, "hard");
if (reply) state = applyMove(state, reply);

console.log(state.turnColor, state.check, state.gameResult);
```

## Entwurf

**Der State ist unveränderlich.** `applyMove` gibt einen neuen `ChessGameState` zurück und rührt den übergebenen nicht an. Rückgängigmachen heißt damit schlicht, die alte Referenz aufzuheben, und die Suche kann beliebig tief wühlen, ohne je die Stellung des Aufrufers zu beschädigen.

**Die Zuggenerierung ist legal, nicht pseudo-legal.** `getValidMoves` filtert Züge, die den eigenen König im Schach zurücklassen würden, bereits heraus. Alles, was zurückkommt, ist spielbar. Wer die schnellere ungefilterte Variante braucht, findet sie in `getPseudoLegalMovesFrom`.

**Die Engine ist rein.** Kein I/O, keine Globals, keine Uhr, keine Framework-Importe. Derselbe Code läuft im Browser, in Node und in der Suchschleife des Bots. Gleiche Stellung, gleiche Züge, jedes Mal. Genau das macht sie testbar.

## Abgedeckte Regeln

Vollständig, samt der Teile, die Engines gern auslassen:

| | |
|---|---|
| Figurenbewegung | Alle sechs Typen, gleitend und springend |
| Rochade | Beide Seiten, mit vollständiger Legalitätsprüfung: Rechte, freie Felder, kein Rochieren aus dem, durch das oder ins Schach |
| En passant | Inklusive korrektem Entfernen des geschlagenen Bauern von seinem eigenen Feld |
| Umwandlung | Dame, Turm, Läufer, Springer. Schlagen und Umwandeln erzeugt alle vier Möglichkeiten |
| Schach und Matt | Vollständige Angriffserkennung |
| Patt | Remis, wenn die Seite am Zug keinen legalen Zug hat und nicht im Schach steht |
| 50-Züge-Regel | Halbzugzähler, zurückgesetzt bei Schlagzug und Bauernzug |
| Dreifache Wiederholung | Stellungs-Hash ohne Zugzähler, so wie die Regel es verlangt |
| Ungenügendes Material | K gegen K, K+Leichtfigur gegen K, K+L gegen K+L auf gleichfarbigen Feldern |

## Der Bot

Minimax mit Alpha-Beta-Pruning. Bewertet wird Material plus Piece-Square-Tables in Centipawns, positiv für Weiß, wobei die Tabellen für Schwarz gespiegelt werden, damit jede Seite ihre eigene ab Reihe 1 liest.

| Stufe | Tiefe | Verhalten |
|---|---|---|
| `easy` | 2 | Spielt in 20 % der Fälle einen komplett zufälligen legalen Zug, ist also mit Absicht schlagbar |
| `medium` | 3 | Nimmt freies Material mit |
| `hard` | 4 | Findet Matt in eins und stellt die Dame nicht ein |

Züge werden vor der Suche nach Schlagwert sortiert, Schlagzüge zuerst. Erst dadurch greift das Pruning überhaupt. Mattbewertungen tragen einen Tiefenabschlag, damit ein Matt in eins immer einem Matt in drei vorgezogen wird.

Züge, die die Bewertung **gleich** einstuft, werden zufällig ausgewählt, damit nicht jede Partie identisch eröffnet. Das kostet keine Spielstärke, denn es sortiert nur um, was die Engine ohnehin für gleichwertig hält. Ohne das entscheidet ein striktes `>` jeden Gleichstand zugunsten dessen, was die Zuggenerierung zuerst ausgespuckt hat, und in einer symmetrischen Eröffnung ist fast alles gleichwertig. Die Engine eröffnet dann für immer gleich.

Für eine reproduzierbare Partie übergibst du deinen eigenen Generator:

```ts
selectBotMove(state, "hard", { random: seededRandom(42) });
```

## Brettdarstellung

Ein flaches Array mit 64 Feldern, `index = rank * 8 + file`.

```
Reihe 7  56 57 58 59 60 61 62 63   ← Grundreihe Schwarz (a8..h8)
Reihe 6  48 49 50 51 52 53 54 55
  ...
Reihe 1   8  9 10 11 12 13 14 15
Reihe 0   0  1  2  3  4  5  6  7   ← Grundreihe Weiß (a1..h1)
        Linie 0 = a-Linie         Linie 7 = h-Linie
```

Leere Felder sind `null`. Die Helfer `fileOf`, `rankOf` und `frToSq` rechnen in beide Richtungen um.

## API

| Export | Zweck |
|---|---|
| `createInitialState()` | Neue Partie in der Grundstellung |
| `getValidMoves(state)` | Alle vollständig legalen Züge der Seite am Zug |
| `applyMove(state, move)` | Neuer State mit allen Buchhaltungsdetails |
| `selectBotMove(state, difficulty)` | Die Wahl des Bots, oder `null` wenn die Partie vorbei ist |
| `evaluate(state)` | Centipawn-Bewertung, positiv für Weiß |
| `isInCheck(board, color)` | Steht der König dieser Farbe im Schach |
| `isSquareAttacked(board, sq, byColor)` | Angriffserkennung für ein einzelnes Feld |
| `findKing(board, color)` | Feldindex eines Königs |
| `hashPosition(...)` | Stellungs-Hash für die Wiederholungserkennung |
| `isInsufficientMaterial(board)` | Prüfung auf Materialremis |
| `isThreefoldRepetition(history)` | Wiederholungsprüfung über eine Stellungshistorie |

Die Typen (`ChessGameState`, `ChessMove`, `ChessPiece`, `ChessBoard`, `CastlingRights`, `GameResult`, `DrawReason`, `BotDifficulty`) werden ebenfalls exportiert.

## Entwicklung

```bash
pnpm install
pnpm test          # 47 Tests
pnpm run type-check
pnpm run build
```

## Hintergrund

Die Engine entstand ursprünglich in einer größeren Spieleplattform von mir, in der die Architekturregel galt: Spiellogik importiert niemals React. Beim Herauslösen musste sie vom Spielermodell dieser Plattform getrennt werden. Deshalb spricht die API heute von *Stellungen* und *Farben* statt von *Spielern* und *Sessions*. Das ist eine sauberere Grenze als die ursprüngliche.

## Autor

Arsalan Khadim · [LinkedIn](https://www.linkedin.com/in/muhammad-arsalan-khadim-b87550259/) · [GitHub](https://github.com/ArsalanRC)

## Lizenz

MIT © Arsalan Khadim
