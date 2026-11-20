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
exports.guestEmailHash = guestEmailHash;
exports.runSendGuestEnquiry = runSendGuestEnquiry;
exports.runGuestEmailBounced = runGuestEmailBounced;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const enquiries_js_1 = require("./enquiries.js");
const sign_in_links_js_1 = require("./sign-in-links.js");
const valuation_email_js_1 = require("./valuation-email.js");
const bounces_js_1 = require("./bounces.js");
/**
 * Enquiries from buyers who aren't signed in. They give an email instead of
 * making an account, and the enquiry goes to the seller exactly as a signed-in
 * buyer's would: straight through on legacy listings, locked until the seller
 * pays on free ones. The buyer is emailed a link that signs them in to see
 * replies. If that email bounces the address was fake or mistyped, so a
 * still-locked enquiry is withdrawn before any seller pays to read it.
 */
const EMAIL_LIMIT_PER_HOUR = 3;
const IP_LIMIT_PER_HOUR = 5;
/**
 * @param {string} email - A buyer's address.
 * @return {string} The id guest enquiries are found by, which doesn't reveal
 *   the address to the seller, who can read the enquiry.
 */
function guestEmailHash(email) {
    return (0, crypto_1.createHash)("sha256").update(email.trim().toLowerCase()).digest("hex");
}
/**
 * Send a signed-out buyer's enquiry.
 * @param {Record<string, unknown>} data - listingId, collection, enquiryType,
 *   message, email, and website (a field only bots fill in).
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<SendEnquiryResult>} As for a signed-in buyer.
 */
async function runSendGuestEnquiry(data, ip) {
    var _a, _b;
    // Pretend it worked, so bots learn nothing.
    if (String((_a = data.website) !== null && _a !== void 0 ? _a : "").trim()) {
        return { whatsappNumber: null, plate: "" };
    }
    const email = String((_b = data.email) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    if (email.length > 254 || !valuation_email_js_1.EMAIL_RE.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid email");
    }
    await (0, valuation_email_js_1.consumeRateLimits)([
        { id: (0, valuation_email_js_1.rateLimitId)("enquiry-email", email), max: EMAIL_LIMIT_PER_HOUR },
        { id: (0, valuation_email_js_1.rateLimitId)("enquiry-ip", ip || "unknown"), max: IP_LIMIT_PER_HOUR },
    ]);
    const { uid } = await (0, valuation_email_js_1.findOrCreateUser)(email, "");
    const result = await (0, enquiries_js_1.runSendEnquiry)(uid, email, data, { guest: true, guestEmailHash: guestEmailHash(email) });
    const link = await (0, sign_in_links_js_1.createSignInLink)(email, enquiries_js_1.MESSAGES_URL, sign_in_links_js_1.VALUATION_LINK_TTL);
    const next = result.sellerNotified ?
        "We've emailed the seller. When they reply, we'll email you." :
        "The seller has your email and will reply to you directly.";
    /* eslint-disable max-len */
    await admin.firestore().collection("mail").add({
        to: [email],
        message: {
            subject: `Your message about ${result.plate} has been sent`,
            html: `
        <h2>Your message about ${(0, enquiries_js_1.escapeHtml)(result.plate)} has been sent</h2>
        <p>${next}</p>
        <p><a href="${link}">See your messages</a></p>
        <p style="color:#6b7280;font-size:13px">This link signs you in, so there's no password to remember. It works for 7 days.</p>
      `,
        },
    });
    /* eslint-enable max-len */
    return result;
}
/**
 * A guest buyer's address bounced. Withdraw their enquiries that sellers
 * haven't unlocked yet, and tell the admin about any a seller already paid
 * to read.
 * @param {string} email - The dead address, lowercased.
 * @return {Promise<{withdrawn: number, paid: number}>} What was found.
 */
async function runGuestEmailBounced(email) {
    var _a, _b;
    const db = admin.firestore();
    const enquiries = await db.collection("seller_enquiries")
        .where("guestEmailHash", "==", guestEmailHash(email)).get();
    let withdrawn = 0;
    const paid = [];
    for (const doc of enquiries.docs) {
        const enquiry = doc.data();
        if (enquiry.locked) {
            const [messages, buyer] = await Promise.all([
                (0, enquiries_js_1.messagesRef)(doc.ref).get(),
                doc.ref.collection("private").doc("buyer").get(),
            ]);
            const batch = db.batch();
            messages.docs.forEach((m) => batch.delete(m.ref));
            if (buyer.exists)
                batch.delete(buyer.ref);
            batch.delete(doc.ref);
            await batch.commit();
            withdrawn++;
        }
        else {
            const listing = await db.collection("plate-listings-new")
                .doc(String(enquiry.plateId)).get();
            if (((_a = listing.data()) === null || _a === void 0 ? void 0 : _a.pricingModel) === "enquiry") {
                paid.push(String((_b = enquiry.plateCharacters) !== null && _b !== void 0 ? _b : "").toUpperCase());
            }
        }
    }
    if (paid.length) {
        const plates = paid.join(", ");
        await db.collection("mail").add({
            to: [bounces_js_1.ADMIN_INBOX_EMAIL],
            message: {
                subject: `Refund check: guest buyer's email bounced (${plates})`,
                html: `
          <p>A guest buyer's email (${(0, enquiries_js_1.escapeHtml)(email)}) bounced after the
          seller had unlocked their enquiry on ${(0, enquiries_js_1.escapeHtml)(paid.join(", "))}.
          Check whether the seller should be refunded.</p>
        `,
            },
        });
    }
    return { withdrawn, paid: paid.length };
}
//# sourceMappingURL=guest-enquiries.js.map