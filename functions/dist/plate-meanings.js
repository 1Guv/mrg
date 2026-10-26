"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.describePlate = describePlate;
exports.fillPlateMeanings = fillPlateMeanings;
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
/**
 * Short AI-written descriptions of what each plate for sale spells, shown on
 * its /plates-for-sale/<PLATE>/ page. Listings carry only a terse `meanings`
 * field ("KHALAD, KHALID, KHALED"), which leaves those pages too thin for
 * Google to index.
 *
 * Stored in plate_meanings/<PLATE> with the `meanings` text it was written
 * from, so a seller editing their meanings gets a fresh description on the
 * next run. Listings without meanings are skipped: there is nothing to go on.
 */
const COLLECTION = "plate_meanings";
const LISTING_COLLECTIONS = ["plate-listings-new", "plate-listings"];
const CONCURRENCY = 5;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/" +
    "gemini-2.5-flash:generateContent";
/**
 * @param {string} plate - Plate characters as stored.
 * @return {string} The plate without spaces, upper case.
 */
function normalisePlate(plate) {
    return plate.replace(/\s/g, "").toUpperCase();
}
/**
 * Ask Gemini to describe what a plate spells. Retries once when the
 * response is not the JSON asked for.
 * @param {string} apiKey - Gemini API key.
 * @param {PendingPlate} p - The plate and its seller-given meanings.
 * @return {Promise<string>} The description.
 */
async function describePlate(apiKey, p) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    /* eslint-disable max-len */
    const prompt = `You write short descriptions for a UK private number plate marketplace.

Plate: ${p.display}
What the seller says it reads as: ${p.meanings}

Write 2 or 3 sentences (40–70 words, British English) for buyers explaining what this plate spells or reads as, and why someone might want it.
- Base it only on the readings given. Plates use numbers as letters (1 = I, 4 = A, 5 = S, 8 = B, 0 = O), so you may say how the characters make the word.
- Give a name's or word's meaning only when it is well established and you are certain of it for that exact spelling. Similar-sounding names often mean different things (Saeed is "happy", Shahid/Saheed is "witness"), so when in any doubt say only that it is a given name, or describe how it reads.
- Vary the wording: do not open with "This distinctive plate" and never use the word "cleverly".
- Never label a name by religion, ethnicity or nationality (write "the given name Alok", not "the Hindu name Alok"), and never say who the plate suits by faith, heritage or national pride.
- If a reading is itself a religious or national word (SIKH, KHALSA, HALAL, PAKISTAN), say what the word means in neutral terms and nothing about the buyer.
- Do not mention celebrities, sport, prices, value or investment.
- Plain text only: no emojis, markdown, quotes or headings.

Respond ONLY with JSON: {"description": "..."}`;
    /* eslint-enable max-len */
    for (let attempt = 1; attempt <= 2; attempt++) {
        const response = await axios_1.default.post(GEMINI_URL, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" },
        }, { headers: { "x-goog-api-key": apiKey }, timeout: 60000 });
        const text = (_g = (_f = (_e = (_d = (_c = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) !== null && _g !== void 0 ? _g : "";
        try {
            const description = String((_h = JSON.parse(text).description) !== null && _h !== void 0 ? _h : "").trim();
            if (description)
                return description;
        }
        catch (_j) {
            // Malformed JSON — fall through and retry.
        }
        console.warn(`plate-meanings: unusable response for ${p.plate} ` +
            `(attempt ${attempt}): ${text.slice(0, 120)}`);
    }
    throw new Error(`plate-meanings: no usable description for ${p.plate}`);
}
/**
 * Write descriptions for unsold plates that have none, or whose meanings
 * changed since theirs was written. Capped per run so a backlog spreads
 * over several runs.
 * @param {string} apiKey - Gemini API key.
 * @param {number} max - Most descriptions to write this run.
 * @return {Promise<{written: number, failed: number, remaining: number}>}
 */
async function fillPlateMeanings(apiKey, max) {
    const db = admin.firestore();
    const [existing, ...listingSnaps] = await Promise.all([
        db.collection(COLLECTION).get(),
        ...LISTING_COLLECTIONS.map((c) => db.collection(c).where("isSold", "==", false).get()),
    ]);
    const describedFrom = new Map(existing.docs.map((d) => { var _a; return [d.id, String((_a = d.data().meanings) !== null && _a !== void 0 ? _a : "")]; }));
    // New listings first, matching the order the site resolves duplicates in.
    const pending = new Map();
    for (const snap of listingSnaps) {
        for (const doc of snap.docs) {
            const { plateCharacters, meanings } = doc.data();
            if (!plateCharacters || !String(meanings !== null && meanings !== void 0 ? meanings : "").trim())
                continue;
            const plate = normalisePlate(String(plateCharacters));
            if (pending.has(plate) || describedFrom.has(plate) &&
                describedFrom.get(plate) === String(meanings).trim())
                continue;
            pending.set(plate, {
                plate,
                display: String(plateCharacters).toUpperCase(),
                meanings: String(meanings).trim(),
            });
        }
    }
    const batch = [...pending.values()].slice(0, max);
    let written = 0;
    let failed = 0;
    let next = 0;
    const worker = async () => {
        while (next < batch.length) {
            const p = batch[next++];
            try {
                const description = await describePlate(apiKey, p);
                await db.collection(COLLECTION).doc(p.plate).set({
                    plate: p.plate,
                    meanings: p.meanings,
                    description,
                    model: "gemini-2.5-flash",
                    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                written++;
            }
            catch (err) {
                failed++;
                console.error(`plate-meanings: ${p.plate} failed:`, err);
            }
        }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    const remaining = pending.size - written;
    console.log(`plate-meanings: wrote ${written}, failed ${failed}, ` +
        `${remaining} still to describe`);
    return { written, failed, remaining };
}
//# sourceMappingURL=plate-meanings.js.map