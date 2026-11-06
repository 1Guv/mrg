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
exports.MESSAGES_URL = exports.CONTACT_FIELDS = exports.LISTING_COLLECTIONS = void 0;
exports.contactRef = contactRef;
exports.messagesRef = messagesRef;
exports.escapeHtml = escapeHtml;
exports.runSendEnquiry = runSendEnquiry;
exports.runReplyToEnquiry = runReplyToEnquiry;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const pay_per_enquiry_js_1 = require("./pay-per-enquiry.js");
/**
 * Buyer enquiries and the conversations that follow. Seller contact details
 * live in a private subdocument, <listing>/private/contact, which clients
 * can't read, so the emails are sent from here rather than from the browser.
 *
 * Each enquiry is a conversation: seller_enquiries/<id> holds who it's
 * between and the latest message, and seller_enquiries/<id>/messages holds
 * every message from either side. Each new message is also emailed.
 */
exports.LISTING_COLLECTIONS = ["plate-listings-new", "plate-listings"];
exports.CONTACT_FIELDS = [
    "lCEmail",
    "lCNumber",
    "lCName",
    "plateListingAccName",
    "plateListingAccTelNumber",
];
/**
 * @param {admin.firestore.DocumentReference} listingRef - The listing.
 * @return {admin.firestore.DocumentReference} Its private contact document.
 */
function contactRef(listingRef) {
    return listingRef.collection("private").doc("contact");
}
/**
 * @param {admin.firestore.DocumentReference} enquiryRef - A conversation.
 * @return {admin.firestore.CollectionReference} Its messages.
 */
function messagesRef(enquiryRef) {
    return enquiryRef.collection("messages");
}
/**
 * @param {string} text - Text typed by a user.
 * @return {string} The text, safe to put in an email's HTML.
 */
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;");
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
 * Save a buyer's enquiry and email it to the seller.
 * @param {string} buyerUid - The signed-in buyer.
 * @param {string} buyerEmail - The buyer's email from their auth token.
 * @param {Record<string, unknown>} data - listingId, collection (a hint),
 *   enquiryType and message.
 * @return {Promise<object>} whatsappNumber: the seller's number, digits
 *   only, so the buyer can follow up on WhatsApp; null when there is none
 *   or the seller hasn't unlocked their enquiries yet. sellerNotified is
 *   true when the enquiry waits for the seller to unlock it.
 */
async function runSendEnquiry(buyerUid, buyerEmail, data) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const listingId = text(data.listingId, 1, 100, "listing");
    const enquiryType = text(data.enquiryType, 1, 100, "enquiry type");
    const message = text(data.message, 10, 2000, "message");
    const db = admin.firestore();
    // Try the collection the client named first, then the other one.
    const hint = String((_a = data.collection) !== null && _a !== void 0 ? _a : "");
    const collections = [...exports.LISTING_COLLECTIONS]
        .sort((a, b) => Number(b === hint) - Number(a === hint));
    let listingSnap = null;
    for (const c of collections) {
        const snap = await db.collection(c).doc(listingId).get();
        if (snap.exists) {
            listingSnap = snap;
            break;
        }
    }
    if (!listingSnap) {
        throw new https_1.HttpsError("not-found", "Listing not found");
    }
    const listingRef = listingSnap.ref;
    const contactSnap = await contactRef(listingRef).get();
    const listing = (_b = listingSnap.data()) !== null && _b !== void 0 ? _b : {};
    // Listings not yet migrated still carry their contact fields.
    const contact = ((_c = contactSnap.data()) !== null && _c !== void 0 ? _c : listing);
    if (!contact.lCEmail) {
        throw new https_1.HttpsError("failed-precondition", "Seller has no email");
    }
    if ((0, pay_per_enquiry_js_1.enquiriesLocked)(listing)) {
        await (0, pay_per_enquiry_js_1.saveLockedEnquiry)(listingRef, listing, contact.lCEmail, { enquiryType, message, buyerUid, buyerEmail });
        return { whatsappNumber: null, sellerNotified: true };
    }
    const plate = String((_d = listing.plateCharacters) !== null && _d !== void 0 ? _d : "").toUpperCase();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const enquiryRef = db.collection("seller_enquiries").doc();
    const batch = db.batch();
    batch.set(enquiryRef, {
        plateId: listingId,
        plateCharacters: (_e = listing.plateCharacters) !== null && _e !== void 0 ? _e : "",
        enquiryType,
        message,
        buyerUid,
        buyerEmail,
        sellerLCNumber: (_f = contact.lCNumber) !== null && _f !== void 0 ? _f : "",
        sellerEmail: contact.lCEmail,
        submittedAt: now,
        lastMessageAt: now,
        lastMessageFrom: "buyer",
        lastMessageText: message,
    });
    batch.set(messagesRef(enquiryRef).doc(), { from: "buyer", text: message, sentAt: now });
    await Promise.all([
        batch.commit(),
        /* eslint-disable max-len */
        db.collection("mail").add({
            to: [contact.lCEmail],
            replyTo: buyerEmail,
            message: {
                subject: `New enquiry for your plate ${plate}`,
                html: `
          <h2>You have a new enquiry!</h2>
          <p><strong>Plate:</strong> ${escapeHtml(plate)}</p>
          <p><strong>Listed at:</strong> £${escapeHtml(String((_g = listing.askingPrice) !== null && _g !== void 0 ? _g : ""))}</p>
          <p><strong>Enquiry type:</strong> ${escapeHtml(enquiryType)}</p>
          <p><strong>Message:</strong> ${escapeHtml(message)}</p>
          <p><strong>From:</strong> ${escapeHtml(buyerEmail)}</p>
          <p><strong>Sent:</strong> ${new Date().toLocaleString("en-GB", { timeZone: "Europe/London" })}</p>
          <p><a href="${exports.MESSAGES_URL}">Reply from your messages</a></p>
        `,
            },
        }),
        /* eslint-enable max-len */
        listingRef.update({
            viewsPlaceholder: admin.firestore.FieldValue.increment(1),
        }),
    ]);
    const digits = String((_h = contact.lCNumber) !== null && _h !== void 0 ? _h : "").replace(/\D/g, "");
    return { whatsappNumber: digits || null };
}
exports.MESSAGES_URL = "https://mrvaluations.co.uk/account-dashboard?tab=messages";
/**
 * Add a message to a conversation, from either the seller or the buyer, and
 * email it to the other side. Nobody can write while the seller still has
 * to unlock it.
 * @param {string} uid - The signed-in user.
 * @param {string | undefined} email - Their email from their token.
 * @param {Record<string, unknown>} data - enquiryId and replyMessage.
 * @return {Promise<void>}
 */
