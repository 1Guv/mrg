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
exports.listingFields = listingFields;
exports.contactFields = contactFields;
exports.enquiriesLocked = enquiriesLocked;
exports.enquiryPreview = enquiryPreview;
exports.runCreateFreeListing = runCreateFreeListing;
exports.saveLockedEnquiry = saveLockedEnquiry;
exports.runCreateUnlockSession = runCreateUnlockSession;
exports.runUnlockEnquiries = runUnlockEnquiries;
exports.runUnlockReminders = runUnlockReminders;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const valuation_email_js_1 = require("./valuation-email.js");
const enquiries_js_1 = require("./enquiries.js");
const constants_js_1 = require("./constants.js");
/**
 * Pay per enquiry: listing a plate is free, and the seller pays the listing
 * fee once to read and reply to the first buyer enquiry. Every later
 * enquiry on that listing is free.
 *
 * Until the listing is unlocked, an enquiry's buyer email is kept in
 * seller_enquiries/<id>/private/buyer, which clients can't read, and its
 * messages can be read by the buyer but not the seller (see the rules).
 * The seller sees only the enquiry type and a short preview, and the buyer
 * doesn't get the seller's WhatsApp number.
 *
 * Listings paid for up front (no pricingModel) and the legacy stock are
 * never locked.
 */
const FREE_LISTING_LIMIT = 5;
const PREVIEW_WORDS = 6;
/**
 * Fields of a new plate-listings-new document, shared by paid and free
 * listings so the two can't drift apart.
 * @param {ListingInput} input - The seller's listing details.
 * @return {Record<string, unknown>} The public listing fields.
 */
function listingFields(input) {
    return {
        plateCharacters: input.plateCharacters,
        askingPrice: input.askingPrice,
        meanings: input.meanings,
        plateNegotiable: input.negotiable,
        sellerUid: input.sellerUid,
        initials: input.initials,
        createdDate: new Date().toISOString(),
        isSold: false,
        soldPrice: null,
        viewsPlaceholder: 0,
        plateBestOffer: false,
        offersOver: false,
        orNearestOffer: false,
        plateType: "",
        plateCategory: "",
        profiletPicUrl: "",
        profiletPicInitials: true,
        messageSeller: "",
    };
}
/**
 * Contact fields for <listing>/private/contact.
 * @param {ListingInput} input - The seller's listing details.
 * @return {Record<string, string>} The private contact fields.
 */
function contactFields(input) {
    return {
        lCEmail: input.email,
        lCNumber: input.phone,
        lCName: input.email,
        plateListingAccName: input.email,
        plateListingAccTelNumber: input.phone,
    };
}
/**
 * @param {Record<string, unknown>} listing - A listing document.
 * @return {boolean} Whether its enquiries are hidden until the seller pays.
 */
function enquiriesLocked(listing) {
    return listing.pricingModel === "enquiry" &&
        listing.enquiriesUnlocked !== true;
}
/**
 * The first few words of a message, with anything that looks like an email
 * address or phone number masked, so a locked preview can't leak contact
 * details.
 * @param {string} message - The buyer's message.
 * @return {string} The masked preview.
 */
function enquiryPreview(message) {
    const masked = message
        .replace(/\S+@\S+/g, "•••")
        .replace(/\+?\d[\d\s-]{5,}\d/g, "•••");
    const words = masked.trim().split(/\s+/);
    const head = words.slice(0, PREVIEW_WORDS).join(" ");
    return words.length > PREVIEW_WORDS ? `${head}…` : head;
}
/**
 * @param {unknown} value - A field from the request.
 * @param {number} min - Shortest allowed length after trimming.
 * @param {number} max - Longest allowed length after trimming.
 * @param {string} name - The field's name, for the error.
 * @return {string} The trimmed text.
 */
function text(value, min, max, name) {
    const s = String(value !== null && value !== void 0 ? value : "").trim();
    if (s.length < min || s.length > max) {
        throw new https_1.HttpsError("invalid-argument", `Invalid ${name}`);
    }
    return s;
}
/**
 * List a plate for free. Contact goes to the signed-in account's email so
 * the seller can read enquiries in their dashboard.
 * @param {string} uid - The signed-in seller.
 * @param {string} email - The seller's email from their auth token.
 * @param {Record<string, unknown>} data - plateCharacters, askingPrice,
 *   phone, initials, meanings and negotiable.
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<object>} The new listing's id and plate.
 */
