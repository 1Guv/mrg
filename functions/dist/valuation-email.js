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
exports.runCaptureValuationEmail = runCaptureValuationEmail;
exports.runSendSignInLink = runSendSignInLink;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const https_1 = require("firebase-functions/v2/https");
const constants_js_1 = require("./constants.js");
const enquiries_js_1 = require("./enquiries.js");
const nudge_emails_js_1 = require("./nudge-emails.js");
const users_js_1 = require("./users.js");
/**
 * The email gate on a valuation result. A visitor gives a first name and an
 * email; we find or create their account, add them to the customer list,
 * save the valuation and email it to them with a "List it" sign-in link.
 */
const HOUR = 60 * 60 * 1000;
const EMAIL_LIMIT_PER_HOUR = 5;
const IP_LIMIT_PER_HOUR = 20;
const PLATE_TYPES = ["current", "prefix", "suffix", "dateless"];
const INTENTS = ["email", "list"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Bases the client may ask continueUrl to use; anything else gets APP_URL.
const ALLOWED_APP_BASE_URLS = [
    "https://mrvaluations.co.uk",
    "http://localhost:1234",
    "http://localhost:4200",
    "http://localhost:4321",
];
// RegValuation fields copied to the dashboard's valuations document.
const VALUATION_NUMBER_FIELDS = [
    "plateTypePoints",
    "howManyNumbersPoints",
    "howManyLettersPoints",
    "plateLengthPoints",
    "plateFirstCharacterPoints",
    "plateCharacterPoints",
    "spacesSelected",
    "spacesPoints",
    "isAnyLetterUsedAsNumberPoints",
    "isAnyNumberUsedAsLetterPoints",
    "isDateOfPurchaseKnownPoints",
    "isPlateSpacingGoodForMotPoints",
    "dateOfPurchaseKnownPoints",
    "yearsOld",
    "dateOfPurchaseMultiplierPoints",
    "multiplier",
    "totalPoints",
    "totalPointsWithMultiplier",
    "popularityMultiplier",
    "totalPointsWithPopularityMultiplier",
    "minMultiplier",
    "maxMultiplier",
];
const VALUATION_BOOLEAN_FIELDS = [
    "frontBack",
    "isPlateSpacingGoodForMot",
    "isAnyLetterUsedAsNumber",
    "isAnyNumberUsedAsLetter",
    "isDateOfPurchaseKnown",
    "isDateOfPurchaseKnownToggle",
];
const VALUATION_STRING_FIELDS = [
    "firstName",
    "lastName",
    "city",
    "plateMeaning",
];
/**
 * @param {unknown} value - A field from the request.
 * @param {string} name - The field's name, for the error.
 * @return {number} The value, if it is a finite, non-negative number.
 */
function money(value, name) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
        throw new https_1.HttpsError("invalid-argument", `Invalid ${name}`);
    }
    return value;
}
/**
 * Checks and normalises the callable's request data.
 * @param {Record<string, unknown>} data - The request data.
 * @return {CaptureInput} The cleaned-up input.
 */
