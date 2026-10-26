import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";

/**
 * Buyer enquiries and seller replies. Seller contact details live in a
 * private subdocument, <listing>/private/contact, which clients can't read,
 * so the emails are sent from here rather than from the browser.
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
 * @param {string} text - Text typed by a user.
 * @return {string} The text, safe to put in an email's HTML.
 */
function escapeHtml(text: string): string {
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
 *   only, so the buyer can follow up on WhatsApp; null when there is none.
 */
export async function runSendEnquiry(
  buyerUid: string,
  buyerEmail: string,
  data: Record<string, unknown>
): Promise<{whatsappNumber: string | null}> {
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

  const plate = String(listing.plateCharacters ?? "").toUpperCase();
  await Promise.all([
    db.collection("seller_enquiries").add({
      plateId: listingId,
      plateCharacters: listing.plateCharacters ?? "",
      enquiryType,
      message,
      buyerUid,
      buyerEmail,
      sellerLCNumber: contact.lCNumber ?? "",
      sellerEmail: contact.lCEmail,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
    }),
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

/**
 * Email a seller's reply to the buyer of one of their enquiries.
 * @param {string} uid - The signed-in seller.
 * @param {string | undefined} email - The seller's email from their token.
 * @param {Record<string, unknown>} data - enquiryId and replyMessage.
 * @return {Promise<void>}
 */
export async function runReplyToEnquiry(
  uid: string,
  email: string | undefined,
  data: Record<string, unknown>
): Promise<void> {
  const enquiryId = text(data.enquiryId, 1, 100, "enquiry");
  const reply = text(data.replyMessage, 10, 2000, "reply");

  const db = admin.firestore();
  const [enquirySnap, adminSnap] = await Promise.all([
    db.collection("seller_enquiries").doc(enquiryId).get(),
    db.collection("admins").doc(uid).get(),
  ]);
  const enquiry = enquirySnap.data();
  if (!enquiry) {
    throw new HttpsError("not-found", "Enquiry not found");
  }
  if (!adminSnap.exists && (!email || email !== enquiry.sellerEmail)) {
    throw new HttpsError("permission-denied", "Not your enquiry");
  }

  const plate = String(enquiry.plateCharacters ?? "").toUpperCase();
  /* eslint-disable max-len */
  await db.collection("mail").add({
    to: [enquiry.buyerEmail],
    message: {
      subject: `Re: Your enquiry about ${plate}`,
      html: `
        <h2>The seller has replied to your enquiry</h2>
        <p><strong>Plate:</strong> ${escapeHtml(plate)}</p>
        <p><strong>Reply:</strong> ${escapeHtml(reply)}</p>
        <hr>
        <p style="color:#888"><em>Your original message: ${escapeHtml(String(enquiry.message ?? ""))}</em></p>
      `,
    },
  });
  /* eslint-enable max-len */
}
