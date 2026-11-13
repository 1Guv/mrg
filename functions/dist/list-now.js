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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUYER_DEMAND_THRESHOLD = void 0;
exports.searchMatchesPlate = searchMatchesPlate;
exports.runGetBuyerDemand = runGetBuyerDemand;
exports.queueUpdateForIntent = queueUpdateForIntent;
exports.findSellIntent = findSellIntent;
exports.runRecordSellIntent = runRecordSellIntent;
exports.runRecordPlateMeaning = runRecordPlateMeaning;
exports.runGetResultVoucher = runGetResultVoucher;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const valuation_email_js_1 = require("./valuation-email.js");
const vouchers_js_1 = require("./vouchers.js");
const users_js_1 = require("./users.js");
const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REG_RE = /^[A-Z0-9 ]{2,8}$/;
/** Buyer demand is only shown at or above this many matching searches. */
exports.BUYER_DEMAND_THRESHOLD = 5;
const BUYER_DEMAND_WINDOW_MS = 30 * DAY;
const SELL_INTENTS = ["yes", "later", "curious"];
/** Why a visitor chose "Not now" instead of publishing. */
const NOT_NOW_REASONS = ["price", "not_ready", "curious", "fee", "other"];
/** "Maybe later" moves that plate's nudges to weekly. */
const LATER_CADENCE_DAYS = 7;
/**
 * @param {unknown} raw - The registration from the request.
 * @return {string} The plate with no spaces, upper case.
 */
function parseRegistration(raw) {
    const reg = String(raw !== null && raw !== void 0 ? raw : "").trim().toUpperCase();
    if (!REG_RE.test(reg) || reg.replace(/\s/g, "").length < 2) {
        throw new https_1.HttpsError("invalid-argument", "Invalid registration");
    }
    return reg.replace(/\s/g, "");
}
/**
 * The caller's email: the signed-in account's, otherwise the one they gave
 * at the email gate this session.
 * @param {Record<string, unknown>} data - Request data, may hold email.
 * @param {Caller} caller - The signed-in user, if any.
 * @return {string | null} The normalised email, or null.
 */
function callerEmail(data, caller) {
    var _a, _b;
    const email = String((_b = (_a = caller.email) !== null && _a !== void 0 ? _a : data["email"]) !== null && _b !== void 0 ? _b : "")
        .trim().toLowerCase();
    return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}
/**
 * @param {string} ip - The caller's IP address.
 * @param {string} kind - Which callable is being limited.
 * @param {number} max - Calls per hour.
 * @return {Promise<void>}
 */
function limitByIp(ip, kind, max) {
    return (0, valuation_email_js_1.consumeRateLimits)([{ id: (0, valuation_email_js_1.rateLimitId)(kind, ip || "unknown"), max }]);
}
// ── Buyer demand ─────────────────────────────────────────────────────────────
/**
 * Whether a Plates for Sale search is for a plate like this one: the search
 * is part of the plate ("yo" for YO1), or the plate is part of the search
 * ("yo1car"). Both are compared lower case with spaces removed, and the part
 * that has to be contained must be at least 2 characters.
 * @param {string} term - The stored search term.
 * @param {string} registration - The plate.
 * @return {boolean} True when the search matches.
 */
function searchMatchesPlate(term, registration) {
    const t = term.toLowerCase().replace(/\s/g, "");
    const plate = registration.toLowerCase().replace(/\s/g, "");
    if (!t || !plate)
        return false;
    return (t.length >= 2 && plate.includes(t)) ||
        (plate.length >= 2 && t.includes(plate));
}
/**
 * Counts Plates for Sale searches from the last 30 days that match a plate.
 * Below the threshold the count is reported as 0, so low numbers are never
 * shown. The caller's own searches are left out where we know who they are.
 * @param {Record<string, unknown>} data - registration.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @return {Promise<{count: number}>} The number of matching searches.
 */
async function runGetBuyerDemand(data, caller, ip) {
    const registration = parseRegistration(data["registration"]);
    await limitByIp(ip, "buyer-demand-ip", 30);
    // Volumes are small, so scan the window and match in memory. Move to
    // stored counters if buyer_searches grows past a few thousand a month.
    const since = admin.firestore.Timestamp.fromMillis(Date.now() - BUYER_DEMAND_WINDOW_MS);
    const snap = await admin.firestore().collection("buyer_searches")
        .where("searchedAt", ">=", since)
        .get();
    const count = snap.docs.filter((d) => {
        var _a;
        const s = d.data();
        if (caller.uid && s["userId"] === caller.uid)
            return false;
        return searchMatchesPlate(String((_a = s["term"]) !== null && _a !== void 0 ? _a : ""), registration);
    }).length;
    return { count: count >= exports.BUYER_DEMAND_THRESHOLD ? count : 0 };
}
// ── "Would you sell?" ────────────────────────────────────────────────────────
/**
 * The nudge-queue changes for an answer, or null for none.
 * @param {SellIntent} answer - The visitor's answer.
 * @return {Record<string, unknown> | null} Fields to set on the entry.
 */
function queueUpdateForIntent(answer) {
    if (answer === "later") {
        return {
            cadenceDays: LATER_CADENCE_DAYS,
            nextSendAt: admin.firestore.Timestamp.fromMillis(Date.now() + LATER_CADENCE_DAYS * DAY),
        };
    }
    if (answer === "curious") {
        // One plate only. The unsubscribe link still covers every plate.
        return {
            unsubscribed: true,
            unsubscribedAt: admin.firestore.Timestamp.now(),
            stopReason: "just_curious",
        };
    }
    return null;
}
/**
 * The answer recorded for an email and plate, if any.
 * @param {string} email - Normalised email.
 * @param {string} registration - Plate, no spaces, upper case.
 * @return {Promise<SellIntent | null>} The answer, or null.
 */
