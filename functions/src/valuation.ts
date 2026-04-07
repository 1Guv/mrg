import {currentPattern} from "./regex-plate-patterns/current.js";
import {prefixPattern} from "./regex-plate-patterns/prefix.js";
import {suffixPattern} from "./regex-plate-patterns/suffix.js";
import {datelessPattern} from "./regex-plate-patterns/dateless.js";

import {
  CurrentReg,
  CurrentRegYearMultiplier,
  CurrentRegMemoryTag,
  CurrentRegMemoryTagAndAgeIdentifier,
  PLATE_ALPHABET,
  POPULAR_SURNAMES,
  POPULAR_NAMES,
  SPECIAL_COMBINATIONS,
  VALID_TWO_LETTER_COMBINATIONS,
  AGE_IDENTIFIER_MATCH,
  AGE_IDENTIFIER_NO_MATCH,
} from "./formulas/current-formula.js";

import {
  PrefixReg,
  PREFIX_YEAR_LETTER_BONUS,
} from "./formulas/prefix-formula.js";

import {
  SuffixReg,
  SUFFIX_YEAR_LETTER_BONUS,
} from "./formulas/suffix-formula.js";

import {
  DatelessReg,
  DatelessRegLength,
  DatelessRegMultiplier,
  DatelessHowManyNumbersMultiplier,
  DatelessHowManyLettersMultiplier,
  LetterValues,
  DigitValues,
  MinMaxTotals,
} from "./formulas/dateless-formula.js";

export type PlateType = "current" | "prefix" | "suffix" | "dateless";

export interface ValuationResult {
  plate: string;
  type: PlateType;
  midPrice: number;
  minPrice: number;
  maxPrice: number;
}

/**
 * Normalise: strip spaces, uppercase.
 * Detect plate type in priority order: current → prefix → suffix → dateless.
 * Returns null if no pattern matches.
 */
export function detectPlateType(raw: string): PlateType | null {
  const plate = raw.replace(/\s/g, "").toUpperCase();
  if (currentPattern.test(plate)) return "current";
  if (prefixPattern.test(plate)) return "prefix";
  if (suffixPattern.test(plate)) return "suffix";
  if (datelessPattern.test(raw.trim())) return "dateless";
  return null;
}

// ─── Current ──────────────────────────────────────────────────────────────────

function valuateCurrent(norm: string): ValuationResult {
  let total = CurrentReg.start;

  // Year code bonus (chars at index 2–3)
  const yearCode = norm[2] + norm[3];
  total += CurrentRegYearMultiplier[yearCode] ?? 0;

  // Age identifier match bonus — digits at positions 2 & 3
  // If PLATE_ALPHABET has an entry for that character it's a number-as-letter match
  for (const i of [2, 3]) {
    const digit = norm[i];
    const matches = PLATE_ALPHABET[digit] ?? [];
    total += matches.length > 0 ? AGE_IDENTIFIER_MATCH : AGE_IDENTIFIER_NO_MATCH;
  }

  // Memory tag bonus — first 2 chars
  const memTag2 = (norm[0] + norm[1]) as keyof typeof CurrentRegMemoryTag;
  total += CurrentRegMemoryTag[memTag2] ?? 0;

  // Memory tag + age identifier — first 4 chars
  const memTag4Key =
    (norm[0] + norm[1] + norm[2] + norm[3]) as keyof typeof CurrentRegMemoryTagAndAgeIdentifier;
  total += CurrentRegMemoryTagAndAgeIdentifier[memTag4Key] ?? 0;

  // Valid two-letter combo bonus — first 2 chars
  total += VALID_TWO_LETTER_COMBINATIONS[norm[0] + norm[1]] ?? 0;

  // Special full-plate combination
  if (SPECIAL_COMBINATIONS[norm]) {
    total += SPECIAL_COMBINATIONS[norm];
  }

  // Surname detection — check: all 7, last 5, last 4, last 3
  for (const candidate of [norm, norm.slice(2), norm.slice(3), norm.slice(4)]) {
    if (POPULAR_SURNAMES[candidate]) {
      total += POPULAR_SURNAMES[candidate];
      break;
    }
  }

  // Name detection — first 4 chars and last 3 chars
  for (const candidate of [norm.slice(0, 4), norm.slice(4)]) {
    if (POPULAR_NAMES[candidate]) {
      total += POPULAR_NAMES[candidate];
    }
  }

  const midPrice = Math.max(0, total);
  return {
    plate: norm,
    type: "current",
    midPrice,
    minPrice: midPrice * 0.25,
    maxPrice: midPrice * 1.25,
  };
}

