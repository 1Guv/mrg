# Plate Valuation API — Design

**Goal:** A Firebase Cloud Function HTTP endpoint that accepts a plate string and API key, detects the plate type, runs the valuation formula, and returns a JSON price object.

**Architecture:** Single `onRequest` Cloud Function (`valuePlate`). Plate type detection uses the existing regex patterns (copied into functions). Valuation logic for each type is ported from the Angular components into a self-contained `functions/src/valuation.ts` module. API key is a single static value stored as Firebase Secret `VALUATION_API_KEY`.

**Tech Stack:** Firebase Functions v2 `onRequest`, TypeScript, existing formula constants, Firebase Secret Manager.

---

## URL

```
GET https://valueplate-<hash>-uc.a.run.app?plate=AB12CDE&key=YOUR_KEY
```

The Cloud Run URL is shown after first deploy. The `plate` param is case-insensitive and spaces are stripped before processing.

---

## Request

| Param | Required | Description |
|-------|----------|-------------|
| `plate` | Yes | Plate string e.g. `AB12CDE`, `16UV`, `F123 ABC` |
| `key` | Yes | API key matching `VALUATION_API_KEY` secret |

---

## Response

**200 OK:**
```json
{
  "plate": "AB12CDE",
  "type": "current",
  "midPrice": 1200.00,
  "minPrice": 900.00,
  "maxPrice": 1500.00
}
```

**401 Unauthorized:**
```json
{ "error": "Missing or invalid API key" }
```

**400 Bad Request:**
```json
{ "error": "Missing plate parameter" }
{ "error": "Plate format not recognised" }
```

---

## Plate Type Detection

Strip spaces and uppercase, then test in this order (most specific first):

1. `currentPattern` → `/^([A-Z]{2}[0-9]{2}[A-Z]{3})$/` → type: `current`
2. `prefixPattern` → `/^([A-Z][0-9]{1,3}[A-Z]{3})$/` → type: `prefix`
3. `suffixPattern` → `/^[A-Z]{3}[0-9]{1,3}[A-Z]{1}$/` → type: `suffix`
4. `datelessPattern` → see dateless.ts → type: `dateless`
5. No match → 400

---

## Valuation Logic per Type

### Current (`AB12CDE`)
Port from `current-plate-valuation.component.ts`. Imports from `current-formula.ts`:
- Base: `CurrentReg.start` (250)
- Year code (chars 2–3): `CurrentRegYearMultiplier[yearCode]`
- Age identifier match bonus: `AGE_IDENTIFIER_MATCH` (+1000) or `AGE_IDENTIFIER_NO_MATCH` (-100)
- Memory tag (first 2 chars): `CurrentRegMemoryTag` enum lookup
- Memory tag + age identifier: `CurrentRegMemoryTagAndAgeIdentifier` enum lookup
- Valid two-letter combo (first 2 chars): `VALID_TWO_LETTER_COMBINATIONS` lookup (+2000)
- Special full-plate combination: `SPECIAL_COMBINATIONS` lookup
- Surname detection (decoded plate): `POPULAR_SURNAMES` lookup
- Name detection (decoded plate): `POPULAR_NAMES` lookup
- First char X: `FIRST_CHAR_X_BONUS` (+500) or `FIRST_CHAR_NOT_X_PENALTY` (-250)
- *Dictionary word detection skipped* (requires external word list; minor contribution)
- `minPrice = totalPrice * 0.25`, `maxPrice = totalPrice * 1.25`, `midPrice = totalPrice`

### Prefix (`F123ABC`)
Port from `prefix-plate-valuation.component.ts`. Imports from `prefix-formula.ts`:
- Base: `PrefixReg.start` (1500)
- Year letter (first char): `PREFIX_YEAR_LETTER_BONUS[yearLetter]`
- `midPrice = totalPrice`, `minPrice = totalPrice * 0.25`, `maxPrice = totalPrice * 1.25`

### Suffix (`ABC123F`)
Port from `suffix-plate-valuation.component.ts`. Imports from `suffix-formula.ts`:
- Base: `SuffixReg.start` (2500)
- Year letter (last char): `SUFFIX_YEAR_LETTER_BONUS[yearLetter]`
- `midPrice = totalPrice`, `minPrice = totalPrice * 0.25`, `maxPrice = totalPrice * 1.25`

### Dateless (`1 GUV`, `ABC 123`)
Port from `reg-plate-valuation-results.component.ts`. Imports from `dateless-formula.ts`:
- Strip spaces, detect letter-first or number-first
- Base: `DatelessReg.letterFirst` (1000) or `DatelessReg.numberFirst` (250)
- Length points: `DatelessRegLength[length]`
- Character points: sum of `LetterValues` + `DigitValues` for each character
- Spacing points: `Spaces[spaceCount]`
- Penalties: `IsAnyLetterUsedAsNumber`, `IsAnyNumberUsedAsLetter`, `IsPlateSpacingGoodForMot`
- Multiplier: `DatelessRegMultiplier[length]`
- `midPrice = totalPoints * multiplier`
- `minPrice = midPrice - (midPrice * MinMaxTotals.min)` (−50%)
- `maxPrice = midPrice + (midPrice * MinMaxTotals.max)` (+30%)

---

## File Structure

**Copy (no changes) from `src/app/` into `functions/src/`:**
- `functions/src/formulas/current-formula.ts`
- `functions/src/formulas/prefix-formula.ts`
- `functions/src/formulas/suffix-formula.ts`
- `functions/src/formulas/dateless-formula.ts`
- `functions/src/regex-plate-patterns/current.ts`
- `functions/src/regex-plate-patterns/prefix.ts`
- `functions/src/regex-plate-patterns/suffix.ts`
- `functions/src/regex-plate-patterns/dateless.ts`

**Create:**
- `functions/src/valuation.ts` — `detectPlateType()` + `valuatePlate()` returning `{ plate, type, midPrice, minPrice, maxPrice }`

**Modify:**
- `functions/src/index.ts` — add `valuePlate` export, add `valuationApiKey` secret

---

## API Key Setup

Before deploying, set the secret:
```bash
firebase functions:secrets:set VALUATION_API_KEY
# enter any strong random string e.g. from: openssl rand -hex 32
```

The function checks `request.query['key'] === valuationApiKey.value()` on every request before processing.
