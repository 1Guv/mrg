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
exports.runCreatePendingListing = runCreatePendingListing;
exports.runResendPendingListing = runResendPendingListing;
exports.runConfirmPendingListing = runConfirmPendingListing;
exports.runCancelPendingListing = runCancelPendingListing;
exports.runPendingListingReminders = runPendingListingReminders;
exports.saveLockedEnquiry = saveLockedEnquiry;
exports.runCreateUnlockSession = runCreateUnlockSession;
exports.runUnlockEnquiries = runUnlockEnquiries;
exports.runUnlockReminders = runUnlockReminders;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const valuation_email_js_1 = require("./valuation-email.js");
const nudge_emails_js_1 = require("./nudge-emails.js");
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
 * Check and normalise the form's listing fields.
 * @param {Record<string, unknown>} data - plateCharacters, askingPrice,
 *   phone (optional), initials (optional), meanings and negotiable.
 * @param {string} email - The seller's email, for default initials.
 * @return {ListingRequest} The cleaned fields.
 */
function parseListingRequest(data, email) {
    var _a, _b, _c;
    const plateCharacters = text(data.plateCharacters, 2, 8, "plate").toUpperCase();
    if (!/^[A-Z0-9 ]+$/.test(plateCharacters)) {
        throw new https_1.HttpsError("invalid-argument", "A plate can only use letters, numbers and spaces");
    }
    const price = Number(data.askingPrice);
    if (!Number.isFinite(price) || price < 1) {
        throw new https_1.HttpsError("invalid-argument", "Enter an asking price in pounds");
    }
    // Optional: without one, buyers message through the site only.
    const phone = String((_a = data.phone) !== null && _a !== void 0 ? _a : "").trim();
    if (phone && !/^\+?[\d\s()-]{7,20}$/.test(phone)) {
        throw new https_1.HttpsError("invalid-argument", "That phone number doesn't look right");
    }
    return {
        plateCharacters,
        askingPrice: String(Math.round(price)),
        phone,
        meanings: String((_b = data.meanings) !== null && _b !== void 0 ? _b : "").trim().slice(0, 200),
        initials: String((_c = data.initials) !== null && _c !== void 0 ? _c : "").trim().slice(0, 3)
            .toUpperCase() || email.substring(0, 2).toUpperCase(),
        negotiable: data.negotiable === true,
    };
}
/**
 * List a plate for free. Contact goes to the signed-in account's email so
 * the seller can read enquiries in their dashboard.
 * @param {string} uid - The signed-in seller.
 * @param {string} email - The seller's email from their auth token.
 * @param {Record<string, unknown>} data - The form's listing fields.
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<object>} The new listing's id and plate.
 */
async function runCreateFreeListing(uid, email, data, ip) {
    const request = parseListingRequest(data, email);
    await (0, valuation_email_js_1.consumeRateLimits)([{ id: (0, valuation_email_js_1.rateLimitId)("free-listing-ip", ip || "unknown"), max: 10 }]);
    return publishFreeListing(uid, email, request);
}
/**
 * Publish a validated listing for a seller, after the duplicate and
 * free-listing limit checks.
 * @param {string} uid - The seller.
 * @param {string} email - The seller's email.
 * @param {ListingRequest} request - The listing.
 * @return {Promise<object>} The new listing's id and plate.
 */
