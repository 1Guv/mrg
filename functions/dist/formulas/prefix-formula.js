"use strict";
// Prefix plates — base price £1,500
// Full scoring formula to be defined in a future session.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PREFIX_YEAR_LETTER_BONUS = exports.PREFIX_YEAR_LETTER_YEAR = exports.PrefixReg = void 0;
exports.PrefixReg = { start: 1500 };
// Year letter → year range (for display)
exports.PREFIX_YEAR_LETTER_YEAR = {
    "A": "1983–84",
    "B": "1984–85",
    "C": "1985–86",
    "D": "1986–87",
    "E": "1987–88",
    "F": "1988–89",
    "G": "1989–90",
    "H": "1990–91",
    "J": "1991–92",
    "K": "1992–93",
    "L": "1993–94",
    "M": "1994–95",
    "N": "1995–96",
    "P": "1996–97",
    "R": "1997–98",
    "S": "1998–99",
    "T": "1999–00",
    "V": "2000–01",
    "W": "2000–01",
    "X": "2000–01",
    "Y": "2001",
};
// Year letter bonus — older letters are rarer and worth more.
// Y (2001) = £2,000 base, each step back adds £500, so A (1983–84) = £12,000.
exports.PREFIX_YEAR_LETTER_BONUS = {
    "Y": 2000, // 2001
    "X": 2500, // 2000–01
    "W": 3000, // 2000–01
    "V": 3500, // 2000–01
    "T": 4000, // 1999–00
    "S": 4500, // 1998–99
    "R": 5000, // 1997–98
    "P": 5500, // 1996–97
    "N": 6000, // 1995–96
    "M": 6500, // 1994–95
    "L": 7000, // 1993–94
    "K": 7500, // 1992–93
    "J": 8000, // 1991–92
    "H": 8500, // 1990–91
    "G": 9000, // 1989–90
    "F": 9500, // 1988–89
    "E": 10000, // 1987–88
    "D": 10500, // 1986–87
    "C": 11000, // 1985–86
    "B": 11500, // 1984–85
    "A": 12000, // 1983–84
};
//# sourceMappingURL=prefix-formula.js.map