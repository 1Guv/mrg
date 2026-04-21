# Plate Valuation API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `valuePlate` Firebase Cloud Function HTTP endpoint that detects plate type, runs the valuation formula, and returns `{ plate, type, midPrice, minPrice, maxPrice }` protected by an API key secret.

**Architecture:** Copy formula and regex source files into `functions/src/`, create a self-contained `functions/src/valuation.ts` module, then export `valuePlate` from `functions/src/index.ts` using the existing `onRequest` + `defineSecret` pattern.

**Tech Stack:** Firebase Functions v2 `onRequest`, TypeScript (NodeNext modules), existing formula enums/constants, Firebase Secret Manager.

---

## File Structure

**Create:**
- `functions/src/formulas/current-formula.ts` — copy of `src/app/formulas/current-formula.ts`
- `functions/src/formulas/prefix-formula.ts` — copy of `src/app/formulas/prefix-formula.ts`
- `functions/src/formulas/suffix-formula.ts` — copy of `src/app/formulas/suffix-formula.ts`
- `functions/src/formulas/dateless-formula.ts` — copy of `src/app/formulas/dateless-formula.ts`
- `functions/src/regex-plate-patterns/current.ts` — copy of `src/app/regex-plate-patterns/current.ts`
- `functions/src/regex-plate-patterns/prefix.ts` — copy of `src/app/regex-plate-patterns/prefix.ts`
- `functions/src/regex-plate-patterns/suffix.ts` — copy of `src/app/regex-plate-patterns/suffix.ts`
- `functions/src/regex-plate-patterns/dateless.ts` — copy of `src/app/regex-plate-patterns/dateless.ts`
- `functions/src/valuation.ts` — `detectPlateType()` + `valuatePlate()` pure logic

**Modify:**
- `functions/src/index.ts` — add `valuationApiKey` secret and `valuePlate` export

---

## Task 1: Copy Formula Files into functions/src/

**Files:**
- Create: `functions/src/formulas/current-formula.ts`
- Create: `functions/src/formulas/prefix-formula.ts`
- Create: `functions/src/formulas/suffix-formula.ts`
- Create: `functions/src/formulas/dateless-formula.ts`
- Create: `functions/src/regex-plate-patterns/current.ts`
- Create: `functions/src/regex-plate-patterns/prefix.ts`
- Create: `functions/src/regex-plate-patterns/suffix.ts`
- Create: `functions/src/regex-plate-patterns/dateless.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p functions/src/formulas functions/src/regex-plate-patterns
```

- [ ] **Step 2: Copy formula files**

```bash
cp src/app/formulas/current-formula.ts functions/src/formulas/current-formula.ts
cp src/app/formulas/prefix-formula.ts functions/src/formulas/prefix-formula.ts
cp src/app/formulas/suffix-formula.ts functions/src/formulas/suffix-formula.ts
cp src/app/formulas/dateless-formula.ts functions/src/formulas/dateless-formula.ts
```

- [ ] **Step 3: Copy regex pattern files**

```bash
cp src/app/regex-plate-patterns/current.ts functions/src/regex-plate-patterns/current.ts
cp src/app/regex-plate-patterns/prefix.ts functions/src/regex-plate-patterns/prefix.ts
cp src/app/regex-plate-patterns/suffix.ts functions/src/regex-plate-patterns/suffix.ts
cp src/app/regex-plate-patterns/dateless.ts functions/src/regex-plate-patterns/dateless.ts
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd functions && npm run build 2>&1 | head -30
```

Expected: no errors. The formula files are pure TypeScript with no Angular imports — they should compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add functions/src/formulas/ functions/src/regex-plate-patterns/
git commit -m "feat: copy formula and regex files into functions/src for valuation API"
```

---

## Task 2: Create functions/src/valuation.ts

**Files:**
- Create: `functions/src/valuation.ts`

This module contains `detectPlateType()` and `valuatePlate()`. No Angular dependencies — pure TypeScript.

- [ ] **Step 1: Create `functions/src/valuation.ts`**

```typescript
import { currentPattern } from "./regex-plate-patterns/current.js";
import { prefixPattern } from "./regex-plate-patterns/prefix.js";
import { suffixPattern } from "./regex-plate-patterns/suffix.js";
import { datelessPattern } from "./regex-plate-patterns/dateless.js";

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
  if (datelessPattern.test(raw.trim())) return "dateless"; // dateless allows internal spaces
  return null;
}

// ─── Current ──────────────────────────────────────────────────────────────────