async function runCreateFreeListing(uid, email, data, ip) {
    var _a, _b;
    const plateCharacters = text(data.plateCharacters, 2, 8, "plate").toUpperCase();
    if (!/^[A-Z0-9 ]+$/.test(plateCharacters)) {
        throw new https_1.HttpsError("invalid-argument", "Invalid plate");
    }
    const price = Number(data.askingPrice);
    if (!Number.isFinite(price) || price < 1) {
        throw new https_1.HttpsError("invalid-argument", "Invalid asking price");
    }
    const phone = text(data.phone, 7, 20, "phone");
    const meanings = String((_a = data.meanings) !== null && _a !== void 0 ? _a : "").trim().slice(0, 200);
    const initials = String((_b = data.initials) !== null && _b !== void 0 ? _b : "").trim().slice(0, 3)
        .toUpperCase() || email.substring(0, 2).toUpperCase();
    await (0, valuation_email_js_1.consumeRateLimits)([{ id: (0, valuation_email_js_1.rateLimitId)("free-listing-ip", ip || "unknown"), max: 10 }]);
    const db = admin.firestore();
    const mine = db.collection("plate-listings-new")
        .where("sellerUid", "==", uid)
        .where("isSold", "==", false);
    const [freeCount, samePlate] = await Promise.all([
        mine.where("pricingModel", "==", "enquiry").count().get(),
        mine.where("plateCharacters", "==", plateCharacters).limit(1).get(),
    ]);
    if (!samePlate.empty) {
        throw new https_1.HttpsError("already-exists", `You've already listed ${plateCharacters}`);
    }
    if (freeCount.data().count >= FREE_LISTING_LIMIT) {
        throw new https_1.HttpsError("resource-exhausted", `You can list up to ${FREE_LISTING_LIMIT} plates for free`);
    }
    const input = {
        plateCharacters,
        askingPrice: String(Math.round(price)),
        meanings,
        negotiable: data.negotiable === true,
        sellerUid: uid,
        initials,
        email,
        phone,
    };
    const listingRef = db.collection("plate-listings-new").doc();
    const batch = db.batch();
    batch.set(listingRef, Object.assign(Object.assign({}, listingFields(input)), { pricingModel: "enquiry", enquiriesUnlocked: false }));
    batch.set((0, enquiries_js_1.contactRef)(listingRef), contactFields(input));
    batch.set(db.collection("mail").doc(), {
        to: [email],
        message: {
            subject: `Your plate ${plateCharacters} is listed`,
            html: listedEmailHtml(plateCharacters, input.askingPrice),
        },
    });
    await batch.commit();
    return { listingId: listingRef.id, plateCharacters };
}
/**
 * @param {string} plate - The plate, upper case.
 * @param {string} price - The asking price in pounds.
 * @return {string} Confirmation email HTML for a free listing.
 */
function listedEmailHtml(plate, price) {
    const link = `https://mrvaluations.co.uk/plates-for-sale/${plate.replace(/\s/g, "")}`;
    /* eslint-disable max-len */
    return `
    <h2>${(0, enquiries_js_1.escapeHtml)(plate)} is now for sale</h2>
    <p>Your plate is listed at <strong>£${(0, enquiries_js_1.escapeHtml)(price)}</strong>: <a href="${link}">see your listing</a>.</p>
    <p>Listing is free. When the first buyer messages you, we'll email you, and you pay £${constants_js_1.LISTING_FEE_GBP} once to read and reply. Every enquiry after that is free.</p>
  `;
    /* eslint-enable max-len */
}
/**
 * Save an enquiry on a locked listing: the buyer's details go in a private
 * subdocument, and the seller is emailed a preview with a link to unlock.
 * @param {admin.firestore.DocumentReference} listingRef - The listing.
 * @param {Record<string, unknown>} listing - The listing's data.
 * @param {string} sellerEmail - Where the seller's emails go.
 * @param {object} enquiry - The buyer's enquiry.
 * @return {Promise<void>}
 */
