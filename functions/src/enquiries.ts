import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {enquiriesLocked, saveLockedEnquiry} from "./pay-per-enquiry.js";

/**
 * Buyer enquiries and the conversations that follow. Seller contact details
 * live in a private subdocument, <listing>/private/contact, which clients
 * can't read, so the emails are sent from here rather than from the browser.
 *
 * Each enquiry is a conversation: seller_enquiries/<id> holds who it's
 * between and the latest message, and seller_enquiries/<id>/messages holds
 * every message from either side. Each new message is also emailed.
 */

export const LISTING_COLLECTIONS = ["plate-listings-new", "plate-listings"];
export const CONTACT_FIELDS = [
  "lCEmail",
  "lCNumber",
  "lCName",
  "plateListingAccName",
  "plateListingAccTelNumber",
];

export interface SellerContact {
  lCEmail?: string;
  lCNumber?: string;
  lCName?: string;
  plateListingAccName?: string;
  plateListingAccTelNumber?: string;
}

/**
 * @param {admin.firestore.DocumentReference} listingRef - The listing.
 * @return {admin.firestore.DocumentReference} Its private contact document.
 */
export function contactRef(
  listingRef: admin.firestore.DocumentReference
): admin.firestore.DocumentReference {
  return listingRef.collection("private").doc("contact");
}

/**
 * @param {admin.firestore.DocumentReference} enquiryRef - A conversation.
 * @return {admin.firestore.CollectionReference} Its messages.
 */
export function messagesRef(
  enquiryRef: admin.firestore.DocumentReference
): admin.firestore.CollectionReference {
  return enquiryRef.collection("messages");
}

/**
 * @param {string} text - Text typed by a user.
 * @return {string} The text, safe to put in an email's HTML.
 */
export function escapeHtml(text: string): string {
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
function text(value: unknown, min: number, max: number, name: string): string {
  const s = String(value ?? "").trim();
  if (s.length < min || s.length > max) {
    throw new HttpsError("invalid-argument", `Invalid ${name}`);
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
export async function runSendEnquiry(
  buyerUid: string,
  buyerEmail: string,
  data: Record<string, unknown>
): Promise<{whatsappNumber: string | null, sellerNotified?: boolean}> {
  const listingId = text(data.listingId, 1, 100, "listing");
  const enquiryType = text(data.enquiryType, 1, 100, "enquiry type");
  const message = text(data.message, 10, 2000, "message");

  const db = admin.firestore();
  // Try the collection the client named first, then the other one.
  const hint = String(data.collection ?? "");
  const collections = [...LISTING_COLLECTIONS]
    .sort((a, b) => Number(b === hint) - Number(a === hint));
  let listingSnap: admin.firestore.DocumentSnapshot | null = null;
  for (const c of collections) {
    const snap = await db.collection(c).doc(listingId).get();
    if (snap.exists) {
      listingSnap = snap;
      break;
    }
  }
  if (!listingSnap) {
    throw new HttpsError("not-found", "Listing not found");
  }
  const listingRef = listingSnap.ref;
  const contactSnap = await contactRef(listingRef).get();
  const listing = listingSnap.data() ?? {};
  // Listings not yet migrated still carry their contact fields.
  const contact = (contactSnap.data() ?? listing) as SellerContact;
  if (!contact.lCEmail) {
    throw new HttpsError("failed-precondition", "Seller has no email");
  }

  if (enquiriesLocked(listing)) {
    await saveLockedEnquiry(listingRef, listing, contact.lCEmail,
      {enquiryType, message, buyerUid, buyerEmail});
    return {whatsappNumber: null, sellerNotified: true};
  }

  const plate = String(listing.plateCharacters ?? "").toUpperCase();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const enquiryRef = db.collection("seller_enquiries").doc();
  const batch = db.batch();
  batch.set(enquiryRef, {
    plateId: listingId,
    plateCharacters: listing.plateCharacters ?? "",
    enquiryType,
    message,
    buyerUid,
    buyerEmail,
    sellerLCNumber: contact.lCNumber ?? "",
    sellerEmail: contact.lCEmail,
    submittedAt: now,
    lastMessageAt: now,
    lastMessageFrom: "buyer",
    lastMessageText: message,
  });
  batch.set(messagesRef(enquiryRef).doc(),
    {from: "buyer", text: message, sentAt: now});
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
          <p><strong>Listed at:</strong> £${escapeHtml(String(listing.askingPrice ?? ""))}</p>
          <p><strong>Enquiry type:</strong> ${escapeHtml(enquiryType)}</p>
          <p><strong>Message:</strong> ${escapeHtml(message)}</p>
          <p><strong>From:</strong> ${escapeHtml(buyerEmail)}</p>
          <p><strong>Sent:</strong> ${new Date().toLocaleString("en-GB", {timeZone: "Europe/London"})}</p>
          <p><a href="${MESSAGES_URL}">Reply from your messages</a></p>
        `,
      },
    }),
    /* eslint-enable max-len */
    listingRef.update({
      viewsPlaceholder: admin.firestore.FieldValue.increment(1),
    }),
  ]);

  const digits = String(contact.lCNumber ?? "").replace(/\D/g, "");
  return {whatsappNumber: digits || null};
}

export const MESSAGES_URL =
  "https://mrvaluations.co.uk/account-dashboard?tab=messages";

/**
 * Add a message to a conversation, from either the seller or the buyer, and
 * email it to the other side. Nobody can write while the seller still has
 * to unlock it.
 * @param {string} uid - The signed-in user.
 * @param {string | undefined} email - Their email from their token.
 * @param {Record<string, unknown>} data - enquiryId and replyMessage.
 * @return {Promise<void>}
 */
export async function runReplyToEnquiry(
  uid: string,
  email: string | undefined,
  data: Record<string, unknown>
): Promise<void> {
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
    throw new HttpsError("not-found", "Enquiry not found");
  }
  const isBuyer = enquiry.buyerUid === uid;
  // Admins answer for the legacy stock, but not on their own enquiries.
  const isSeller = (!!email && email === enquiry.sellerEmail) ||
    (adminSnap.exists && !isBuyer);
  if (!isBuyer && !isSeller) {
    throw new HttpsError("permission-denied", "Not your enquiry");
  }
  if (enquiry.locked) {
    throw new HttpsError("failed-precondition", "Unlock this enquiry first");
  }
  // Someone enquiring about their own plate is the seller here.
  const from = isSeller ? "seller" : "buyer";
  const to = from === "seller" ? enquiry.buyerEmail : enquiry.sellerEmail;
  if (!to) {
    throw new HttpsError("failed-precondition", "No email to reply to");
  }

  const plate = String(enquiry.plateCharacters ?? "").toUpperCase();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const heading = from === "seller" ?
    "The seller has replied to your enquiry" :
    "The buyer has replied";
  const batch = db.batch();
  batch.set(messagesRef(enquiryRef).doc(), {from, text: reply, sentAt: now});
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
        <p><a href="${MESSAGES_URL}">See the conversation and reply</a></p>
      `,
    },
  });
  /* eslint-enable max-len */
  await batch.commit();
}