function parseInput(data) {
    var _a, _b, _c, _d, _e, _f;
    const firstName = String((_a = data.firstName) !== null && _a !== void 0 ? _a : "").trim();
    if (firstName.length < 1 || firstName.length > 50) {
        throw new https_1.HttpsError("invalid-argument", "Invalid first name");
    }
    const email = String((_b = data.email) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    if (email.length > 254 || !EMAIL_RE.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid email");
    }
    const registration = String((_c = data.registration) !== null && _c !== void 0 ? _c : "").replace(/\s/g, "").toUpperCase();
    if (!/^[A-Z0-9]{1,8}$/.test(registration)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid registration");
    }
    const type = String((_d = data.type) !== null && _d !== void 0 ? _d : "");
    if (!PLATE_TYPES.includes(type)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid type");
    }
    const intent = String((_e = data.intent) !== null && _e !== void 0 ? _e : "");
    if (!INTENTS.includes(intent)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid intent");
    }
    const valuation = data.valuation && typeof data.valuation === "object" &&
        !Array.isArray(data.valuation) ?
        data.valuation : {};
    const appBaseUrl = String((_f = data.appBaseUrl) !== null && _f !== void 0 ? _f : "").replace(/\/+$/, "");
    return {
        firstName,
        email,
        marketingConsent: data.marketingConsent === true,
        intent,
        registration,
        type,
        price: money(data.price, "price"),
        minPrice: money(data.minPrice, "min price"),
        maxPrice: money(data.maxPrice, "max price"),
        valuation,
        appBaseUrl: ALLOWED_APP_BASE_URLS.includes(appBaseUrl) ?
            appBaseUrl : nudge_emails_js_1.APP_URL,
    };
}
/**
 * @param {string} kind - What is being limited, e.g. "email".
 * @param {string} value - The email or IP.
 * @return {string} A rate_limits document id that doesn't reveal the value.
 */
function rateLimitId(kind, value) {
    const hash = crypto.createHash("sha256").update(value).digest("hex");
    return `valuation-email_${kind}_${hash.slice(0, 40)}`;
}
/**
 * Counts one call against each limit, in a fixed one-hour window.
 * Throws resource-exhausted, without counting, if any limit is used up.
 * @param {Array<{id: string, max: number}>} limits - The rate_limits
 *   document ids and their hourly caps.
 * @return {Promise<void>}
 */
async function consumeRateLimits(limits) {
    const db = admin.firestore();
    const refs = limits.map((l) => db.collection("rate_limits").doc(l.id));
    await db.runTransaction(async (tx) => {
        const snaps = await tx.getAll(...refs);
        const now = Date.now();
        const next = snaps.map((snap, i) => {
            var _a, _b, _c;
            const d = snap.data();
            const start = (_b = (_a = d === null || d === void 0 ? void 0 : d.windowStart) === null || _a === void 0 ? void 0 : _a.toMillis()) !== null && _b !== void 0 ? _b : 0;
            const fresh = now - start >= HOUR;
            const count = fresh ? 0 : Number((_c = d === null || d === void 0 ? void 0 : d.count) !== null && _c !== void 0 ? _c : 0);
            if (count >= limits[i].max) {
                throw new https_1.HttpsError("resource-exhausted", "Too many requests, try again later");
            }
            const windowStart = fresh ? now : start;
            return {
                count: count + 1,
                windowStart: admin.firestore.Timestamp.fromMillis(windowStart),
                // For an optional Firestore TTL policy on rate_limits.expiresAt.
                expiresAt: admin.firestore.Timestamp.fromMillis(windowStart + HOUR),
            };
        });
        next.forEach((doc, i) => tx.set(refs[i], doc));
    });
}
/**
 * Finds the Auth user for an email, creating one if there is none.
 * @param {string} email - The normalised email.
 * @param {string} firstName - Used as the new user's display name.
 * @return {Promise<{uid: string, created: boolean}>} The user's uid, and
 *   whether this call created them.
 */
async function findOrCreateUser(email, firstName) {
    const auth = admin.auth();
    try {
        return { uid: (await auth.getUserByEmail(email)).uid, created: false };
    }
    catch (err) {
        if (err.code !== "auth/user-not-found")
            throw err;
    }
    try {
        const user = await auth.createUser({
            email,
            displayName: firstName,
            emailVerified: false,
        });
        return { uid: user.uid, created: true };
    }
    catch (err) {
        // Another call created this user between our lookup and create.
        if (err.code !== "auth/email-already-exists") {
            throw err;
        }
        return { uid: (await auth.getUserByEmail(email)).uid, created: false };
    }
}
/**
 * Adds the visitor to the customer list, or updates their entry. Never
 * overwrites a first name, and never turns marketing consent off.
 * @param {string} uid - The user's uid.
 * @param {CaptureInput} input - The request.
 * @param {boolean} created - Whether this call created the Auth user.
 * @return {Promise<void>}
 */
async function upsertUserDoc(uid, input, created) {
    const db = admin.firestore();
    const ref = db.collection("users").doc(uid);
    await db.runTransaction(async (tx) => {
        var _a;
        const snap = await tx.get(ref);
        const existing = snap.data();
        const now = admin.firestore.FieldValue.serverTimestamp();
        const update = { uid, email: input.email };
        if (!(existing === null || existing === void 0 ? void 0 : existing.firstName))
            update.firstName = input.firstName;
        // The Auth onCreate trigger may have beaten us to it; if this call made
        // the account, the source is still "valuation".
        if (!snap.exists || created) {
            update.source = "valuation";
            update.registeredAt = (_a = existing === null || existing === void 0 ? void 0 : existing.registeredAt) !== null && _a !== void 0 ? _a : now;
        }
        if (input.marketingConsent) {
            update.marketingConsent = true;
            update.consentAt = now;
        }
        else if ((existing === null || existing === void 0 ? void 0 : existing.marketingConsent) === undefined) {
            update.marketingConsent = false;
        }
        tx.set(ref, update, { merge: true });
    });
}
/**
 * @param {unknown} value - The client's badge.
 * @return {object | null} The badge, if it has the expected string fields.
 */
function cleanBadge(value) {
    if (!value || typeof value !== "object")
        return null;
    const b = value;
    const fields = ["code", "label", "icon"];
    if (!fields.every((f) => typeof b[f] === "string" &&
        b[f].length <= 100)) {
        return null;
    }
    return Object.fromEntries(fields.map((f) => [f, b[f]]));
}
/**
 * @param {unknown} value - The client's charPoints.
 * @return {Array | null} The character points, if well-formed.
 */
function cleanCharPoints(value) {
    if (!Array.isArray(value) || value.length > 20)
        return null;
    const out = [];
    for (const item of value) {
        const c = item;
        if (!c || typeof c.character !== "string" || c.character.length > 2 ||
            typeof c.points !== "number" || !Number.isFinite(c.points)) {
            return null;
        }
        out.push({ character: c.character, points: c.points });
    }
    return out;
}
/**
 * Saves the valuation to the user's account dashboard. Re-submitting the
 * same plate updates the existing entry rather than adding another.
 * @param {string} uid - The user's uid.
 * @param {CaptureInput} input - The request.
 * @return {Promise<void>}
 */
async function saveDashboardValuation(uid, input) {
    const v = input.valuation;
    const doc = {};
    for (const f of VALUATION_NUMBER_FIELDS) {
        if (typeof v[f] === "number" && Number.isFinite(v[f]))
            doc[f] = v[f];
    }
    for (const f of VALUATION_BOOLEAN_FIELDS) {
        if (typeof v[f] === "boolean")
            doc[f] = v[f];
    }
    for (const f of VALUATION_STRING_FIELDS) {
        if (typeof v[f] === "string" && v[f].length <= 500) {
            doc[f] = v[f];
        }
    }
    const badge = cleanBadge(v.badge);
    if (badge)
        doc.badge = badge;
    const charPoints = cleanCharPoints(v.charPoints);
    if (charPoints)
        doc.charPoints = charPoints;
    // The dashboard shows totalPoints × multiplier; without the breakdown,
    // make that come out at the price.
    if (doc.totalPoints === undefined || doc.multiplier === undefined) {
        doc.totalPoints = input.price;
        doc.multiplier = 1;
    }
    const now = admin.firestore.Timestamp.now();
    Object.assign(doc, {
        userId: uid,
        type: input.type,
        registration: input.registration,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        updatedAt: now,
    });
    const db = admin.firestore();
    const existing = await db.collection("valuations")
        .where("userId", "==", uid)
        .where("registration", "==", input.registration)
        .where("type", "==", input.type)
        .limit(1)
        .get();
    if (existing.empty) {
        await db.collection("valuations").add(Object.assign(Object.assign({}, doc), { createdAt: now }));
    }
    else {
        await existing.docs[0].ref.set(doc, { merge: true });
    }
}
/**
 * Builds the HTML body for the valuation email.
 * @param {string} firstName - Recipient first name.
 * @param {string} registration - Plate registration (e.g. AB12CDE).
 * @param {number} price - The exact valuation.
 * @param {number} minPrice - Minimum valuation price.
 * @param {number} maxPrice - Maximum valuation price.
 * @param {string} listUrl - Sign-in link that opens a pre-filled
 *   /list-plate.
 * @return {string} HTML string.
 */
function buildValuationEmailHtml(firstName, registration, price, minPrice, maxPrice, listUrl) {
    /* eslint-disable max-len */
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#003399;font-size:24px;margin:0;">MR Valuations</h1>
  </div>
  <p>Hi ${(0, enquiries_js_1.escapeHtml)(firstName)},</p>
  <p>
    Here's your valuation for
    <strong style="font-size:18px;letter-spacing:2px;background:#FFC200;padding:2px 8px;border-radius:4px;">${(0, enquiries_js_1.escapeHtml)(registration)}</strong>
  </p>
  <div style="background:#f8f9fa;border-left:4px solid #003399;padding:16px;margin:24px 0;text-align:center;">
    <p style="margin:0 0 4px;color:#666;">Estimated value</p>
    <p style="margin:0 0 8px;font-size:32px;font-weight:bold;color:#003399;">${(0, nudge_emails_js_1.formatPrice)(price)}</p>
    <p style="margin:0;color:#666;">Typical range: <strong>${(0, nudge_emails_js_1.formatPrice)(minPrice)}</strong> – <strong>${(0, nudge_emails_js_1.formatPrice)(maxPrice)}</strong></p>
  </div>
  <p>
    Thinking of selling? <strong>Listing your plate is just £${constants_js_1.LISTING_FEE_GBP}</strong> — a one-off fee, and it stays listed until it sells.
    No commission, no monthly charges.
  </p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${(0, enquiries_js_1.escapeHtml)(listUrl)}"
       style="background:#003399;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:18px;font-weight:bold;display:inline-block;">
      List it for £${constants_js_1.LISTING_FEE_GBP} &rarr;
    </a>
  </div>
  <p style="color:#666;font-size:13px;text-align:center;">
    This button signs you in to MR Valuations and fills in your plate and price for you.
    It works once; if it has expired, you can ask for a new sign-in link on the login page.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="color:#888;font-size:12px;text-align:center;">
    <a href="${nudge_emails_js_1.APP_URL}" style="color:#003399;text-decoration:underline;">Value another plate</a> at MR Valuations
  </p>
  <p style="color:#888;font-size:12px;text-align:center;">The MR Valuations Team</p>
</body>
</html>`;
    /* eslint-enable max-len */
}
/**
 * Handles the email gate on a valuation result.
 * @param {Record<string, unknown>} data - firstName, email,
 *   marketingConsent, intent, registration, type, price, minPrice, maxPrice,
 *   appBaseUrl and, optionally, the client's RegValuation as valuation.
 * @param {string} ip - The caller's IP address, for rate limiting.
 * @return {Promise<CaptureValuationEmailResult>} created: whether a new
 *   account was made; customToken: a sign-in token, only when it was.
 */
async function runCaptureValuationEmail(data, ip) {
    const input = parseInput(data);
    await consumeRateLimits([
        { id: rateLimitId("email", input.email), max: EMAIL_LIMIT_PER_HOUR },
        { id: rateLimitId("ip", ip || "unknown"), max: IP_LIMIT_PER_HOUR },
    ]);
    const { uid, created } = await findOrCreateUser(input.email, input.firstName);
    await upsertUserDoc(uid, input, created);
    await saveDashboardValuation(uid, input);
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    await db.collection("auto_valuations").add({
        registration: input.registration,
        price: input.price,
        type: input.type,
        minPrice: input.minPrice,
        maxPrice: input.maxPrice,
        savedAt: now,
        email: input.email,
        firstName: input.firstName,
        userId: uid,
        valuationEmailSent: true,
        adminNotify: "server",
        source: "email_gate",
        intent: input.intent,
    });
    const continueUrl = `${input.appBaseUrl}/list-plate` +
        `?plate=${encodeURIComponent(input.registration)}` +
        `&price=${Math.round(input.price)}` +
        `&min=${Math.round(input.minPrice)}` +
        `&max=${Math.round(input.maxPrice)}`;
    let listUrl = continueUrl;
    try {
        listUrl = await admin.auth().generateSignInWithEmailLink(input.email, { url: continueUrl, handleCodeInApp: true });
    }
    catch (err) {
        // Still send the valuation; the plain link asks them to log in.
        console.error("valuation-email: sign-in link failed", err);
    }
    await db.collection("mail").add({
        to: [input.email],
        message: {
            subject: `Your ${input.registration} valuation: ` +
                (0, nudge_emails_js_1.formatPrice)(input.price),
            html: buildValuationEmailHtml(input.firstName, input.registration, input.price, input.minPrice, input.maxPrice, listUrl),
        },
    });
    console.log(`valuation-email: sent ${input.registration} to ` +
        `${(0, users_js_1.maskEmail)(input.email)} (created=${created}, intent=${input.intent})`);
    if (!created)
        return { created: false };
    try {
        const customToken = await admin.auth().createCustomToken(uid);
        return { created: true, customToken };
    }
    catch (err) {
        // The email's link still signs them in.
        console.error("valuation-email: custom token failed", err);
        return { created: true };
    }
}
/**
 * @param {string} link - The Firebase sign-in link.
 * @return {string} HTML for the "Email me a sign-in link" email.
 */
function buildSignInLinkEmailHtml(link) {
    /* eslint-disable max-len */
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#003399;font-size:24px;margin:0;">MR Valuations</h1>
  </div>
  <p>Hi,</p>
  <p>Here's the sign-in link you asked for. No password needed — just tap the button.</p>
  <div style="text-align:center;margin:32px 0;">
    <a href="${(0, enquiries_js_1.escapeHtml)(link)}"
       style="background:#003399;color:#fff;padding:16px 40px;text-decoration:none;border-radius:6px;font-size:18px;font-weight:bold;display:inline-block;">
      Sign in to MR Valuations
    </a>
  </div>
  <p style="color:#666;font-size:13px;text-align:center;">
    The link works once and expires soon. If you didn't ask for it, you can ignore this email.
  </p>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="color:#888;font-size:12px;text-align:center;">The MR Valuations Team</p>
</body>
</html>`;
    /* eslint-enable max-len */
}
/**
 * Emails a passwordless sign-in link through our own mail setup, so it comes
 * from the same sender as the valuation emails rather than Firebase's
 * noreply address, which tends to land in spam.
 * @param {Record<string, unknown>} data - email, and returnUrl: the page the
 *   link should bring the visitor back to.
 * @param {string} ip - The caller's IP address, for rate limiting.
 * @return {Promise<void>}
 */
async function runSendSignInLink(data, ip) {
    var _a, _b;
    const email = String((_a = data["email"]) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) {
        throw new https_1.HttpsError("invalid-argument", "Invalid email");
    }
    let returnUrl = `${nudge_emails_js_1.APP_URL}/account-dashboard`;
    try {
        const url = new URL(String((_b = data["returnUrl"]) !== null && _b !== void 0 ? _b : ""));
        if (ALLOWED_APP_BASE_URLS.includes(url.origin))
            returnUrl = url.toString();
    }
    catch (_c) {
        // Not a URL; keep the default.
    }
    await consumeRateLimits([
        { id: rateLimitId("link-email", email), max: EMAIL_LIMIT_PER_HOUR },
        { id: rateLimitId("link-ip", ip || "unknown"), max: IP_LIMIT_PER_HOUR },
    ]);
    const link = await admin.auth().generateSignInWithEmailLink(email, { url: returnUrl, handleCodeInApp: true });
    await admin.firestore().collection("mail").add({
        to: [email],
        message: {
            subject: "Your MR Valuations sign-in link",
            html: buildSignInLinkEmailHtml(link),
        },
    });
    console.log(`sign-in-link: sent to ${(0, users_js_1.maskEmail)(email)}`);
}
//# sourceMappingURL=valuation-email.js.map