async function publishFreeListing(uid, email, request) {
    const { plateCharacters } = request;
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
    const input = Object.assign(Object.assign({}, request), { sellerUid: uid, email });
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
// ── Listing without signing in ──────────────────────────────────────────────
// Visitors who aren't signed in list with just their email. The listing
// waits in pending_listings (no client access) until they click the link we
// email them. The link carries a secret key that only that inbox has, so
// nobody can list a plate under someone else's email address. The key never
// expires: every email for a listing, reminders included, has the same link,
// and it keeps working after the listing is published.
/** Days between reminders after the first, which is sent after a day. */
const PENDING_REMINDER_EVERY_DAYS = 7;
/** The first reminder plus four weekly ones, then we stop. */
const PENDING_REMINDER_LIMIT = 5;
/**
 * @param {string} email - The seller's email.
 * @param {string} plate - The plate.
 * @return {string} One pending listing per email and plate, so sending the
 *   form again replaces it rather than adding another.
 */
function pendingListingId(email, plate) {
    return (0, crypto_1.createHash)("sha256").update(`${email}|${plate}`).digest("hex")
        .slice(0, 32);
}
/**
 * @param {admin.firestore.DocumentData} pending - The pending listing.
 * @param {string} pendingId - Its id.
 * @param {string} action - "cancel" for the link that stops it instead.
 * @return {string} The emailed link that publishes (or cancels) it.
 */
function pendingListingUrl(pending, pendingId, action) {
    return `${pending.appBaseUrl}/list-plate?pending=${pendingId}` +
        `&key=${pending.key}${action ? `&action=${action}` : ""}`;
}
/**
 * Save a listing from a visitor who isn't signed in, and email them the
 * link that publishes it.
 * @param {Record<string, unknown>} data - email, appBaseUrl and the form's
 *   listing fields.
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<object>} The pending listing's id and plate.
 */
async function runCreatePendingListing(data, ip) {
    var _a, _b, _c, _d;
    const email = String((_a = data.email) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    if (email.length > 254 || !valuation_email_js_1.EMAIL_RE.test(email)) {
        throw new https_1.HttpsError("invalid-argument", "Enter a valid email address");
    }
    const request = parseListingRequest(data, email);
    const appBaseUrl = String((_b = data.appBaseUrl) !== null && _b !== void 0 ? _b : "");
    await (0, valuation_email_js_1.consumeRateLimits)([
        { id: (0, valuation_email_js_1.rateLimitId)("pending-listing-ip", ip || "unknown"), max: 10 },
        { id: (0, valuation_email_js_1.rateLimitId)("pending-listing-email", email), max: 5 },
    ]);
    const pendingId = pendingListingId(email, request.plateCharacters);
    const ref = admin.firestore().collection("pending_listings").doc(pendingId);
    // Sending the form again keeps the key, so earlier emails still work.
    const key = (_d = (_c = (await ref.get()).data()) === null || _c === void 0 ? void 0 : _c.key) !== null && _d !== void 0 ? _d : (0, crypto_1.randomBytes)(24).toString("hex");
    await ref.set(Object.assign(Object.assign({}, request), { email,
        key, status: "pending", remindersSent: 0, appBaseUrl: valuation_email_js_1.ALLOWED_APP_BASE_URLS.includes(appBaseUrl) ?
            appBaseUrl : nudge_emails_js_1.APP_URL, createdAt: admin.firestore.FieldValue.serverTimestamp() }));
    await emailPendingListingLink(pendingId);
    return { pendingId, plateCharacters: request.plateCharacters };
}
/**
 * Email the link for a pending listing again, e.g. when the first email
 * went to spam. The address comes from the saved listing, never the request.
 * @param {Record<string, unknown>} data - pendingId.
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<void>}
 */
async function runResendPendingListing(data, ip) {
    const pendingId = text(data.pendingId, 1, 64, "listing");
    await (0, valuation_email_js_1.consumeRateLimits)([
        { id: (0, valuation_email_js_1.rateLimitId)("pending-resend-ip", ip || "unknown"), max: 10 },
        { id: (0, valuation_email_js_1.rateLimitId)("pending-resend", pendingId), max: 3 },
    ]);
    await emailPendingListingLink(pendingId);
}
/**
 * @param {string} pendingId - The pending listing.
 * @return {Promise<void>}
 */
async function emailPendingListingLink(pendingId) {
    const snap = await admin.firestore()
        .collection("pending_listings").doc(pendingId).get();
    const pending = snap.data();
    if (!pending)
        throw new https_1.HttpsError("not-found", "Listing not found");
    const plate = String(pending.plateCharacters);
    await admin.firestore().collection("mail").add({
        to: [pending.email],
        message: {
            subject: `Confirm your listing for ${plate}`,
            html: confirmListingEmailHtml(plate, pending.askingPrice, pendingListingUrl(pending, pendingId)),
        },
    });
}
/**
 * Read a pending listing from its emailed link, checking the link's key.
 * @param {Record<string, unknown>} data - pendingId and key.
 * @return {Promise<object>} The pending listing and its ref.
 */
async function pendingFromLink(data) {
    var _a, _b;
    const pendingId = text(data.pendingId, 1, 64, "listing");
    const key = String((_a = data.key) !== null && _a !== void 0 ? _a : "");
    const ref = admin.firestore().collection("pending_listings").doc(pendingId);
    const pending = (await ref.get()).data();
    const expected = Buffer.from(String((_b = pending === null || pending === void 0 ? void 0 : pending.key) !== null && _b !== void 0 ? _b : ""));
    const given = Buffer.from(key);
    if (!pending || !expected.length || expected.length !== given.length ||
        !(0, crypto_1.timingSafeEqual)(expected, given)) {
        throw new https_1.HttpsError("not-found", "We couldn't find this listing. Please list it again.");
    }
    return { ref, pending };
}
/**
 * Publish a pending listing from its emailed link, and sign the seller in:
 * opening the link proves they own the email, so their account is created
 * if they don't have one. Opening it again after it's published returns the
 * same listing.
 * @param {Record<string, unknown>} data - pendingId and key.
 * @return {Promise<object>} The listing's id and plate, and a custom token
 *   that signs the seller in.
 */
async function runConfirmPendingListing(data) {
    var _a;
    const { ref, pending } = await pendingFromLink(data);
    const email = String(pending.email);
    const uid = await uidForEmail(email);
    let listingId = String((_a = pending.listingId) !== null && _a !== void 0 ? _a : "");
    if (pending.status !== "listed") {
        const request = {
            plateCharacters: pending.plateCharacters,
            askingPrice: pending.askingPrice,
            phone: pending.phone,
            meanings: pending.meanings,
            initials: pending.initials,
            negotiable: pending.negotiable === true,
        };
        try {
            listingId = (await publishFreeListing(uid, email, request)).listingId;
        }
        catch (err) {
            // Already listed from another tab or device: that's the listing.
            if (err.code !== "already-exists")
                throw err;
        }
        await ref.update({
            status: "listed",
            listingId,
            listedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    const listing = { listingId, plateCharacters: pending.plateCharacters };
    try {
        return Object.assign(Object.assign({}, listing), { customToken: await admin.auth().createCustomToken(uid) });
    }
    catch (err) {
        // Listed all the same; they can log in to manage it.
        console.error("confirm-pending: custom token failed", err);
        return listing;
    }
}
/**
 * Stop a pending listing, and its reminders, from its emailed link.
 * @param {Record<string, unknown>} data - pendingId and key.
 * @return {Promise<object>} The plate.
 */
async function runCancelPendingListing(data) {
    const { ref, pending } = await pendingFromLink(data);
    if (pending.status === "pending")
        await ref.update({ status: "cancelled" });
    return { plateCharacters: pending.plateCharacters };
}
/**
 * @param {string} email - A verified email.
 * @return {Promise<string>} The uid of that email's account, created if
 *   there isn't one.
 */
async function uidForEmail(email) {
    try {
        const user = await admin.auth().getUserByEmail(email);
        if (!user.emailVerified) {
            await admin.auth().updateUser(user.uid, { emailVerified: true });
        }
        return user.uid;
    }
    catch (err) {
        if (err.code !== "auth/user-not-found")
            throw err;
        return (await admin.auth().createUser({ email, emailVerified: true })).uid;
    }
}
/**
 * Remind visitors who listed signed out but never opened the link: a day
 * after they listed, then weekly, up to PENDING_REMINDER_LIMIT emails.
 * @return {Promise<void>}
 */
async function runPendingListingReminders() {
    var _a, _b, _c, _d, _e;
    const db = admin.firestore();
    const pending = await db.collection("pending_listings")
        .where("status", "==", "pending")
        .get();
    const now = Date.now();
    let sent = 0;
    for (const doc of pending.docs) {
        const listing = doc.data();
        const remindersSent = Number((_a = listing.remindersSent) !== null && _a !== void 0 ? _a : 0);
        if (remindersSent >= PENDING_REMINDER_LIMIT)
            continue;
        const since = remindersSent === 0 ?
            (_c = (_b = listing.createdAt) === null || _b === void 0 ? void 0 : _b.toMillis) === null || _c === void 0 ? void 0 : _c.call(_b) : (_e = (_d = listing.lastRemindedAt) === null || _d === void 0 ? void 0 : _d.toMillis) === null || _e === void 0 ? void 0 : _e.call(_d);
        const waitDays = remindersSent === 0 ? 1 : PENDING_REMINDER_EVERY_DAYS;
        // The daily run drifts a little; an hour's slack keeps it on the day.
        if (!since || now - since < waitDays * 86400000 - 3600000)
            continue;
        const plate = String(listing.plateCharacters);
        const batch = db.batch();
        batch.set(db.collection("mail").doc(), {
            to: [listing.email],
            message: {
                subject: `Your ${plate} listing is waiting to go live`,
                html: pendingReminderHtml(plate, listing.askingPrice, pendingListingUrl(listing, doc.id), pendingListingUrl(listing, doc.id, "cancel"), remindersSent + 1 === PENDING_REMINDER_LIMIT),
            },
        });
        batch.update(doc.ref, {
            remindersSent: remindersSent + 1,
            lastRemindedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        sent++;
    }
    console.log(`pending listing reminders: sent ${sent}`);
}
/**
 * @param {string} plate - The plate, upper case.
 * @param {string} price - The asking price in pounds.
 * @param {string} link - The link that publishes it.
 * @return {string} Email HTML asking the seller to confirm their listing.
 */
function confirmListingEmailHtml(plate, price, link) {
    /* eslint-disable max-len */
    return `
    <h2>One tap to put ${(0, enquiries_js_1.escapeHtml)(plate)} up for sale</h2>
    <p>Your listing at <strong>£${Number(price).toLocaleString("en-GB")}</strong> is ready. Tap below to publish it:</p>
    <p><a href="${link}" style="display:inline-block;background:#2e7d32;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Publish my listing</a></p>
    <p>Listing is free. You pay £${constants_js_1.LISTING_FEE_GBP} once, only when your first buyer messages you, and every enquiry after that is free.</p>
    <p style="color:#888;font-size:12px">The button also signs you in so you can manage your listing. Didn't list a plate? Ignore this email and nothing will be published.</p>
  `;
    /* eslint-enable max-len */
}
/**
 * @param {string} plate - The plate, upper case.
 * @param {string} price - The asking price in pounds.
 * @param {string} link - The link that publishes it.
 * @param {string} cancelLink - The link that stops it and its reminders.
 * @param {boolean} last - Whether this is the final reminder.
 * @return {string} Reminder email HTML for an unpublished listing.
 */
function pendingReminderHtml(plate, price, link, cancelLink, last) {
    /* eslint-disable max-len */
    return `
    <h2>${(0, enquiries_js_1.escapeHtml)(plate)} isn't for sale yet</h2>
    <p>You started listing it at <strong>£${Number(price).toLocaleString("en-GB")}</strong>, but it hasn't been published, so buyers can't see it. One tap and it's live:</p>
    <p><a href="${link}" style="display:inline-block;background:#2e7d32;color:#fff;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600">Publish my listing</a></p>
    <p>Listing is free. You pay £${constants_js_1.LISTING_FEE_GBP} once, only when your first buyer messages you, and every enquiry after that is free.</p>
    ${last ? "<p>This is the last reminder we'll send about this listing.</p>" : ""}
    <p style="color:#888;font-size:12px">Changed your mind? <a href="${cancelLink}" style="color:#888">Remove this listing</a> and we'll stop reminding you.</p>
  `;
    /* eslint-enable max-len */
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