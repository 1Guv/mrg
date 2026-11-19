import * as admin from "firebase-admin";
import {escapeHtml, messagesRef, MESSAGES_URL} from "./enquiries.js";

/**
 * Emails that can't be delivered, reported by Brevo's webhook. Legacy
 * apnaplates sellers' details are years old, so when a seller's address
 * bounces we take their listings back: enquiries come to the admin inbox,
 * and anyone already waiting on that seller is told and handed over.
 */

/** The inbox admins answer legacy listings from. */
export const ADMIN_INBOX_EMAIL = "guv.mr.valuations+apnaplates@gmail.com";
const ADMIN_PHONE = "07540840801";

/** Brevo events that mean the address will never take mail. */
const DEAD_EVENTS = new Set(["hard_bounce", "invalid_email", "blocked"]);

const BUYER_NOTE =
  "Hi, this is MR Valuations. The seller's contact details are out of " +
  "date, so your message didn't reach them. We're looking after this " +
  "plate for them now and will get back to you here.";

/**
 * @param {unknown} body - The webhook's JSON: one event or a batch.
 * @return {string[]} The addresses that can't receive mail, lowercased.
 */
export function deadAddresses(body: unknown): string[] {
  const events = Array.isArray(body) ? body : [body];
  const emails = events
    .filter((e) => e && DEAD_EVENTS.has(String(e.event)))
    .map((e) => String(e.email ?? "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return [...new Set(emails)];
}

/**
 * Stop using an address that bounced: listings whose seller it was go back
 * to the admin, their open conversations move to the admin inbox with a
 * note to the buyer, and nudges to it stop.
 * @param {string} email - The dead address, lowercased.
 * @return {Promise<{listings: number, enquiries: number}>} What changed.
 */
export async function runSellerEmailBounced(
  email: string
): Promise<{listings: number, enquiries: number}> {
  const db = admin.firestore();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const [contacts, enquiries, nudges] = await Promise.all([
    db.collectionGroup("private").where("lCEmail", "==", email).get(),
    db.collection("seller_enquiries").where("sellerEmail", "==", email).get(),
    db.collection("listing_nudge_queue").where("email", "==", email).get(),
  ]);

  const batch = db.batch();
  let listings = 0;
  for (const doc of contacts.docs) {
    // Only listings' contacts: other "private" docs never hold lCEmail.
    if (doc.id !== "contact") continue;
    const old = doc.data();
    batch.set(doc.ref, {
      lCEmail: ADMIN_INBOX_EMAIL,
      lCNumber: ADMIN_PHONE,
      lCName: "MR Valuations",
      bounced: true,
      bouncedAt: now,
      bouncedContact: old,
    }, {merge: true});
    listings++;
  }

  const plates: string[] = [];
  for (const doc of enquiries.docs) {
    const enquiry = doc.data();
    batch.update(doc.ref, {
      sellerEmail: ADMIN_INBOX_EMAIL,
      originalSellerEmail: email,
      lastMessageAt: now,
      lastMessageFrom: "seller",
      lastMessageText: BUYER_NOTE,
    });
    batch.set(messagesRef(doc.ref).doc(),
      {from: "seller", text: BUYER_NOTE, sentAt: now});
    const plate = String(enquiry.plateCharacters ?? "").toUpperCase();
    plates.push(plate);
    if (enquiry.buyerEmail) {
      batch.set(db.collection("mail").doc(), {
        to: [enquiry.buyerEmail],
        message: {
          subject: `Re: Your enquiry about ${plate}`,
          html: `
            <h2>An update on your enquiry</h2>
            <p><strong>Plate:</strong> ${escapeHtml(plate)}</p>
            <p>${escapeHtml(BUYER_NOTE)}</p>
            <p><a href="${MESSAGES_URL}">See the conversation</a></p>
          `,
        },
      });
    }
  }
  if (plates.length) {
    batch.set(db.collection("mail").doc(), {
      to: [ADMIN_INBOX_EMAIL],
      message: {
        subject: `Seller email bounced: ${plates.join(", ")}`,
        html: `
          <p>${escapeHtml(email)} bounced, so these enquiries are now in
          your messages: ${escapeHtml(plates.join(", "))}.</p>
          <p><a href="${MESSAGES_URL}">Open messages</a></p>
        `,
      },
    });
  }

  for (const doc of nudges.docs) batch.update(doc.ref, {emailValid: false});
  await batch.commit();
  return {listings, enquiries: enquiries.size};
}
