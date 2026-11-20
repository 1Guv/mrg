import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {createHash} from "crypto";
import {
  escapeHtml, messagesRef, MESSAGES_URL, runSendEnquiry, SendEnquiryResult,
} from "./enquiries.js";
import {createSignInLink, VALUATION_LINK_TTL} from "./sign-in-links.js";
import {
  consumeRateLimits, EMAIL_RE, findOrCreateUser, rateLimitId,
} from "./valuation-email.js";
import {ADMIN_INBOX_EMAIL} from "./bounces.js";

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
export function guestEmailHash(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

/**
 * Send a signed-out buyer's enquiry.
 * @param {Record<string, unknown>} data - listingId, collection, enquiryType,
 *   message, email, and website (a field only bots fill in).
 * @param {string} ip - The caller's IP, for rate limiting.
 * @return {Promise<SendEnquiryResult>} As for a signed-in buyer.
 */
export async function runSendGuestEnquiry(
  data: Record<string, unknown>,
  ip: string
): Promise<SendEnquiryResult> {
  // Pretend it worked, so bots learn nothing.
  if (String(data.website ?? "").trim()) {
    return {whatsappNumber: null, plate: ""};
  }
  const email = String(data.email ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) {
    throw new HttpsError("invalid-argument", "Invalid email");
  }
  await consumeRateLimits([
    {id: rateLimitId("enquiry-email", email), max: EMAIL_LIMIT_PER_HOUR},
    {id: rateLimitId("enquiry-ip", ip || "unknown"), max: IP_LIMIT_PER_HOUR},
  ]);

  const {uid} = await findOrCreateUser(email, "");
  const result = await runSendEnquiry(uid, email, data,
    {guest: true, guestEmailHash: guestEmailHash(email)});

  const link = await createSignInLink(email, MESSAGES_URL, VALUATION_LINK_TTL);
  const next = result.sellerNotified ?
    "We've emailed the seller. When they reply, we'll email you." :
    "The seller has your email and will reply to you directly.";
  /* eslint-disable max-len */
  await admin.firestore().collection("mail").add({
    to: [email],
    message: {
      subject: `Your message about ${result.plate} has been sent`,
      html: `
        <h2>Your message about ${escapeHtml(result.plate)} has been sent</h2>
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
export async function runGuestEmailBounced(
  email: string
): Promise<{withdrawn: number, paid: number}> {
  const db = admin.firestore();
  const enquiries = await db.collection("seller_enquiries")
    .where("guestEmailHash", "==", guestEmailHash(email)).get();
  let withdrawn = 0;
  const paid: string[] = [];
  for (const doc of enquiries.docs) {
    const enquiry = doc.data();
    if (enquiry.locked) {
      const [messages, buyer] = await Promise.all([
        messagesRef(doc.ref).get(),
        doc.ref.collection("private").doc("buyer").get(),
      ]);
      const batch = db.batch();
      messages.docs.forEach((m) => batch.delete(m.ref));
      if (buyer.exists) batch.delete(buyer.ref);
      batch.delete(doc.ref);
      await batch.commit();
      withdrawn++;
    } else {
      const listing = await db.collection("plate-listings-new")
        .doc(String(enquiry.plateId)).get();
      if (listing.data()?.pricingModel === "enquiry") {
        paid.push(String(enquiry.plateCharacters ?? "").toUpperCase());
      }
    }
  }
  if (paid.length) {
    const plates = paid.join(", ");
    await db.collection("mail").add({
      to: [ADMIN_INBOX_EMAIL],
      message: {
        subject: `Refund check: guest buyer's email bounced (${plates})`,
        html: `
          <p>A guest buyer's email (${escapeHtml(email)}) bounced after the
          seller had unlocked their enquiry on ${escapeHtml(paid.join(", "))}.
          Check whether the seller should be refunded.</p>
        `,
      },
    });
  }
  return {withdrawn, paid: paid.length};
}