// ─── Prefix ───────────────────────────────────────────────────────────────────

function valuatePrefix(norm: string): ValuationResult {
  const yearLetter = norm[0];
  const total = PrefixReg.start + (PREFIX_YEAR_LETTER_BONUS[yearLetter] ?? 0);
  const midPrice = Math.max(0, total);
  return {
    plate: norm,
    type: "prefix",
    midPrice,
    minPrice: midPrice * 0.25,
    maxPrice: midPrice * 1.25,
  };
}

// ─── Suffix ───────────────────────────────────────────────────────────────────

function valuateSuffix(norm: string): ValuationResult {
  const yearLetter = norm[norm.length - 1];
  const total = SuffixReg.start + (SUFFIX_YEAR_LETTER_BONUS[yearLetter] ?? 0);
  const midPrice = Math.max(0, total);
  return {
    plate: norm,
    type: "suffix",
    midPrice,
    minPrice: midPrice * 0.25,
    maxPrice: midPrice * 1.25,
  };
}

// ─── Dateless ─────────────────────────────────────────────────────────────────

function valuateDateless(raw: string): ValuationResult {
  const norm = raw.replace(/\s/g, "").toUpperCase();

  // Base: letter-first or number-first
  const isFirstCharNumber = "0123456789".includes(norm[0]);
  let points = DatelessReg.start;
  points += isFirstCharNumber ? DatelessReg.numberFirst : DatelessReg.letterFirst;

  // Length points
  const lenKey = `_${norm.length}` as keyof typeof DatelessRegLength;
  points += DatelessRegLength[lenKey] ?? 0;

  // Character points
  for (const char of norm) {
    if ("0123456789".includes(char)) {
      points += DigitValues[`_${char}` as keyof typeof DigitValues] ?? 0;
    } else {
      points += LetterValues[char as keyof typeof LetterValues] ?? 0;
    }
  }

  // How-many-numbers / how-many-letters multiplier points
  let numCount = 0;
  let letCount = 0;
  for (const char of norm) {
    if ("0123456789".includes(char)) numCount++;
    else letCount++;
  }
  points += DatelessHowManyNumbersMultiplier[
    `_${numCount}` as keyof typeof DatelessHowManyNumbersMultiplier
  ] ?? 0;
  points += DatelessHowManyLettersMultiplier[
    `_${letCount}` as keyof typeof DatelessHowManyLettersMultiplier
  ] ?? 0;

  // Spacing: default to no-spaces bonus (1000) — interactive penalties not applicable in API
  points += 1000;

  // Multiplier
  const multKey = `_${norm.length}` as keyof typeof DatelessRegMultiplier;
  const multiplier = DatelessRegMultiplier[multKey] ?? 1;

  const midPrice = Math.max(0, points * multiplier);
  return {
    plate: norm,
    type: "dateless",
    midPrice,
    minPrice: midPrice - midPrice * MinMaxTotals.min,
    maxPrice: midPrice + midPrice * MinMaxTotals.max,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function valuatePlate(raw: string): ValuationResult | null {
  const type = detectPlateType(raw);
  if (!type) return null;
  const norm = raw.replace(/\s/g, "").toUpperCase();
  switch (type) {
    case "current": return valuateCurrent(norm);
    case "prefix": return valuatePrefix(norm);
    case "suffix": return valuateSuffix(norm);
    case "dateless": return valuateDateless(raw);
  }
}
