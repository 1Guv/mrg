import * as admin from "firebase-admin";
import * as crypto from "crypto";

type StripeClient = import("stripe").Stripe;

const NUDGE_PERCENT_OFF = 10;
const NUDGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const RESULT_VOUCHER_EXPIRY_MS = 48 * 60 * 60 * 1000;

export interface PlateVoucher {
  code: string;
  percentOff: number;
  expiresAt: admin.firestore.Timestamp;
}

/**
 * Mints a single-use 10%-off Stripe promotion code for listing one plate,
 * and mirrors it into the `vouchers` collection.
 * @param {Stripe} stripe Stripe client.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {object} opts registration; audience ("nudge" for nudge emails,
 *   "result" for the valuation result page); expiryMs; and email, which
 *   ties the voucher to a person so it can be found again.
 * @return {Promise<PlateVoucher>} The generated code and its expiry.
 */
export async function mintPlateVoucher(
  stripe: StripeClient,
  db: admin.firestore.Firestore,
  opts: {
    registration: string;
    audience: "nudge" | "result";
    expiryMs: number;
    email?: string;
  }
): Promise<PlateVoucher> {
  const code = `PLATE10-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const expiresAtMs = Date.now() + opts.expiryMs;

  const coupon = await stripe.coupons.create({
    percent_off: NUDGE_PERCENT_OFF,
    duration: "once",
  });
  const promotionCode = await stripe.promotionCodes.create({
    promotion: {type: "coupon", coupon: coupon.id},
    code,
    max_redemptions: 1,
    expires_at: Math.floor(expiresAtMs / 1000),
  });

  const expiresAt = admin.firestore.Timestamp.fromMillis(expiresAtMs);
  const hours = Math.round(opts.expiryMs / (60 * 60 * 1000));

  await db.collection("vouchers").add({
    code,
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCode.id,
    percentOff: NUDGE_PERCENT_OFF,
    description:
      `10% off listing ${opts.registration} — first ${hours} hours only`,
    audience: opts.audience,
    registration: opts.registration,
    email: opts.email ?? null,
    expiresAt,
    active: true,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: opts.audience === "result" ? "result-page" : "nudge-system",
  });

  return {code, percentOff: NUDGE_PERCENT_OFF, expiresAt};
}

/**
 * Mints the 24-hour voucher for a plate's first nudge email.
 * @param {Stripe} stripe Stripe client.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {string} registration The plate registration this code is for.
 * @param {string} email Who the nudge is going to.
 * @return {Promise<PlateVoucher>} The generated code and its expiry.
 */
export async function mintNudgeVoucher(
  stripe: StripeClient,
  db: admin.firestore.Firestore,
  registration: string,
  email?: string
): Promise<PlateVoucher> {
  return mintPlateVoucher(stripe, db, {
    registration, email, audience: "nudge", expiryMs: NUDGE_EXPIRY_MS,
  });
}

/**
 * The unexpired result-page voucher for an email and plate, if there is one.
 * Equality filters only, so no composite index is needed.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {string} email Normalised email.
 * @param {string} registration Plate, no spaces, upper case.
 * @return {Promise<PlateVoucher | null>} The voucher, or null.
 */
export async function findResultVoucher(
  db: admin.firestore.Firestore,
  email: string,
  registration: string
): Promise<PlateVoucher | null> {
  const snap = await db.collection("vouchers")
    .where("audience", "==", "result")
    .where("email", "==", email)
    .where("registration", "==", registration)
    .where("active", "==", true)
    .get();
  const now = Date.now();
  const live = snap.docs
    .map((d) => d.data())
    .filter((v) => (v["expiresAt"] as admin.firestore.Timestamp)
      .toMillis() > now)
    .sort((a, b) => (b["expiresAt"] as admin.firestore.Timestamp)
      .toMillis() - (a["expiresAt"] as admin.firestore.Timestamp).toMillis());
  if (!live.length) return null;
  return {
    code: live[0]["code"] as string,
    percentOff: Number(live[0]["percentOff"] ?? NUDGE_PERCENT_OFF),
    expiresAt: live[0]["expiresAt"] as admin.firestore.Timestamp,
  };
}

/**
 * Creates an admin-managed public voucher: a Stripe Coupon + Promotion Code,
 * mirrored into the `vouchers` collection for public display.
 * @param {Stripe} stripe Stripe client.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {object} input Voucher fields supplied by the admin.
 * @param {string} input.code Human-readable code, e.g. "SPRING10".
 * @param {number} input.percentOff Percentage discount, e.g. 10.
 * @param {string} input.description Shown on the public banner.
 * @param {number | null} input.expiresAtMs Expiry as epoch ms, or null.
 * @param {number | null} input.maxRedemptions Redemption cap, or null.
 * @return {Promise<string>} The new `vouchers` document ID.
 */
export async function createPublicVoucher(
  stripe: StripeClient,
  db: admin.firestore.Firestore,
  input: {
    code: string;
    percentOff: number;
    description: string;
    expiresAtMs: number | null;
    maxRedemptions: number | null;
  }
): Promise<string> {
  const code = input.code.trim().toUpperCase();

  const coupon = await stripe.coupons.create({
    percent_off: input.percentOff,
    duration: "once",
  });
  const promotionCode = await stripe.promotionCodes.create({
    promotion: {type: "coupon", coupon: coupon.id},
    code,
    ...(input.maxRedemptions ? {max_redemptions: input.maxRedemptions} : {}),
    ...(input.expiresAtMs ?
      {expires_at: Math.floor(input.expiresAtMs / 1000)} :
      {}),
  });

  const docRef = await db.collection("vouchers").add({
    code,
    stripeCouponId: coupon.id,
    stripePromotionCodeId: promotionCode.id,
    percentOff: input.percentOff,
    description: input.description,
    audience: "public",
    expiresAt: input.expiresAtMs ?
      admin.firestore.Timestamp.fromMillis(input.expiresAtMs) :
      null,
    active: true,
    createdAt: admin.firestore.Timestamp.now(),
    createdBy: "admin",
  });

  return docRef.id;
}

/**
 * Deactivates a voucher in both Stripe and Firestore.
 * @param {Stripe} stripe Stripe client.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {string} voucherDocId The `vouchers` document ID to deactivate.
 * @return {Promise<void>}
 */
export async function deactivateVoucher(
  stripe: StripeClient,
  db: admin.firestore.Firestore,
  voucherDocId: string
): Promise<void> {
  const docRef = db.collection("vouchers").doc(voucherDocId);
  const snap = await docRef.get();
  if (!snap.exists) {
    throw new Error("Voucher not found");
  }
  const stripePromotionCodeId =
    snap.data()?.["stripePromotionCodeId"] as string;
  await stripe.promotionCodes.update(stripePromotionCodeId, {active: false});
  await docRef.update({active: false});
}

/**
 * Resolves a customer-supplied voucher code to an active Stripe Promotion
 * Code ID, for use in `discounts` on a Checkout Session. Returns null for
 * any code that is missing, expired, fully redeemed, or deactivated —
 * callers should silently fall back to full price rather than error.
 * @param {Stripe} stripe Stripe client.
 * @param {string} voucherCode The code as entered/passed by the customer.
 * @return {Promise<string | null>} The Stripe Promotion Code ID, or null.
 */
export async function resolveVoucherForCheckout(
  stripe: StripeClient,
  voucherCode: string
): Promise<string | null> {
  const code = voucherCode.trim().toUpperCase();
  if (!code) return null;

  const result = await stripe.promotionCodes.list({
    code,
    active: true,
    limit: 1,
  });

  return result.data[0]?.id ?? null;
}
