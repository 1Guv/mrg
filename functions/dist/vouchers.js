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
exports.RESULT_VOUCHER_EXPIRY_MS = void 0;
exports.mintPlateVoucher = mintPlateVoucher;
exports.mintNudgeVoucher = mintNudgeVoucher;
exports.findResultVoucher = findResultVoucher;
exports.createPublicVoucher = createPublicVoucher;
exports.deactivateVoucher = deactivateVoucher;
exports.resolveVoucherForCheckout = resolveVoucherForCheckout;
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const NUDGE_PERCENT_OFF = 10;
const NUDGE_EXPIRY_MS = 24 * 60 * 60 * 1000;
exports.RESULT_VOUCHER_EXPIRY_MS = 48 * 60 * 60 * 1000;
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
async function mintPlateVoucher(stripe, db, opts) {
    var _a;
    const code = `PLATE10-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const expiresAtMs = Date.now() + opts.expiryMs;
    const coupon = await stripe.coupons.create({
        percent_off: NUDGE_PERCENT_OFF,
        duration: "once",
    });
    const promotionCode = await stripe.promotionCodes.create({
        promotion: { type: "coupon", coupon: coupon.id },
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
        description: `10% off listing ${opts.registration} — first ${hours} hours only`,
        audience: opts.audience,
        registration: opts.registration,
        email: (_a = opts.email) !== null && _a !== void 0 ? _a : null,
        expiresAt,
        active: true,
        createdAt: admin.firestore.Timestamp.now(),
        createdBy: opts.audience === "result" ? "result-page" : "nudge-system",
    });
    return { code, percentOff: NUDGE_PERCENT_OFF, expiresAt };
}
/**
 * Mints the 24-hour voucher for a plate's first nudge email.
 * @param {Stripe} stripe Stripe client.
 * @param {admin.firestore.Firestore} db Firestore instance.
 * @param {string} registration The plate registration this code is for.
 * @param {string} email Who the nudge is going to.
 * @return {Promise<PlateVoucher>} The generated code and its expiry.
 */
async function mintNudgeVoucher(stripe, db, registration, email) {
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
async function findResultVoucher(db, email, registration) {
    var _a;
    const snap = await db.collection("vouchers")
        .where("audience", "==", "result")
        .where("email", "==", email)
        .where("registration", "==", registration)
        .where("active", "==", true)
        .get();
    const now = Date.now();
    const live = snap.docs
        .map((d) => d.data())
        .filter((v) => v["expiresAt"]
        .toMillis() > now)
        .sort((a, b) => b["expiresAt"]
        .toMillis() - a["expiresAt"].toMillis());
    if (!live.length)
        return null;
    return {
        code: live[0]["code"],
        percentOff: Number((_a = live[0]["percentOff"]) !== null && _a !== void 0 ? _a : NUDGE_PERCENT_OFF),
        expiresAt: live[0]["expiresAt"],
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
async function createPublicVoucher(stripe, db, input) {
    const code = input.code.trim().toUpperCase();
    const coupon = await stripe.coupons.create({
        percent_off: input.percentOff,
        duration: "once",
    });
    const promotionCode = await stripe.promotionCodes.create(Object.assign(Object.assign({ promotion: { type: "coupon", coupon: coupon.id }, code }, (input.maxRedemptions ? { max_redemptions: input.maxRedemptions } : {})), (input.expiresAtMs ?
        { expires_at: Math.floor(input.expiresAtMs / 1000) } :
        {})));
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
async function deactivateVoucher(stripe, db, voucherDocId) {
    var _a;
    const docRef = db.collection("vouchers").doc(voucherDocId);
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new Error("Voucher not found");
    }
    const stripePromotionCodeId = (_a = snap.data()) === null || _a === void 0 ? void 0 : _a["stripePromotionCodeId"];
    await stripe.promotionCodes.update(stripePromotionCodeId, { active: false });
    await docRef.update({ active: false });
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
async function resolveVoucherForCheckout(stripe, voucherCode) {
    var _a, _b;
    const code = voucherCode.trim().toUpperCase();
    if (!code)
        return null;
    const result = await stripe.promotionCodes.list({
        code,
        active: true,
        limit: 1,
    });
    return (_b = (_a = result.data[0]) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : null;
}
//# sourceMappingURL=vouchers.js.map