function valuateCurrent(plate: string): ValuationResult {
  const norm = plate.replace(/\s/g, "").toUpperCase();

  let total = CurrentReg.start;

  // Year code bonus (chars at index 2–3)
  const yearCode = norm[2] + norm[3];
  total += CurrentRegYearMultiplier[yearCode] ?? 0;

  // Age identifier match bonus (chars 2 & 3 decoded via PLATE_ALPHABET)
  for (const i of [2, 3]) {
    const digit = norm[i];
    const matches = PLATE_ALPHABET[digit] ?? [];
    // In the API we assume the digit IS the character (no user selection).
    // Check if the digit itself maps to a letter — count as a match only if
    // PLATE_ALPHABET has an entry for it (i.e. it's a number that looks like a letter).
    total += matches.length > 0 ? AGE_IDENTIFIER_MATCH : AGE_IDENTIFIER_NO_MATCH;
  }

  // Memory tag bonus — first 2 chars
  const memTag2 = (norm[0] + norm[1]) as keyof typeof CurrentRegMemoryTag;
  total += CurrentRegMemoryTag[memTag2] ?? 0;

  // Memory tag + age identifier (first 4 chars)
  const memTag4Key = (norm[0] + norm[1] + norm[2] + norm[3]) as keyof typeof CurrentRegMemoryTagAndAgeIdentifier;
  total += CurrentRegMemoryTagAndAgeIdentifier[memTag4Key] ?? 0;

  // Valid two-letter combo bonus — first 2 chars
  const twoLetterCombo = norm[0] + norm[1];
  total += VALID_TWO_LETTER_COMBINATIONS[twoLetterCombo] ?? 0;

  // Special full-plate combination — decoded plate (all 7 chars as-is)
  const fullPlate = norm;
  if (SPECIAL_COMBINATIONS[fullPlate]) {
    total += SPECIAL_COMBINATIONS[fullPlate];
  }

  // Surname detection — check substrings: all 7, last 5, last 4, last 3
  const surnameCandidates = [
    fullPlate,
    fullPlate.slice(2),
    fullPlate.slice(3),
    fullPlate.slice(4),
  ];
  for (const candidate of surnameCandidates) {
    if (POPULAR_SURNAMES[candidate]) {
      total += POPULAR_SURNAMES[candidate];
      break;
    }
  }

  // Name detection — first 4 chars and last 3 chars
  const nameCandidates = [fullPlate.slice(0, 4), fullPlate.slice(4)];
  for (const candidate of nameCandidates) {
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

function valuatePrefix(plate: string): ValuationResult {
  const norm = plate.replace(/\s/g, "").toUpperCase();
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

function valuateSuffix(plate: string): ValuationResult {
  const norm = plate.replace(/\s/g, "").toUpperCase();
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

function valuateDateless(plate: string): ValuationResult {
  const norm = plate.replace(/\s/g, "").toUpperCase();

  // Base: letter-first or number-first
  const isFirstCharNumber = "0123456789".includes(norm[0]);
  let points = DatelessReg.start;
  points += isFirstCharNumber ? DatelessReg.numberFirst : DatelessReg.letterFirst;

  // Length points
  const lenKey = `_${norm.length}` as keyof typeof DatelessRegLength;
  points += DatelessRegLength[lenKey] ?? 0;

  // Character points
  for (const char of norm) {
    const isNumber = "0123456789".includes(char);
    if (isNumber) {
      points += DigitValues[`_${char}` as keyof typeof DigitValues] ?? 0;
    } else {
      points += LetterValues[char as keyof typeof LetterValues] ?? 0;
    }
  }

  // How-many-numbers and how-many-letters multiplier points
  let numCount = 0;
  let letCount = 0;
  for (const char of norm) {
    if ("0123456789".includes(char)) numCount++;
    else letCount++;
  }
  const numKey = `_${numCount}` as keyof typeof DatelessHowManyNumbersMultiplier;
  const letKey = `_${letCount}` as keyof typeof DatelessHowManyLettersMultiplier;
  points += DatelessHowManyNumbersMultiplier[numKey] ?? 0;
  points += DatelessHowManyLettersMultiplier[letKey] ?? 0;

  // Spacing: API receives the raw plate — count spaces in original input
  // We don't apply interactive penalty/bonus here; default to 0 spaces = 1000
  // (The API valuates the plate as presented with its natural spacing.)
  points += 1000; // Spaces._0

  // Multiplier
  const multKey = `_${norm.length}` as keyof typeof DatelessRegMultiplier;
  const multiplier = DatelessRegMultiplier[multKey] ?? 1;

  const midPrice = Math.max(0, points * multiplier);
  const minPrice = midPrice - midPrice * MinMaxTotals.min;
  const maxPrice = midPrice + midPrice * MinMaxTotals.max;

  return {
    plate: norm,
    type: "dateless",
    midPrice,
    minPrice,
    maxPrice,
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
    case "dateless": return valuateDateless(raw); // preserve original spacing for dateless
  }
}
```

- [ ] **Step 2: Build to verify no TypeScript errors**

```bash
cd functions && npm run build 2>&1 | head -40
```

Expected: exits with code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add functions/src/valuation.ts
git commit -m "feat: add valuation.ts with detectPlateType and valuatePlate"
```

---

## Task 3: Add valuePlate endpoint to functions/src/index.ts

**Files:**
- Modify: `functions/src/index.ts`

- [ ] **Step 1: Add the `valuationApiKey` secret and `valuePlate` export**

Open `functions/src/index.ts`. After the existing secret definitions (lines 13–14), add:

```typescript
const valuationApiKey = defineSecret("VALUATION_API_KEY");
```

Then at the end of the file (after the `stripeWebhook` export), add:

```typescript
import { valuatePlate } from "./valuation.js";

export const valuePlate = onRequest(
  { maxInstances: 10, secrets: [valuationApiKey] },
  (request, response) => {
    // CORS headers so external callers (curl, Postman, scripts) work
    response.set("Access-Control-Allow-Origin", "*");

    const key = request.query["key"] as string | undefined;
    if (!key || key !== valuationApiKey.value()) {
      response.status(401).json({ error: "Missing or invalid API key" });
      return;
    }

    const rawPlate = request.query["plate"] as string | undefined;
    if (!rawPlate) {
      response.status(400).json({ error: "Missing plate parameter" });
      return;
    }

    const result = valuatePlate(rawPlate.trim());
    if (!result) {
      response.status(400).json({ error: "Plate format not recognised" });
      return;
    }

    response.status(200).json(result);
  }
);
```

> **Note:** The `import` must go at the top of the file with the other imports. Move it there if your editor places it at the bottom.

- [ ] **Step 2: Move the import to the top of `functions/src/index.ts`**

The file already has `import` statements at lines 1–6. Add the valuation import there:

```typescript
import { valuatePlate } from "./valuation.js";
```

(Remove the inline import added in Step 1.)

- [ ] **Step 3: Build to verify**

```bash
cd functions && npm run build 2>&1 | head -40
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/index.ts
git commit -m "feat: add valuePlate Cloud Function endpoint with API key protection"
```

---

## Task 4: Set secret, deploy, and smoke test

**Files:** none (deployment + config)

- [ ] **Step 1: Set the VALUATION_API_KEY secret**

```bash
firebase functions:secrets:set VALUATION_API_KEY
# When prompted, enter a strong random value, e.g.:
# openssl rand -hex 32
```

- [ ] **Step 2: Deploy only the new function**

```bash
firebase deploy --only functions:valuePlate
```

Expected output ends with:
```
✔  functions[valuePlate(us-central1)] Successful deploy
Function URL (valuePlate): https://valueplate-<hash>-uc.a.run.app
```

Copy the URL.

- [ ] **Step 3: Smoke test — missing key (expect 401)**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=AB12CDE"
```

Expected:
```json
{"error":"Missing or invalid API key"}
```

- [ ] **Step 4: Smoke test — invalid key (expect 401)**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=AB12CDE&key=wrong"
```

Expected:
```json
{"error":"Missing or invalid API key"}
```

- [ ] **Step 5: Smoke test — missing plate (expect 400)**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?key=YOUR_KEY"
```

Expected:
```json
{"error":"Missing plate parameter"}
```

- [ ] **Step 6: Smoke test — unrecognised plate (expect 400)**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=ZZZZZZZZZ&key=YOUR_KEY"
```

Expected:
```json
{"error":"Plate format not recognised"}
```

- [ ] **Step 7: Smoke test — current plate (expect 200)**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=AB12CDE&key=YOUR_KEY"
```

Expected (values will differ):
```json
{"plate":"AB12CDE","type":"current","midPrice":2460,"minPrice":615,"maxPrice":3075}
```

- [ ] **Step 8: Smoke test — prefix plate**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=A1ABC&key=YOUR_KEY"
```

Expected:
```json
{"plate":"A1ABC","type":"prefix","midPrice":13500,"minPrice":3375,"maxPrice":16875}
```

- [ ] **Step 9: Smoke test — suffix plate**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=ABC1A&key=YOUR_KEY"
```

Expected:
```json
{"plate":"ABC1A","type":"suffix","midPrice":14500,"minPrice":3625,"maxPrice":18125}
```

- [ ] **Step 10: Smoke test — dateless plate**

```bash
curl -s "https://valueplate-<hash>-uc.a.run.app?plate=16UV&key=YOUR_KEY"
```

Expected: `type` is `"dateless"`, prices are positive numbers.

- [ ] **Step 11: Commit final state**

```bash
git add -A
git commit -m "chore: confirm valuePlate deployed and smoke tests passing"
```