async function saveLockedEnquiry(listingRef, listing, sellerEmail, enquiry) {
    var _a, _b;
    const db = admin.firestore();
    const plate = String((_a = listing.plateCharacters) !== null && _a !== void 0 ? _a : "").toUpperCase();
    const preview = enquiryPreview(enquiry.message);
    const now = admin.firestore.FieldValue.serverTimestamp();
    const enquiryRef = db.collection("seller_enquiries").doc();
    const batch = db.batch();
    // buyerUid stays visible so the buyer can see their conversation; it
    // isn't contact information.
    batch.set(enquiryRef, {
        plateId: listingRef.id,
        plateCharacters: (_b = listing.plateCharacters) !== null && _b !== void 0 ? _b : "",
        enquiryType: enquiry.enquiryType,
        message: null,
        preview,
        locked: true,
        buyerUid: enquiry.buyerUid,
        buyerEmail: null,
        sellerLCNumber: "",
        sellerEmail,
        submittedAt: now,
        lastMessageAt: now,
        lastMessageFrom: "buyer",
        lastMessageText: null,
    });
    batch.set((0, enquiries_js_1.messagesRef)(enquiryRef).doc(), { from: "buyer", text: enquiry.message, sentAt: now });
    batch.set(enquiryRef.collection("private").doc("buyer"), {
        message: enquiry.message,
        buyerUid: enquiry.buyerUid,
        buyerEmail: enquiry.buyerEmail,
    });
    /* eslint-disable max-len */
    batch.set(db.collection("mail").doc(), {
        to: [sellerEmail],
        message: {
            subject: `A buyer is interested in ${plate}`,
            html: `
        <h2>You have a new enquiry for ${(0, enquiries_js_1.escapeHtml)(plate)}</h2>
        <p><strong>Enquiry type:</strong> ${(0, enquiries_js_1.escapeHtml)(enquiry.enquiryType)}</p>
        <p><strong>Message:</strong> “${(0, enquiries_js_1.escapeHtml)(preview)}”</p>
        <p>Pay £${constants_js_1.LISTING_FEE_GBP} once to read the full message and reply. Every enquiry after this one is free.</p>
        <p><a href="${enquiries_js_1.MESSAGES_URL}">Unlock this enquiry</a></p>
      `,
        },
    });
    /* eslint-enable max-len */
    batch.update(listingRef, {
        viewsPlaceholder: admin.firestore.FieldValue.increment(1),
    });
    await batch.commit();
}
/**
 * Start a Stripe Checkout for unlocking a listing's enquiries.
 * @param {Stripe} stripe - Stripe client.
 * @param {string} uid - The signed-in seller.
 * @param {string} email - The seller's email from their auth token.
 * @param {Record<string, unknown>} data - listingId and appBaseUrl.
 * @param {Function} resolveVoucher - Finds a voucher's Stripe promotion code.
 * @return {Promise<object>} The Checkout URL.
 */
