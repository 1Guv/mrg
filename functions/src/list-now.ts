import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {consumeRateLimits, rateLimitId} from "./valuation-email.js";
import {
  findResultVoucher,
  mintPlateVoucher,
  RESULT_VOUCHER_EXPIRY_MS,
} from "./vouchers.js";
import {maskEmail} from "./users.js";

type StripeClient = import("stripe").Stripe;

const DAY = 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const REG_RE = /^[A-Z0-9 ]{2,8}$/;

/** Buyer demand is only shown at or above this many matching searches. */
export const BUYER_DEMAND_THRESHOLD = 5;
const BUYER_DEMAND_WINDOW_MS = 30 * DAY;

export type SellIntent = "yes" | "later" | "curious";
const SELL_INTENTS: SellIntent[] = ["yes", "later", "curious"];

/** "Maybe later" moves that plate's nudges to weekly. */
const LATER_CADENCE_DAYS = 7;

interface Caller {
  email?: string | null;
  uid?: string;
}

/**
 * @param {unknown} raw - The registration from the request.
 * @return {string} The plate with no spaces, upper case.
 */
function parseRegistration(raw: unknown): string {
  const reg = String(raw ?? "").trim().toUpperCase();
  if (!REG_RE.test(reg) || reg.replace(/\s/g, "").length < 2) {
    throw new HttpsError("invalid-argument", "Invalid registration");
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
function callerEmail(
  data: Record<string, unknown>,
  caller: Caller
): string | null {
  const email = String(caller.email ?? data["email"] ?? "")
    .trim().toLowerCase();
  return EMAIL_RE.test(email) && email.length <= 254 ? email : null;
}

/**
 * @param {string} ip - The caller's IP address.
 * @param {string} kind - Which callable is being limited.
 * @param {number} max - Calls per hour.
 * @return {Promise<void>}
 */
function limitByIp(ip: string, kind: string, max: number): Promise<void> {
  return consumeRateLimits([{id: rateLimitId(kind, ip || "unknown"), max}]);
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
export function searchMatchesPlate(
  term: string,
  registration: string
): boolean {
  const t = term.toLowerCase().replace(/\s/g, "");
  const plate = registration.toLowerCase().replace(/\s/g, "");
  if (!t || !plate) return false;
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
export async function runGetBuyerDemand(
  data: Record<string, unknown>,
  caller: Caller,
  ip: string
): Promise<{count: number}> {
  const registration = parseRegistration(data["registration"]);
  await limitByIp(ip, "buyer-demand-ip", 30);

  // Volumes are small, so scan the window and match in memory. Move to
  // stored counters if buyer_searches grows past a few thousand a month.
  const since = admin.firestore.Timestamp.fromMillis(
    Date.now() - BUYER_DEMAND_WINDOW_MS);
  const snap = await admin.firestore().collection("buyer_searches")
    .where("searchedAt", ">=", since)
    .get();

  const count = snap.docs.filter((d) => {
    const s = d.data();
    if (caller.uid && s["userId"] === caller.uid) return false;
    return searchMatchesPlate(String(s["term"] ?? ""), registration);
  }).length;

  return {count: count >= BUYER_DEMAND_THRESHOLD ? count : 0};
}

// ── "Would you sell?" ────────────────────────────────────────────────────────

/**
 * The nudge-queue changes for an answer, or null for none.
 * @param {SellIntent} answer - The visitor's answer.
 * @return {Record<string, unknown> | null} Fields to set on the entry.
 */
export function queueUpdateForIntent(
  answer: SellIntent
): Record<string, unknown> | null {
  if (answer === "later") {
    return {
      cadenceDays: LATER_CADENCE_DAYS,
      nextSendAt: admin.firestore.Timestamp.fromMillis(
        Date.now() + LATER_CADENCE_DAYS * DAY),
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
export async function findSellIntent(
  email: string,
  registration: string
): Promise<SellIntent | null> {
  const snap = await admin.firestore().collection("sell_intents")
    .doc(sellIntentId(email, registration)).get();
  const answer = snap.data()?.["answer"];
  return SELL_INTENTS.includes(answer) ? answer as SellIntent : null;
}

/**
 * @param {string} email - Normalised email.
 * @param {string} registration - Plate, no spaces, upper case.
 * @return {string} The sell_intents document id.
 */
function sellIntentId(email: string, registration: string): string {
  return `${email}_${registration}`;
}

/**
 * Records "Would you sell at this price?" and applies it to the plate's nudge
 * emails. If the queue entry isn't made yet, runOnAutoValuationCreated
 * applies the answer when it makes it.
 * @param {Record<string, unknown>} data - registration, answer, and email
 *   when the caller isn't signed in.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @return {Promise<{recorded: boolean}>} Whether there was an email to
 *   record the answer against.
 */
export async function runRecordSellIntent(
  data: Record<string, unknown>,
  caller: Caller,
  ip: string
): Promise<{recorded: boolean}> {
  const registration = parseRegistration(data["registration"]);
  const answer = data["answer"] as SellIntent;
  if (!SELL_INTENTS.includes(answer)) {
    throw new HttpsError("invalid-argument", "Invalid answer");
  }
  await limitByIp(ip, "sell-intent-ip", 20);

  const email = callerEmail(data, caller);
  if (!email) return {recorded: false};

  const db = admin.firestore();
  await db.collection("sell_intents").doc(sellIntentId(email, registration))
    .set({
      email,
      uid: caller.uid ?? null,
      registration,
      answer,
      answeredAt: admin.firestore.Timestamp.now(),
    });

  const update = queueUpdateForIntent(answer);
  if (update) {
    const entries = await db.collection("listing_nudge_queue")
      .where("email", "==", email)
      .where("registration", "==", registration)
      .get();
    await Promise.all(entries.docs.map((d) => d.ref.update(update)));
  }

  console.log(
    `sell-intent: ${registration} ${answer} for ${maskEmail(email)}`);
  return {recorded: true};
}

// ── Plate meaning ────────────────────────────────────────────────────────────

export type MeaningCategory =
  "name" | "word" | "car" | "business" | "date" | "other";
const MEANING_CATEGORIES: MeaningCategory[] =
  ["name", "word", "car", "business", "date", "other"];
const MEANING_MAX_LENGTH = 80;

/**
 * Records what a plate means to its owner, asked under a revealed valuation.
 * Last answer wins. The text also pre-fills their listing on the client.
 * @param {Record<string, unknown>} data - registration, category, optional
 *   text, and email when the caller isn't signed in.
 * @param {Caller} caller - The signed-in user, if any.
 * @param {string} ip - For rate limiting.
 * @return {Promise<{recorded: boolean}>} Whether there was an email to
 *   record it against.
 */
export async function runRecordPlateMeaning(
  data: Record<string, unknown>,
  caller: Caller,
  ip: string
): Promise<{recorded: boolean}> {
  const registration = parseRegistration(data["registration"]);
  const category = data["category"] as MeaningCategory;
  if (!MEANING_CATEGORIES.includes(category)) {
    throw new HttpsError("invalid-argument", "Invalid category");
  }
  const text = String(data["text"] ?? "").trim().slice(0, MEANING_MAX_LENGTH);
  await limitByIp(ip, "plate-meaning-ip", 20);

  const email = callerEmail(data, caller);
  if (!email) return {recorded: false};

  await admin.firestore().collection("plate_meanings")
    .doc(sellIntentId(email, registration))
    .set({
      email,
      uid: caller.uid ?? null,
      registration,
      category,
      text,
      answeredAt: admin.firestore.Timestamp.now(),
    });
  return {recorded: true};
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
export async function runGetResultVoucher(
  data: Record<string, unknown>,
  caller: Caller,
  ip: string,
  stripe: StripeClient
): Promise<{code: string; percentOff: number; expiresAt: number} | null> {
  const registration = parseRegistration(data["registration"]);
  const email = callerEmail(data, caller);
  if (!email) return null;

  const db = admin.firestore();
  const existing = await findResultVoucher(db, email, registration);
  const voucher = existing ?? await (async () => {
    // Only minting counts against the limit; returning a live code is free.
    await limitByIp(ip, "result-voucher-ip", 10);
    return mintPlateVoucher(stripe, db, {
      registration,
      email,
      audience: "result",
      expiryMs: RESULT_VOUCHER_EXPIRY_MS,
    });
  })();

  return {
    code: voucher.code,
    percentOff: voucher.percentOff,
    expiresAt: voucher.expiresAt.toMillis(),
  };
}
