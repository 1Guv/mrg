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

/** Valuation output returned by the API. */
export interface ValuationResult {
  plate: string;
  type: PlateType;
  midPrice: number;
  minPrice: number;
  maxPrice: number;
}

/**
 * Detect the plate type from a raw input string.
 * Tests in priority order: current, prefix, suffix, dateless.
 * @param {string} raw - Raw plate string (may include spaces).
 * @return {PlateType | null} Plate type or null if unrecognised.
 */
export function detectPlateType(raw: string): PlateType | null {
  const plate = raw.replace(/\s/g, "").toUpperCase();
  if (currentPattern.test(plate)) return "current";
  if (prefixPattern.test(plate)) return "prefix";
  if (suffixPattern.test(plate)) return "suffix";
  if (datelessPattern.test(raw.trim())) return "dateless";
  return null;
}

/**
 * Valuate a current-style plate (e.g. AB12CDE).
 * @param {string} norm - Normalised plate (no spaces, uppercase).
 * @return {ValuationResult} Valuation result.
 */
function valuateCurrent(norm: string): ValuationResult {
  let total = CurrentReg.start;

  const yearCode = norm[2] + norm[3];
  total += CurrentRegYearMultiplier[yearCode] ?? 0;

  for (const i of [2, 3]) {
    const digit = norm[i];
    const matches = PLATE_ALPHABET[digit] ?? [];
    total += matches.length > 0 ?
      AGE_IDENTIFIER_MATCH :
      AGE_IDENTIFIER_NO_MATCH;
  }

  const memTag2 =
    (norm[0] + norm[1]) as keyof typeof CurrentRegMemoryTag;
  total += CurrentRegMemoryTag[memTag2] ?? 0;

  const memTag4 = norm[0] + norm[1] + norm[2] + norm[3];
  const memTag4Key =
    memTag4 as keyof typeof CurrentRegMemoryTagAndAgeIdentifier;
  total += CurrentRegMemoryTagAndAgeIdentifier[memTag4Key] ?? 0;

  total += VALID_TWO_LETTER_COMBINATIONS[norm[0] + norm[1]] ?? 0;

  if (SPECIAL_COMBINATIONS[norm]) {
    total += SPECIAL_COMBINATIONS[norm];
  }

  for (const c of [norm, norm.slice(2), norm.slice(3), norm.slice(4)]) {
    if (POPULAR_SURNAMES[c]) {
      total += POPULAR_SURNAMES[c];
      break;
    }
  }

  for (const c of [norm.slice(0, 4), norm.slice(4)]) {
    if (POPULAR_NAMES[c]) {
      total += POPULAR_NAMES[c];
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

/**
 * Valuate a prefix-style plate (e.g. A1ABC).
 * @param {string} norm - Normalised plate (no spaces, uppercase).
 * @return {ValuationResult} Valuation result.
 */
function valuatePrefix(norm: string): ValuationResult {
  const yearLetter = norm[0];
  const total =
    PrefixReg.start + (PREFIX_YEAR_LETTER_BONUS[yearLetter] ?? 0);
  const midPrice = Math.max(0, total);
  return {
    plate: norm,
    type: "prefix",
    midPrice,
    minPrice: midPrice * 0.25,
    maxPrice: midPrice * 1.25,
  };
}

/**
 * Valuate a suffix-style plate (e.g. ABC1A).
 * @param {string} norm - Normalised plate (no spaces, uppercase).
 * @return {ValuationResult} Valuation result.
 */
function valuateSuffix(norm: string): ValuationResult {
  const yearLetter = norm[norm.length - 1];
  const total =
    SuffixReg.start + (SUFFIX_YEAR_LETTER_BONUS[yearLetter] ?? 0);
  const midPrice = Math.max(0, total);
  return {
    plate: norm,
    type: "suffix",
    midPrice,
    minPrice: midPrice * 0.25,
    maxPrice: midPrice * 1.25,
  };
}

/**
 * Valuate a dateless plate (e.g. 1 GUV, ABC 123).
 * @param {string} raw - Raw plate string preserving original spacing.
 * @return {ValuationResult} Valuation result.
 */
function valuateDateless(raw: string): ValuationResult {
  const norm = raw.replace(/\s/g, "").toUpperCase();

  const isFirstNumber = "0123456789".includes(norm[0]);
  let points = DatelessReg.start;
  points += isFirstNumber ?
    DatelessReg.numberFirst :
    DatelessReg.letterFirst;

  const lenKey = `_${norm.length}` as keyof typeof DatelessRegLength;
  points += DatelessRegLength[lenKey] ?? 0;

  for (const char of norm) {
    if ("0123456789".includes(char)) {
      const k = `_${char}` as keyof typeof DigitValues;
      points += DigitValues[k] ?? 0;
    } else {
      const k = char as keyof typeof LetterValues;
      points += LetterValues[k] ?? 0;
    }
  }

  let numCount = 0;
  let letCount = 0;
  for (const char of norm) {
    if ("0123456789".includes(char)) numCount++;
    else letCount++;
  }

  const numKey =
    `_${numCount}` as keyof typeof DatelessHowManyNumbersMultiplier;
  points += DatelessHowManyNumbersMultiplier[numKey] ?? 0;

  const letKey =
    `_${letCount}` as keyof typeof DatelessHowManyLettersMultiplier;
  points += DatelessHowManyLettersMultiplier[letKey] ?? 0;

  // Default to no-space bonus — interactive questions not applicable in API
  points += 1000;

  const multKey =
    `_${norm.length}` as keyof typeof DatelessRegMultiplier;
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

/**
 * Detect plate type and run the appropriate valuation formula.
 * @param {string} raw - Raw plate string from the API caller.
 * @return {ValuationResult | null} Result or null if plate unrecognised.
 */
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