async function findSellIntent(email, registration) {
    var _a;
    const snap = await admin.firestore().collection("sell_intents")
        .doc(sellIntentId(email, registration)).get();
    const answer = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a["answer"];
    return SELL_INTENTS.includes(answer) ? answer : null;
}
/**
 * @param {string} email - Normalised email.
 * @param {string} registration - Plate, no spaces, upper case.
 * @return {string} The sell_intents document id.
 */
function sellIntentId(email, registration) {
    return `${email}_${registration}`;
}
/**
 * Records "Would you sell at this price?" and applies it to the plate's nudge
 * emails. If the queue entry isn't made yet, runOnAutoValuationCreated
 * applies the answer when it makes it.
 * @param {Record<string, unknown>} data - registration, answer, email
 *   when the caller isn't signed in, and for "Not now" a reason and an
 *   optional reasonText.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @return {Promise<{recorded: boolean}>} Whether there was an email to
 *   record the answer against.
 */
async function runRecordSellIntent(data, caller, ip) {
    var _a, _b, _c;
    const registration = parseRegistration(data["registration"]);
    const answer = data["answer"];
    if (!SELL_INTENTS.includes(answer)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid answer");
    }
    const reason = String((_a = data["reason"]) !== null && _a !== void 0 ? _a : "");
    if (reason && !NOT_NOW_REASONS.includes(reason)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid reason");
    }
    const reasonText = String((_b = data["reasonText"]) !== null && _b !== void 0 ? _b : "").trim().slice(0, 300);
    await limitByIp(ip, "sell-intent-ip", 20);
    const email = callerEmail(data, caller);
    if (!email)
        return { recorded: false };
    const db = admin.firestore();
    await db.collection("sell_intents").doc(sellIntentId(email, registration))
        .set(Object.assign(Object.assign(Object.assign({ email, uid: (_c = caller.uid) !== null && _c !== void 0 ? _c : null, registration,
        answer }, (reason ? { reason } : {})), (reasonText ? { reasonText } : {})), { answeredAt: admin.firestore.Timestamp.now() }));
    const update = queueUpdateForIntent(answer);
    if (update) {
        const entries = await db.collection("listing_nudge_queue")
            .where("email", "==", email)
            .where("registration", "==", registration)
            .get();
        await Promise.all(entries.docs.map((d) => d.ref.update(update)));
    }
    console.log(`sell-intent: ${registration} ${answer}${reason ? ` (${reason})` : ""} ` +
        `for ${(0, users_js_1.maskEmail)(email)}`);
    return { recorded: true };
}
const MEANING_CATEGORIES = ["name", "word", "car", "business", "date", "other"];
const MEANING_MAX_LENGTH = 80;
/**
 * Records what a plate means to its owner, asked under a revealed valuation.
 * Last answer wins. Kept apart from plate_meanings, which is public and
 * feeds the plate pages. The text also pre-fills their listing on the client.
 * @param {Record<string, unknown>} data - registration, category, optional
 *   text, and email when the caller isn't signed in.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @return {Promise<{recorded: boolean}>} Whether there was an email to
 *   record it against.
 */
async function runRecordPlateMeaning(data, caller, ip) {
    var _a, _b;
    const registration = parseRegistration(data["registration"]);
    const category = data["category"];
    if (!MEANING_CATEGORIES.includes(category)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid category");
    }
    const text = String((_a = data["text"]) !== null && _a !== void 0 ? _a : "").trim().slice(0, MEANING_MAX_LENGTH);
    await limitByIp(ip, "plate-meaning-ip", 20);
    const email = callerEmail(data, caller);
    if (!email)
        return { recorded: false };
    await admin.firestore().collection("owner_plate_meanings")
        .doc(sellIntentId(email, registration))
        .set({
        email,
        uid: (_b = caller.uid) !== null && _b !== void 0 ? _b : null,
        registration,
        category,
        text,
        answeredAt: admin.firestore.Timestamp.now(),
    });
    return { recorded: true };
}
// ── Result-page voucher ──────────────────────────────────────────────────────
/**
 * The 10%-off voucher shown on a revealed valuation: one per email and plate,
 * valid for 48 hours. Returns the live one if it exists, otherwise mints it.
 * @param {Record<string, unknown>} data - registration, and email when the
 *   caller isn't signed in.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @param {Stripe} stripe - Stripe client.
 * @return {Promise<object | null>} code, percentOff and expiresAt (ms), or
 *   null when there is no email to tie it to.
 */
async function runGetResultVoucher(data, caller, ip, stripe) {
    const registration = parseRegistration(data["registration"]);
    const email = callerEmail(data, caller);
    if (!email)
        return null;
    const db = admin.firestore();
    const existing = await (0, vouchers_js_1.findResultVoucher)(db, email, registration);
    const voucher = existing !== null && existing !== void 0 ? existing : await (async () => {
        // Only minting counts against the limit; returning a live code is free.
        await limitByIp(ip, "result-voucher-ip", 10);
        return (0, vouchers_js_1.mintPlateVoucher)(stripe, db, {
            registration,
            email,
            audience: "result",
            expiryMs: vouchers_js_1.RESULT_VOUCHER_EXPIRY_MS,
        });
    })();
    return {
        code: voucher.code,
        percentOff: voucher.percentOff,
        expiresAt: voucher.expiresAt.toMillis(),
    };
}
//# sourceMappingURL=list-now.js.map