async function runReplyToEnquiry(uid, email, data) {
    var _a;
    const enquiryId = text(data.enquiryId, 1, 100, "enquiry");
    const reply = text(data.replyMessage, 1, 2000, "message");
    const db = admin.firestore();
    const enquiryRef = db.collection("seller_enquiries").doc(enquiryId);
    const [enquirySnap, adminSnap] = await Promise.all([
        enquiryRef.get(),
        db.collection("admins").doc(uid).get(),
    ]);
    const enquiry = enquirySnap.data();
    if (!enquiry) {
        throw new https_1.HttpsError("not-found", "Enquiry not found");
    }
    const isBuyer = enquiry.buyerUid === uid;
    // Admins answer for the legacy stock, but not on their own enquiries.
    const isSeller = (!!email && email === enquiry.sellerEmail) ||
        (adminSnap.exists && !isBuyer);
    if (!isBuyer && !isSeller) {
        throw new https_1.HttpsError("permission-denied", "Not your enquiry");
    }
    if (enquiry.locked) {
        throw new https_1.HttpsError("failed-precondition", "Unlock this enquiry first");
    }
    // Someone enquiring about their own plate is the seller here.
    const from = isSeller ? "seller" : "buyer";
    const to = from === "seller" ? enquiry.buyerEmail : enquiry.sellerEmail;
    if (!to) {
        throw new https_1.HttpsError("failed-precondition", "No email to reply to");
    }
    const plate = String((_a = enquiry.plateCharacters) !== null && _a !== void 0 ? _a : "").toUpperCase();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const heading = from === "seller" ?
        "The seller has replied to your enquiry" :
        "The buyer has replied";
    const batch = db.batch();
    batch.set(messagesRef(enquiryRef).doc(), { from, text: reply, sentAt: now });
    batch.update(enquiryRef, {
        lastMessageAt: now,
        lastMessageFrom: from,
        lastMessageText: reply,
    });
    /* eslint-disable max-len */
    batch.set(db.collection("mail").doc(), {
        to: [to],
        message: {
            subject: `Re: Your enquiry about ${plate}`,
            html: `
        <h2>${heading}</h2>
        <p><strong>Plate:</strong> ${escapeHtml(plate)}</p>
        <p><strong>Message:</strong> ${escapeHtml(reply)}</p>
        <p><a href="${exports.MESSAGES_URL}">See the conversation and reply</a></p>
      `,
        },
    });
    /* eslint-enable max-len */
    await batch.commit();
}
//# sourceMappingURL=enquiries.js.map