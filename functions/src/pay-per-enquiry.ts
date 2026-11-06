import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {consumeRateLimits, rateLimitId} from "./valuation-email.js";
import {
  contactRef, escapeHtml, messagesRef, MESSAGES_URL,
} from "./enquiries.js";
import {LISTING_FEE_GBP} from "./constants.js";

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

export interface ListingInput {
  plateCharacters: string;
  askingPrice: string;
  meanings: string;
  negotiable: boolean;
  sellerUid: string;
  initials: string;
  email: string;
  phone: string;
}

/**
 * Fields of a new plate-listings-new document, shared by paid and free
 * listings so the two can't drift apart.
 * @param {ListingInput} input - The seller's listing details.
 * @return {Record<string, unknown>} The public listing fields.
 */
export function listingFields(input: ListingInput): Record<string, unknown> {
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
export function contactFields(input: ListingInput): Record<string, string> {
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
export function enquiriesLocked(listing: Record<string, unknown>): boolean {
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
export function enquiryPreview(message: string): string {
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
function text(value: unknown, min: number, max: number, name: string): string {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max) {
    throw new HttpsError("invalid-argument", `Invalid ${name}`);
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
export async function runCreateFreeListing(
  uid: string,
  email: string,
  data: Record<string, unknown>,
  ip: string
): Promise<{listingId: string, plateCharacters: string}> {
  const plateCharacters =
    text(data.plateCharacters, 2, 8, "plate").toUpperCase();
  if (!/^[A-Z0-9 ]+$/.test(plateCharacters)) {
    throw new HttpsError("invalid-argument", "Invalid plate");
  }
  const price = Number(data.askingPrice);
  if (!Number.isFinite(price) || price < 1) {
    throw new HttpsError("invalid-argument", "Invalid asking price");
  }
  const phone = text(data.phone, 7, 20, "phone");
  const meanings = String(data.meanings ?? "").trim().slice(0, 200);
  const initials = String(data.initials ?? "").trim().slice(0, 3)
    .toUpperCase() || email.substring(0, 2).toUpperCase();

  await consumeRateLimits(
    [{id: rateLimitId("free-listing-ip", ip || "unknown"), max: 10}]);

  const db = admin.firestore();
  const mine = db.collection("plate-listings-new")
    .where("sellerUid", "==", uid)
    .where("isSold", "==", false);
  const [freeCount, samePlate] = await Promise.all([
    mine.where("pricingModel", "==", "enquiry").count().get(),
    mine.where("plateCharacters", "==", plateCharacters).limit(1).get(),
  ]);
  if (!samePlate.empty) {
    throw new HttpsError(
      "already-exists", `You've already listed ${plateCharacters}`);
  }
  if (freeCount.data().count >= FREE_LISTING_LIMIT) {
    throw new HttpsError(
      "resource-exhausted",
      `You can list up to ${FREE_LISTING_LIMIT} plates for free`);
  }

  const input: ListingInput = {
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
  batch.set(listingRef, {
    ...listingFields(input),
    pricingModel: "enquiry",
    enquiriesUnlocked: false,
  });
  batch.set(contactRef(listingRef), contactFields(input));
  batch.set(db.collection("mail").doc(), {
    to: [email],
    message: {
      subject: `Your plate ${plateCharacters} is listed`,
      html: listedEmailHtml(plateCharacters, input.askingPrice),
    },
  });
  await batch.commit();
  return {listingId: listingRef.id, plateCharacters};
}

/**
 * @param {string} plate - The plate, upper case.
 * @param {string} price - The asking price in pounds.
 * @return {string} Confirmation email HTML for a free listing.
 */
function listedEmailHtml(plate: string, price: string): string {
  const link =
    `https://mrvaluations.co.uk/plates-for-sale/${plate.replace(/\s/g, "")}`;
  /* eslint-disable max-len */
  return `
    <h2>${escapeHtml(plate)} is now for sale</h2>
    <p>Your plate is listed at <strong>£${escapeHtml(price)}</strong>: <a href="${link}">see your listing</a>.</p>
    <p>Listing is free. When the first buyer messages you, we'll email you, and you pay £${LISTING_FEE_GBP} once to read and reply. Every enquiry after that is free.</p>
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
export async function saveLockedEnquiry(
  listingRef: admin.firestore.DocumentReference,
  listing: Record<string, unknown>,
  sellerEmail: string,
  enquiry: {
    enquiryType: string,
    message: string,
    buyerUid: string,
    buyerEmail: string,
  }
): Promise<void> {
  const db = admin.firestore();
  const plate = String(listing.plateCharacters ?? "").toUpperCase();
  const preview = enquiryPreview(enquiry.message);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const enquiryRef = db.collection("seller_enquiries").doc();
  const batch = db.batch();
  // buyerUid stays visible so the buyer can see their conversation; it
  // isn't contact information.
  batch.set(enquiryRef, {
    plateId: listingRef.id,
    plateCharacters: listing.plateCharacters ?? "",
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
  batch.set(messagesRef(enquiryRef).doc(),
    {from: "buyer", text: enquiry.message, sentAt: now});
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
        <h2>You have a new enquiry for ${escapeHtml(plate)}</h2>
        <p><strong>Enquiry type:</strong> ${escapeHtml(enquiry.enquiryType)}</p>
        <p><strong>Message:</strong> “${escapeHtml(preview)}”</p>
        <p>Pay £${LISTING_FEE_GBP} once to read the full message and reply. Every enquiry after this one is free.</p>
        <p><a href="${MESSAGES_URL}">Unlock this enquiry</a></p>
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
export async function runCreateUnlockSession(
  stripe: import("stripe").Stripe,
  uid: string,
  email: string,
  data: Record<string, unknown>,
  resolveVoucher: (code: string) => Promise<string | null>
): Promise<{url: string | null}> {
  const listingId = text(data.listingId, 1, 100, "listing");
  const appBaseUrl = text(data.appBaseUrl, 1, 200, "app URL");
  const snap = await admin.firestore()
    .collection("plate-listings-new").doc(listingId).get();
  const listing = snap.data();
  if (!listing || listing.sellerUid !== uid) {
    throw new HttpsError("not-found", "Listing not found");
  }
  if (!enquiriesLocked(listing)) {
    throw new HttpsError("failed-precondition", "Already unlocked");
  }

  const voucherCode = String(data.voucherCode ?? "").trim().toUpperCase();
  const promotionCodeId =
    voucherCode ? await resolveVoucher(voucherCode) : null;
  const plate = String(listing.plateCharacters).toUpperCase();
  const back = `${appBaseUrl}/account-dashboard?tab=messages`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [{
      price_data: {
        currency: "gbp",
        unit_amount: LISTING_FEE_GBP * 100,
        product_data: {
          name: `Unlock enquiries: ${plate}`,
          description:
            "One-off — read and reply to every enquiry on this plate",
        },
      },
      quantity: 1,
    }],
    success_url: `${back}&unlocked=${encodeURIComponent(plate)}` +
      "&session_id={CHECKOUT_SESSION_ID}",
    cancel_url: back,
    ...(promotionCodeId ?
      {discounts: [{promotion_code: promotionCodeId}]} :
      {allow_promotion_codes: true}),
    metadata: {
      purpose: "unlock",
      listingId,
      sellerUid: uid,
      voucherCode: promotionCodeId ? voucherCode : "",
    },
  });
  return {url: session.url};
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
export async function runUnlockEnquiries(
  listingId: string,
  sessionId: string,
  discountPence: number,
  voucherCode: string
): Promise<void> {
  const db = admin.firestore();
  const listingRef = db.collection("plate-listings-new").doc(listingId);
  const listingSnap = await listingRef.get();
  const listing = listingSnap.data();
  if (!listing) {
    console.error(`unlock: listing ${listingId} not found (${sessionId})`);
    return;
  }
  if (listing.unlockSessionId === sessionId) return;

  const locked = await db.collection("seller_enquiries")
    .where("plateId", "==", listingId)
    .where("locked", "==", true)
    .get();
  const privates = await Promise.all(locked.docs.map((d) =>
    d.ref.collection("private").doc("buyer").get()));

  const plate = String(listing.plateCharacters ?? "").toUpperCase();
  const batch = db.batch();
  batch.update(listingRef, {
    enquiriesUnlocked: true,
    unlockedAt: admin.firestore.FieldValue.serverTimestamp(),
    unlockSessionId: sessionId,
    voucherCode: voucherCode || null,
    discountAppliedPence: discountPence || null,
  });
  locked.docs.forEach((doc, i) => {
    const buyer = privates[i].data() ?? {};
    const enquiry = doc.data();
    batch.update(doc.ref, {
      locked: false,
      message: buyer.message ?? "",
      buyerUid: buyer.buyerUid ?? null,
      buyerEmail: buyer.buyerEmail ?? null,
      lastMessageText: enquiry.lastMessageText ?? buyer.message ?? "",
    });
    /* eslint-disable max-len */
    batch.set(db.collection("mail").doc(), {
      to: [enquiry.sellerEmail],
      ...(buyer.buyerEmail ? {replyTo: buyer.buyerEmail} : {}),
      message: {
        subject: `Enquiry for your plate ${plate}`,
        html: `
          <h2>Your enquiry is unlocked</h2>
          <p><strong>Plate:</strong> ${escapeHtml(plate)}</p>
          <p><strong>Enquiry type:</strong> ${escapeHtml(String(enquiry.enquiryType ?? ""))}</p>
          <p><strong>Message:</strong> ${escapeHtml(String(buyer.message ?? ""))}</p>
          <p><strong>From:</strong> ${escapeHtml(String(buyer.buyerEmail ?? ""))}</p>
          <p>Reply to this email, or from <a href="${MESSAGES_URL}">your messages</a>.</p>
        `,
      },
    });
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
export async function runUnlockReminders(): Promise<void> {
  const db = admin.firestore();
  const locked = await db.collection("seller_enquiries")
    .where("locked", "==", true)
    .get();

  const byListing = new Map<string, admin.firestore.DocumentData[]>();
  locked.docs.forEach((doc) => {
    const enquiry = doc.data();
    const id = String(enquiry.plateId ?? "");
    if (id) byListing.set(id, [...(byListing.get(id) ?? []), enquiry]);
  });

  const now = Date.now();
  let sent = 0;
  for (const [listingId, enquiries] of byListing) {
    const listingRef = db.collection("plate-listings-new").doc(listingId);
    const listing = (await listingRef.get()).data();
    if (!listing || listing.isSold || !enquiriesLocked(listing)) continue;

    const remindersSent = Number(listing.unlockRemindersSent ?? 0);
    const dueAfter = UNLOCK_REMINDER_HOURS[remindersSent];
    if (dueAfter === undefined) continue;
    const firstAt = Math.min(...enquiries.map((e) =>
      e.submittedAt?.toMillis?.() ?? now));
    if (now - firstAt < dueAfter * 3_600_000) continue;

    const plate = String(listing.plateCharacters ?? "").toUpperCase();
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
    batch.update(listingRef, {unlockRemindersSent: remindersSent + 1});
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
function unlockReminderHtml(
  plate: string,
  enquiries: admin.firestore.DocumentData[],
  last: boolean
): string {
  const previews = enquiries.map((e) =>
    `<li><strong>${escapeHtml(String(e.enquiryType ?? ""))}:</strong> ` +
    `“${escapeHtml(String(e.preview ?? ""))}”</li>`).join("");
  const waiting = enquiries.length > 1 ?
    `${enquiries.length} buyers have messaged you` :
    "A buyer has messaged you";
  /* eslint-disable max-len */
  return `
    <h2>${waiting} about ${escapeHtml(plate)}</h2>
    <ul>${previews}</ul>
    <p>They haven't had a reply yet. Pay £${LISTING_FEE_GBP} once to read the full ${enquiries.length > 1 ? "messages" : "message"} and reply — every enquiry on this plate after that is free.</p>
    <p><a href="${MESSAGES_URL}">Unlock and reply</a></p>
    ${last ? "<p>This is the last reminder we'll send about these enquiries.</p>" : ""}
  `;
  /* eslint-enable max-len */
}
