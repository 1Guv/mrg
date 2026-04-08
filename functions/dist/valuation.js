"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPlateType = detectPlateType;
exports.valuatePlate = valuatePlate;
const current_js_1 = require("./regex-plate-patterns/current.js");
const prefix_js_1 = require("./regex-plate-patterns/prefix.js");
const suffix_js_1 = require("./regex-plate-patterns/suffix.js");
const dateless_js_1 = require("./regex-plate-patterns/dateless.js");
const current_formula_js_1 = require("./formulas/current-formula.js");
const prefix_formula_js_1 = require("./formulas/prefix-formula.js");
const suffix_formula_js_1 = require("./formulas/suffix-formula.js");
const dateless_formula_js_1 = require("./formulas/dateless-formula.js");
/**
 * Detect the plate type from a raw input string.
 * Tests in priority order: current, prefix, suffix, dateless.
 * @param {string} raw - Raw plate string (may include spaces).
 * @return {PlateType | null} Plate type or null if unrecognised.
 */
function detectPlateType(raw) {
    const plate = raw.replace(/\s/g, "").toUpperCase();
    if (current_js_1.currentPattern.test(plate))
        return "current";
    if (prefix_js_1.prefixPattern.test(plate))
        return "prefix";
    if (suffix_js_1.suffixPattern.test(plate))
        return "suffix";
    if (dateless_js_1.datelessPattern.test(raw.trim()))
        return "dateless";
    return null;
}
/**
 * Valuate a current-style plate (e.g. AB12CDE).
 * @param {string} norm - Normalised plate (no spaces, uppercase).
 * @return {ValuationResult} Valuation result.
 */
function valuateCurrent(norm) {
    var _a, _b, _c, _d, _e;
    let total = current_formula_js_1.CurrentReg.start;
    const yearCode = norm[2] + norm[3];
    total += (_a = current_formula_js_1.CurrentRegYearMultiplier[yearCode]) !== null && _a !== void 0 ? _a : 0;
    for (const i of [2, 3]) {
        const digit = norm[i];
        const matches = (_b = current_formula_js_1.PLATE_ALPHABET[digit]) !== null && _b !== void 0 ? _b : [];
        total += matches.length > 0 ?
            current_formula_js_1.AGE_IDENTIFIER_MATCH :
            current_formula_js_1.AGE_IDENTIFIER_NO_MATCH;
    }
    const memTag2 = (norm[0] + norm[1]);
    total += (_c = current_formula_js_1.CurrentRegMemoryTag[memTag2]) !== null && _c !== void 0 ? _c : 0;
    const memTag4 = norm[0] + norm[1] + norm[2] + norm[3];
    const memTag4Key = memTag4;
    total += (_d = current_formula_js_1.CurrentRegMemoryTagAndAgeIdentifier[memTag4Key]) !== null && _d !== void 0 ? _d : 0;
    total += (_e = current_formula_js_1.VALID_TWO_LETTER_COMBINATIONS[norm[0] + norm[1]]) !== null && _e !== void 0 ? _e : 0;
    if (current_formula_js_1.SPECIAL_COMBINATIONS[norm]) {
        total += current_formula_js_1.SPECIAL_COMBINATIONS[norm];
    }
    for (const c of [norm, norm.slice(2), norm.slice(3), norm.slice(4)]) {
        if (current_formula_js_1.POPULAR_SURNAMES[c]) {
            total += current_formula_js_1.POPULAR_SURNAMES[c];
            break;
        }
    }
    for (const c of [norm.slice(0, 4), norm.slice(4)]) {
        if (current_formula_js_1.POPULAR_NAMES[c]) {
            total += current_formula_js_1.POPULAR_NAMES[c];
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
function valuatePrefix(norm) {
    var _a;
    const yearLetter = norm[0];
    const total = prefix_formula_js_1.PrefixReg.start + ((_a = prefix_formula_js_1.PREFIX_YEAR_LETTER_BONUS[yearLetter]) !== null && _a !== void 0 ? _a : 0);
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
function valuateSuffix(norm) {
    var _a;
    const yearLetter = norm[norm.length - 1];
    const total = suffix_formula_js_1.SuffixReg.start + ((_a = suffix_formula_js_1.SUFFIX_YEAR_LETTER_BONUS[yearLetter]) !== null && _a !== void 0 ? _a : 0);
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
function valuateDateless(raw) {
    var _a, _b, _c, _d, _e, _f;
    const norm = raw.replace(/\s/g, "").toUpperCase();
    const isFirstNumber = "0123456789".includes(norm[0]);
    let points = dateless_formula_js_1.DatelessReg.start;
    points += isFirstNumber ?
        dateless_formula_js_1.DatelessReg.numberFirst :
        dateless_formula_js_1.DatelessReg.letterFirst;
    const lenKey = `_${norm.length}`;
    points += (_a = dateless_formula_js_1.DatelessRegLength[lenKey]) !== null && _a !== void 0 ? _a : 0;
    for (const char of norm) {
        if ("0123456789".includes(char)) {
            const k = `_${char}`;
            points += (_b = dateless_formula_js_1.DigitValues[k]) !== null && _b !== void 0 ? _b : 0;
        }
        else {
            const k = char;
            points += (_c = dateless_formula_js_1.LetterValues[k]) !== null && _c !== void 0 ? _c : 0;
        }
    }
    let numCount = 0;
    let letCount = 0;
    for (const char of norm) {
        if ("0123456789".includes(char))
            numCount++;
        else
            letCount++;
    }
    const numKey = `_${numCount}`;
    points += (_d = dateless_formula_js_1.DatelessHowManyNumbersMultiplier[numKey]) !== null && _d !== void 0 ? _d : 0;
    const letKey = `_${letCount}`;
    points += (_e = dateless_formula_js_1.DatelessHowManyLettersMultiplier[letKey]) !== null && _e !== void 0 ? _e : 0;
    // Default to no-space bonus — interactive questions not applicable in API
    points += 1000;
    const multKey = `_${norm.length}`;
    const multiplier = (_f = dateless_formula_js_1.DatelessRegMultiplier[multKey]) !== null && _f !== void 0 ? _f : 1;
    const midPrice = Math.max(0, points * multiplier);
    return {
        plate: norm,
        type: "dateless",
        midPrice,
        minPrice: midPrice - midPrice * dateless_formula_js_1.MinMaxTotals.min,
        maxPrice: midPrice + midPrice * dateless_formula_js_1.MinMaxTotals.max,
    };
}
/**
 * Detect plate type and run the appropriate valuation formula.
 * @param {string} raw - Raw plate string from the API caller.
 * @return {ValuationResult | null} Result or null if plate unrecognised.
 */
function valuatePlate(raw) {
    const type = detectPlateType(raw);
    if (!type)
        return null;
    const norm = raw.replace(/\s/g, "").toUpperCase();
    switch (type) {
        case "current": return valuateCurrent(norm);
        case "prefix": return valuatePrefix(norm);
        case "suffix": return valuateSuffix(norm);
        case "dateless": return valuateDateless(raw);
    }
}
//# sourceMappingURL=valuation.js.map