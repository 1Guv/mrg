import * as admin from "firebase-admin";
import {contactRef, escapeHtml} from "./enquiries.js";
import {createSignInLink, VALUATION_LINK_TTL} from "./sign-in-links.js";
import {ADMIN_INBOX_EMAIL} from "./bounces.js";

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
function listedAt(listing: Record<string, unknown>): number {
  const ts = listing.createdAt as admin.firestore.Timestamp | undefined;
  return ts?.toMillis?.() ?? (Date.parse(String(listing.createdDate)) || 0);
}

/**
 * Email the seller of each live listing, listed over a day ago, that has no
 * meaning and hasn't been asked before.
 * @return {Promise<number>} How many sellers were emailed.
 */
export async function runMeaningReminders(): Promise<number> {
  const db = admin.firestore();
  const live = await db.collection("plate-listings-new")
    .where("isSold", "==", false).get();
  // One email per seller, however many of their listings need a meaning.
  const bySeller = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
  for (const doc of live.docs) {
    const listing = doc.data();
    if (String(listing.meanings ?? "").trim()) continue;
    if (listing.meaningReminderSentAt) continue;
    const at = listedAt(listing);
    if (!at || Date.now() - at < DAY) continue;
    const contact = (await contactRef(doc.ref).get()).data();
    const email = String(contact?.lCEmail ?? "").trim().toLowerCase();
    if (!email || email === ADMIN_INBOX_EMAIL) continue;
    bySeller.set(email, [...(bySeller.get(email) ?? []), doc]);
  }

  for (const [email, docs] of bySeller) {
    const plates = docs.map((d) =>
      String(d.data().plateCharacters ?? "").toUpperCase());
    const names = plates.length === 1 ? plates[0] :
      `${plates.slice(0, -1).join(", ")} and ${plates[plates.length - 1]}`;
    const link =
      await createSignInLink(email, LISTINGS_URL, VALUATION_LINK_TTL);
    /* eslint-disable max-len */
    await db.collection("mail").add({
      to: [email],
      message: {
        subject: `What does ${names} mean? Buyers will want to know`,
        html: `
          <h2>Add a meaning to ${escapeHtml(names)}</h2>
          <p>A plate isn't always easy to read at a glance, and buyers enquire more when they can see what it spells, like a name, a word or initials.</p>
          <p>It takes a few seconds:</p>
          <p><a href="${link}">Add ${plates.length === 1 ? "a meaning" : "meanings"} to your listings</a></p>
          <p style="color:#6b7280;font-size:13px">This link signs you in to your listings, so there's no password to remember. It works for 7 days.</p>
        `,
      },
    });
    /* eslint-enable max-len */
    const now = admin.firestore.FieldValue.serverTimestamp();
    await Promise.all(docs.map((d) =>
      d.ref.update({meaningReminderSentAt: now})));
  }
  console.log(`meaning reminders: emailed ${bySeller.size} sellers`);
  return bySeller.size;
}