async function runCreateUnlockSession(stripe, uid, email, data, resolveVoucher) {
    var _a;
    const listingId = text(data.listingId, 1, 100, "listing");
    const appBaseUrl = text(data.appBaseUrl, 1, 200, "app URL");
    const snap = await admin.firestore()
        .collection("plate-listings-new").doc(listingId).get();
    const listing = snap.data();
    if (!listing || listing.sellerUid !== uid) {
        throw new https_1.HttpsError("not-found", "Listing not found");
    }
    if (!enquiriesLocked(listing)) {
        throw new https_1.HttpsError("failed-precondition", "Already unlocked");
    }
    const voucherCode = String((_a = data.voucherCode) !== null && _a !== void 0 ? _a : "").trim().toUpperCase();
    const promotionCodeId = voucherCode ? await resolveVoucher(voucherCode) : null;
    const plate = String(listing.plateCharacters).toUpperCase();
    const back = `${appBaseUrl}/account-dashboard?tab=messages`;
    const session = await stripe.checkout.sessions.create(Object.assign(Object.assign({ mode: "payment", customer_email: email, line_items: [{
                price_data: {
                    currency: "gbp",
                    unit_amount: constants_js_1.LISTING_FEE_GBP * 100,
                    product_data: {
                        name: `Unlock enquiries: ${plate}`,
                        description: "One-off — read and reply to every enquiry on this plate",
                    },
                },
                quantity: 1,
            }], success_url: `${back}&unlocked=${encodeURIComponent(plate)}` +
            "&session_id={CHECKOUT_SESSION_ID}", cancel_url: back }, (promotionCodeId ?
        { discounts: [{ promotion_code: promotionCodeId }] } :
        { allow_promotion_codes: true })), { metadata: {
            purpose: "unlock",
            listingId,
            sellerUid: uid,
            voucherCode: promotionCodeId ? voucherCode : "",
        } }));
    return { url: session.url };
}
/**
 * After an unlock payment: open the listing's enquiries and email the
 * seller each one in full. Safe to run twice for the same payment.
 * @param {string} listingId - The listing paid for.
 * @param {string} sessionId - The Stripe Checkout session.
 * @param {number} discountPence - Discount applied at checkout.
 * @param {string} voucherCode - Voucher code applied, if known.
 * @return {Promise<void>}
 */
async function runUnlockEnquiries(listingId, sessionId, discountPence, voucherCode) {
    var _a;
    const db = admin.firestore();
    const listingRef = db.collection("plate-listings-new").doc(listingId);
    const listingSnap = await listingRef.get();
    const listing = listingSnap.data();
    if (!listing) {
        console.error(`unlock: listing ${listingId} not found (${sessionId})`);
        return;
    }
    if (listing.unlockSessionId === sessionId)
        return;
    const locked = await db.collection("seller_enquiries")
        .where("plateId", "==", listingId)
        .where("locked", "==", true)
        .get();
    const privates = await Promise.all(locked.docs.map((d) => d.ref.collection("private").doc("buyer").get()));
    const plate = String((_a = listing.plateCharacters) !== null && _a !== void 0 ? _a : "").toUpperCase();
    const batch = db.batch();
    batch.update(listingRef, {
        enquiriesUnlocked: true,
        unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
        unlockSessionId: sessionId,
        voucherCode: voucherCode || null,
        discountAppliedPence: discountPence || null,
    });
    locked.docs.forEach((doc, i) => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const buyer = (_a = privates[i].data()) !== null && _a !== void 0 ? _a : {};
        const enquiry = doc.data();
        batch.update(doc.ref, {
            locked: false,
            message: (_b = buyer.message) !== null && _b !== void 0 ? _b : "",
            buyerUid: (_c = buyer.buyerUid) !== null && _c !== void 0 ? _c : null,
            buyerEmail: (_d = buyer.buyerEmail) !== null && _d !== void 0 ? _d : null,
            lastMessageText: (_f = (_e = enquiry.lastMessageText) !== null && _e !== void 0 ? _e : buyer.message) !== null && _f !== void 0 ? _f : "",
        });
        /* eslint-disable max-len */
        batch.set(db.collection("mail").doc(), Object.assign(Object.assign({ to: [enquiry.sellerEmail] }, (buyer.buyerEmail ? { replyTo: buyer.buyerEmail } : {})), { message: {
                subject: `Enquiry for your plate ${plate}`,
                html: `
          <h2>Your enquiry is unlocked</h2>
          <p><strong>Plate:</strong> ${(0, enquiries_js_1.escapeHtml)(plate)}</p>
          <p><strong>Enquiry type:</strong> ${(0, enquiries_js_1.escapeHtml)(String((_g = enquiry.enquiryType) !== null && _g !== void 0 ? _g : ""))}</p>
          <p><strong>Message:</strong> ${(0, enquiries_js_1.escapeHtml)(String((_h = buyer.message) !== null && _h !== void 0 ? _h : ""))}</p>
          <p><strong>From:</strong> ${(0, enquiries_js_1.escapeHtml)(String((_j = buyer.buyerEmail) !== null && _j !== void 0 ? _j : ""))}</p>
          <p>Reply to this email, or from <a href="${enquiries_js_1.MESSAGES_URL}">your messages</a>.</p>
        `,
            } }));
        /* eslint-enable max-len */
    });
    await batch.commit();
}
/** Hours after the first locked enquiry that each reminder is due. */
const UNLOCK_REMINDER_HOURS = [24, 72];
/**
 * Remind sellers who haven't unlocked a waiting enquiry: once after a day,
 * once more after three days, then never again for that listing. One email
 * per listing, however many buyers are waiting.
 * @return {Promise<void>}
 */
