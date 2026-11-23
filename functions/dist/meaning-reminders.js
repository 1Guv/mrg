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
exports.runMeaningReminders = runMeaningReminders;
const admin = __importStar(require("firebase-admin"));
const enquiries_js_1 = require("./enquiries.js");
const sign_in_links_js_1 = require("./sign-in-links.js");
const bounces_js_1 = require("./bounces.js");
/**
 * Asks sellers to add a meaning to listings that have none. A plate often
 * can't be read at a glance, and buyers enquire less when they can't tell
 * what it spells. Each listing gets one email, a day after it's listed, with
 * a link that signs the seller in to My Listings, where they can add it.
 */
const DAY = 24 * 60 * 60 * 1000;
const LISTINGS_URL = "https://mrvaluations.co.uk/account-dashboard?tab=listings";
/**
 * @param {Record<string, unknown>} listing - A listing.
 * @return {number} When it was listed, in milliseconds; 0 if unknown.
 */
function listedAt(listing) {
    var _a, _b;
    const ts = listing.createdAt;
    return (_b = (_a = ts === null || ts === void 0 ? void 0 : ts.toMillis) === null || _a === void 0 ? void 0 : _a.call(ts)) !== null && _b !== void 0 ? _b : (Date.parse(String(listing.createdDate)) || 0);
}
/**
 * Email the seller of each live listing, listed over a day ago, that has no
 * meaning and hasn't been asked before.
 * @return {Promise<number>} How many sellers were emailed.
 */
async function runMeaningReminders() {
    var _a, _b, _c;
    const db = admin.firestore();
    const live = await db.collection("plate-listings-new")
        .where("isSold", "==", false).get();
    // One email per seller, however many of their listings need a meaning.
    const bySeller = new Map();
    for (const doc of live.docs) {
        const listing = doc.data();
        if (String((_a = listing.meanings) !== null && _a !== void 0 ? _a : "").trim())
            continue;
        if (listing.meaningReminderSentAt)
            continue;
        const at = listedAt(listing);
        if (!at || Date.now() - at < DAY)
            continue;
        const contact = (await (0, enquiries_js_1.contactRef)(doc.ref).get()).data();
        const email = String((_b = contact === null || contact === void 0 ? void 0 : contact.lCEmail) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
        if (!email || email === bounces_js_1.ADMIN_INBOX_EMAIL)
            continue;
        bySeller.set(email, [...((_c = bySeller.get(email)) !== null && _c !== void 0 ? _c : []), doc]);
    }
    for (const [email, docs] of bySeller) {
        const plates = docs.map((d) => { var _a; return String((_a = d.data().plateCharacters) !== null && _a !== void 0 ? _a : "").toUpperCase(); });
        const names = plates.length === 1 ? plates[0] :
            `${plates.slice(0, -1).join(", ")} and ${plates[plates.length - 1]}`;
        const link = await (0, sign_in_links_js_1.createSignInLink)(email, LISTINGS_URL, sign_in_links_js_1.VALUATION_LINK_TTL);
        /* eslint-disable max-len */
        await db.collection("mail").add({
            to: [email],
            message: {
                subject: `What does ${names} mean? Buyers will want to know`,
                html: `
          <h2>Add a meaning to ${(0, enquiries_js_1.escapeHtml)(names)}</h2>
          <p>A plate isn't always easy to read at a glance, and buyers enquire more when they can see what it spells, like a name, a word or initials.</p>
          <p>It takes a few seconds:</p>
          <p><a href="${link}">Add ${plates.length === 1 ? "a meaning" : "meanings"} to your listings</a></p>
          <p style="color:#6b7280;font-size:13px">This link signs you in to your listings, so there's no password to remember. It works for 7 days.</p>
        `,
            },
        });
        /* eslint-enable max-len */
        const now = admin.firestore.FieldValue.serverTimestamp();
        await Promise.all(docs.map((d) => d.ref.update({ meaningReminderSentAt: now })));
    }
    console.log(`meaning reminders: emailed ${bySeller.size} sellers`);
    return bySeller.size;
}
//# sourceMappingURL=meaning-reminders.js.map