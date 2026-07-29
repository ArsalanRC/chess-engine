/**
 * English and German copy for the demo.
 *
 * Chess vocabulary in German is genuinely German (Schachmatt, Patt, Bauer),
 * unlike the engineering terms elsewhere in my repos. Nobody at a German
 * chessboard says "checkmate", so nothing is left in English here except the
 * API identifiers, which are code and stay code.
 *
 * Values may be functions where a string needs a number spliced into it, so
 * that German can put the number where German wants it rather than where the
 * English sentence happened to need it.
 */

export const STRINGS = {
  en: {
    "meta.title": "chess-engine · playable demo",
    "nav.source": "Source",
    "nav.github": "GitHub",
    "nav.linkedin": "LinkedIn",
    "nav.lang": "Deutsch",
    "theme.toLight": "Switch to light theme",
    "theme.toDark": "Switch to dark theme",

    "panel.readout": "Engine readout",
    "panel.moves": "Moves",
    "row.eval": "Evaluation",
    "row.depth": "Search depth",
    "row.legal": "Legal moves",
    "row.halfmove": "Halfmove clock",
    "row.fullmove": "Fullmove",
    "row.check": "In check",
    "row.ep": "En passant",
    "row.hash": "Position hash",

    "val.yes": "yes",
    "val.no": "no",
    "val.none": "none",
    "val.mateWhite": "mate/W",
    "val.mateBlack": "mate/B",

    "ctl.playAs": "Play as",
    "ctl.white": "White",
    "ctl.black": "Black",
    "ctl.engine": "Engine",
    "ctl.easy": "Easy",
    "ctl.medium": "Medium",
    "ctl.hard": "Hard",
    "ctl.undo": "Undo",
    "ctl.newGame": "New game",

    "log.empty": "No moves yet.",
    "promo.title": "Promote to",

    "status.yourMove": "Your move.",
    "status.engineMove": "Engine to move.",
    "status.check": "Check.",
    "status.thinking": "Engine thinking",
    "status.legal": (n) => `${n} legal moves.`,

    "over.checkmate": "Checkmate",
    "over.draw": "Draw",
    "over.youWin": "You win",
    "over.youLose": "You lose",
    "over.dismiss": "View board",
    "over.again": "New game",
    "over.mate": (side, move) => `${side} delivered mate on move ${move}.`,
    "over.undoHint": " Undo takes back your last move if you want another try.",
    "side.white": "White",
    "side.black": "Black",

    "draw.stalemate": "The side to move has no legal move and is not in check.",
    "draw.insufficient_material": "Neither side has enough material left to force mate.",
    "draw.fifty_move": "Fifty moves passed with no capture and no pawn move.",
    "draw.threefold_repetition": "The same position occurred three times.",

    "note.body":
      "Everything above is read straight off the engine's public API. The bar is <code>evaluate(state)</code> in centipawns, the counters come off <code>ChessGameState</code>, and the hash is what <code>hashPosition()</code> uses to detect threefold repetition.",
    "foot.built": "Built by",
    "foot.deps": "Zero runtime dependencies. Full FIDE rules.",
  },

  de: {
    "meta.title": "chess-engine · spielbare Demo",
    "nav.source": "Quellcode",
    "nav.github": "GitHub",
    "nav.linkedin": "LinkedIn",
    "nav.lang": "English",
    "theme.toLight": "Zum hellen Design wechseln",
    "theme.toDark": "Zum dunklen Design wechseln",

    "panel.readout": "Engine-Anzeige",
    "panel.moves": "Züge",
    "row.eval": "Bewertung",
    "row.depth": "Suchtiefe",
    "row.legal": "Legale Züge",
    "row.halfmove": "Halbzugzähler",
    "row.fullmove": "Zugnummer",
    "row.check": "Im Schach",
    "row.ep": "En passant",
    "row.hash": "Stellungs-Hash",

    "val.yes": "ja",
    "val.no": "nein",
    "val.none": "keins",
    "val.mateWhite": "Matt/W",
    "val.mateBlack": "Matt/S",

    "ctl.playAs": "Du spielst",
    "ctl.white": "Weiß",
    "ctl.black": "Schwarz",
    "ctl.engine": "Engine",
    "ctl.easy": "Leicht",
    "ctl.medium": "Mittel",
    "ctl.hard": "Schwer",
    "ctl.undo": "Zurück",
    "ctl.newGame": "Neues Spiel",

    "log.empty": "Noch keine Züge.",
    "promo.title": "Umwandeln in",

    "status.yourMove": "Du bist am Zug.",
    "status.engineMove": "Die Engine ist am Zug.",
    "status.check": "Schach.",
    "status.thinking": "Engine denkt",
    "status.legal": (n) => `${n} legale Züge.`,

    "over.checkmate": "Schachmatt",
    "over.draw": "Remis",
    "over.youWin": "Du gewinnst",
    "over.youLose": "Du verlierst",
    "over.dismiss": "Brett ansehen",
    "over.again": "Neues Spiel",
    "over.mate": (side, move) => `${side} setzt matt im ${move}. Zug.`,
    "over.undoHint": " Mit Zurück nimmst du deinen letzten Zug zurück und versuchst es nochmal.",
    "side.white": "Weiß",
    "side.black": "Schwarz",

    "draw.stalemate": "Die Seite am Zug hat keinen legalen Zug und steht nicht im Schach.",
    "draw.insufficient_material": "Keine Seite hat genug Material, um Matt zu erzwingen.",
    "draw.fifty_move": "Fünfzig Züge ohne Schlagzug und ohne Bauernzug.",
    "draw.threefold_repetition": "Dieselbe Stellung ist dreimal aufgetreten.",

    "note.body":
      "Alles hier oben kommt direkt aus der öffentlichen API der Engine. Der Balken ist <code>evaluate(state)</code> in Centipawns, die Zähler stammen aus <code>ChessGameState</code>, und der Hash ist genau der, mit dem <code>hashPosition()</code> die dreifache Stellungswiederholung erkennt.",
    "foot.built": "Gebaut von",
    "foot.deps": "Keine Laufzeit-Abhängigkeiten. Vollständige FIDE-Regeln.",
  },
};

let current = "en";

/** Look up a key. Returns a string, or calls it with args when it is a template. */
export function t(key, ...args) {
  const value = STRINGS[current]?.[key] ?? STRINGS.en[key];
  return typeof value === "function" ? value(...args) : value ?? key;
}

export function setLang(lang) {
  current = STRINGS[lang] ? lang : "en";
  return current;
}

export function getLang() {
  return current;
}