async function runUnlockReminders() {
    var _a, _b;
    const db = admin.firestore();
    const locked = await db.collection("seller_enquiries")
        .where("locked", "==", true)
        .get();
    const byListing = new Map();
    locked.docs.forEach((doc) => {
        var _a, _b;
        const enquiry = doc.data();
        const id = String((_a = enquiry.plateId) !== null && _a !== void 0 ? _a : "");
        if (id)
            byListing.set(id, [...((_b = byListing.get(id)) !== null && _b !== void 0 ? _b : []), enquiry]);
    });
    const now = Date.now();
    let sent = 0;
    for (const [listingId, enquiries] of byListing) {
        const listingRef = db.collection("plate-listings-new").doc(listingId);
        const listing = (await listingRef.get()).data();
        if (!listing || listing.isSold || !enquiriesLocked(listing))
            continue;
        const remindersSent = Number((_a = listing.unlockRemindersSent) !== null && _a !== void 0 ? _a : 0);
        const dueAfter = UNLOCK_REMINDER_HOURS[remindersSent];
        if (dueAfter === undefined)
            continue;
        const firstAt = Math.min(...enquiries.map((e) => { var _a, _b, _c; return (_c = (_b = (_a = e.submittedAt) === null || _a === void 0 ? void 0 : _a.toMillis) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : now; }));
        if (now - firstAt < dueAfter * 3600000)
            continue;
        const plate = String((_b = listing.plateCharacters) !== null && _b !== void 0 ? _b : "").toUpperCase();
        const batch = db.batch();
        batch.set(db.collection("mail").doc(), {
            to: [enquiries[0].sellerEmail],
            message: {
                subject: enquiries.length > 1 ?
                    `${enquiries.length} buyers are waiting to hear about ${plate}` :
                    `A buyer is still waiting to hear about ${plate}`,
                html: unlockReminderHtml(plate, enquiries, remindersSent === 1),
            },
        });
        batch.update(listingRef, { unlockRemindersSent: remindersSent + 1 });
        await batch.commit();
        sent++;
    }
    console.log(`unlock reminders: sent ${sent}`);
}
/**
 * @param {string} plate - The plate, upper case.
 * @param {admin.firestore.DocumentData[]} enquiries - The locked enquiries.
 * @param {boolean} last - Whether this is the final reminder.
 * @return {string} Reminder email HTML.
 */
function unlockReminderHtml(plate, enquiries, last) {
    const previews = enquiries.map((e) => {
        var _a, _b;
        return `<li><strong>${(0, enquiries_js_1.escapeHtml)(String((_a = e.enquiryType) !== null && _a !== void 0 ? _a : ""))}:</strong> ` +
            `“${(0, enquiries_js_1.escapeHtml)(String((_b = e.preview) !== null && _b !== void 0 ? _b : ""))}”</li>`;
    }).join("");
    const waiting = enquiries.length > 1 ?
        `${enquiries.length} buyers have messaged you` :
        "A buyer has messaged you";
    /* eslint-disable max-len */
    return `
    <h2>${waiting} about ${(0, enquiries_js_1.escapeHtml)(plate)}</h2>
    <ul>${previews}</ul>
    <p>They haven't had a reply yet. Pay £${constants_js_1.LISTING_FEE_GBP} once to read the full ${enquiries.length > 1 ? "messages" : "message"} and reply — every enquiry on this plate after that is free.</p>
    <p><a href="${enquiries_js_1.MESSAGES_URL}">Unlock and reply</a></p>
    ${last ? "<p>This is the last reminder we'll send about these enquiries.</p>" : ""}
  `;
    /* eslint-enable max-len */
}
//# sourceMappingURL=pay-per-enquiry.js.map