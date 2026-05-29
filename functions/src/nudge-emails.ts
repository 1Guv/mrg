import * as admin from "firebase-admin";
import * as crypto from "crypto";

const APP_URL = "https://mrvaluations.co.uk";
const FUNCTIONS_BASE_URL = "https://us-central1-code-g-b8b6f.cloudfunctions.net";
const HOURS_24 = 24 * 60 * 60 * 1000;
const HOURS_48 = 48 * 60 * 60 * 1000;

export function hmacToken(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(email).digest("hex");
}

function formatPrice(amount: number): string {
  return "£" + Number(amount).toLocaleString("en-GB", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function buildEmailHtml(
  firstName: string,
  registration: string,
  minPrice: number,
  maxPrice: number,
  unsubUrl: string
): string {
  /* eslint-disable max-len */
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;padding:20px;">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#003399;font-size:24px;margin:0;">MR Valuations</h1>
  </div>
  <p>Hi ${firstName},</p>
  <p>
    You recently valued your number plate
    <strong style="font-size:18px;letter-spacing:2px;background:#FFC200;padding:2px 8px;border-radius:4px;">${registration}</strong>
    on MR Valuations — and the good news is it's estimated to be worth between
    <strong>${formatPrice(minPrice)}</strong> and <strong>${formatPrice(maxPrice)}</strong>.
  </p>
  <p>
    If you've ever thought about selling it, now could be the perfect time. Thousands of buyers
    visit MR Valuations every month specifically looking for plates like yours.
  </p>
  <p>
    <strong>Listing your plate is just £6</strong> — a one-off fee, and it stays listed until it sells.
    No commission, no monthly charges, no hassle.
  </p>
  <div style="background:#f8f9fa;border-left:4px solid #003399;padding:16px;margin:24px 0;">
    <p style="margin:0 0 8px;font-weight:bold;">Why list with us?</p>
    <ul style="margin:0;padding-left:20px;">
      <li>Reach genuine buyers actively searching for private plates</li>
      <li>Keep 100% of your sale price — we never take commission</li>
      <li>Your listing stays live until you sell</li>
      <li>Takes less than 2 minutes to set up</li>
    </ul>
  </div>
  <div style="text-align:center;margin:32px 0;">
    <a href="${APP_URL}/list-plate"
       style="background:#003399;color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:bold;display:inline-block;">
      List My Plate for £6 &rarr;
    </a>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:32px 0;">
  <p style="color:#888;font-size:12px;text-align:center;">
    If you'd rather not hear from us about this, no problem at all.<br>
    <a href="${unsubUrl}" style="color:#888;">Unsubscribe from these emails</a>
  </p>
  <p style="color:#888;font-size:12px;text-align:center;">The MR Valuations Team</p>
</body>
</html>`;
  /* eslint-enable max-len */
}

/**
 * Called when a new auto_valuations document is created.
 * Creates a listing_nudge_queue entry if none exists for this email+plate.
 */
export async function runOnAutoValuationCreated(
  data: admin.firestore.DocumentData,
  savedAt: admin.firestore.Timestamp
): Promise<void> {
  const db = admin.firestore();

  const rawEmail = data["email"];
  const rawReg = data["registration"];
  if (!rawEmail || !rawReg) return;

  const email = String(rawEmail).trim().toLowerCase();
  const registration = String(rawReg).replace(/\s/g, "").toUpperCase();

  const existing = await db.collection("listing_nudge_queue")
    .where("email", "==", email)
    .where("registration", "==", registration)
    .limit(1)
    .get();

  if (!existing.empty) return;

  const nextSendAt = new Date(savedAt.toMillis() + HOURS_24);

  await db.collection("listing_nudge_queue").add({
    email,
    registration,
    firstName: data["firstName"] ?? "",
    valuationMin: data["minPrice"] ?? 0,
    valuationMax: data["maxPrice"] ?? 0,
    firstValuationAt: savedAt,
    nextSendAt: admin.firestore.Timestamp.fromDate(nextSendAt),
    lastSentAt: null,
    sendCount: 0,
    unsubscribed: false,
    unsubscribedAt: null,
    listed: false,
  });

  console.log(`nudge: queued ${registration} for ${email}, first send at ${nextSendAt.toISOString()}`);
}

/**
 * Processes all due nudge queue entries — sends emails and updates next send time.
 */
export async function runScheduledNudgeEmails(nudgeSecret: string): Promise<void> {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const due = await db.collection("listing_nudge_queue")
    .where("unsubscribed", "==", false)
    .where("listed", "==", false)
    .where("nextSendAt", "<=", now)
    .get();

  if (due.empty) {
    console.log("nudge: no entries due");
    return;
  }

  console.log(`nudge: processing ${due.size} entries`);

  for (const doc of due.docs) {
    const entry = doc.data();
    const registration = entry["registration"] as string;
    const email = entry["email"] as string;

    const listingSnap = await db.collection("plate-listings-new")
      .where("plateCharacters", "==", registration)
      .limit(1)
      .get();

    if (!listingSnap.empty) {
      await doc.ref.update({listed: true});
      console.log(`nudge: ${registration} now listed — closed queue entry`);
      continue;
    }

    const token = hmacToken(email, nudgeSecret);
    const unsubUrl =
      `${FUNCTIONS_BASE_URL}/unsubscribeNudge` +
      `?email=${encodeURIComponent(email)}&token=${token}`;

    const firstName = (entry["firstName"] as string) || "there";
    const valuationMin = (entry["valuationMin"] as number) ?? 0;
    const valuationMax = (entry["valuationMax"] as number) ?? 0;
    const sendCount = ((entry["sendCount"] as number) ?? 0) + 1;

    const subject =
      `Your plate ${registration} could be worth ${formatPrice(valuationMax)}` +
      ` — have you thought about listing it?`;

    const html = buildEmailHtml(firstName, registration, valuationMin, valuationMax, unsubUrl);

    await db.collection("mail").add({
      to: [email],
      message: {subject, html},
    });

    await doc.ref.update({
      sendCount,
      lastSentAt: admin.firestore.Timestamp.now(),
      nextSendAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + HOURS_48)),
    });

    console.log(`nudge: sent #${sendCount} to ${email} for ${registration}`);
  }
}

/**
 * Validates an unsubscribe token and marks all queue entries for the email as unsubscribed.
 * Returns whether the token was valid.
 */
export async function runUnsubscribeNudge(
  rawEmail: string,
  token: string,
  secret: string
): Promise<boolean> {
  const email = rawEmail.toLowerCase();
  const expected = hmacToken(email, secret);
  if (token !== expected) return false;

  const db = admin.firestore();
  const snap = await db.collection("listing_nudge_queue")
    .where("email", "==", email)
    .get();

  if (!snap.empty) {
    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    for (const d of snap.docs) {
      batch.update(d.ref, {unsubscribed: true, unsubscribedAt: now});
    }
    await batch.commit();
    console.log(`nudge: unsubscribed ${email} (${snap.size} entries)`);
  }

  return true;
}

/**
 * Toggles nudge email opt-out for all queue entries belonging to a Firebase Auth UID.
 */
export async function runToggleNudgeEmails(uid: string, optOut: boolean): Promise<void> {
  const db = admin.firestore();
  const userRecord = await admin.auth().getUser(uid);
  const email = userRecord.email?.toLowerCase();
  if (!email) return;

  const snap = await db.collection("listing_nudge_queue")
    .where("email", "==", email)
    .get();

  if (snap.empty) return;

  const batch = db.batch();
  const now = admin.firestore.Timestamp.now();
  const nextSendAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + HOURS_48));

  for (const d of snap.docs) {
    if (optOut) {
      batch.update(d.ref, {unsubscribed: true, unsubscribedAt: now});
    } else {
      batch.update(d.ref, {unsubscribed: false, unsubscribedAt: null, nextSendAt});
    }
  }
  await batch.commit();
  console.log(`nudge: toggled optOut=${optOut} for ${email}`);
}

/**
 * Returns whether a Firebase Auth UID has any active opt-out in the nudge queue.
 */
export async function runGetNudgeStatus(uid: string): Promise<{optedOut: boolean}> {
  const db = admin.firestore();
  const userRecord = await admin.auth().getUser(uid);
  const email = userRecord.email?.toLowerCase();
  if (!email) return {optedOut: false};

  const snap = await db.collection("listing_nudge_queue")
    .where("email", "==", email)
    .limit(10)
    .get();

  const optedOut = snap.docs.some((d) => d.data()["unsubscribed"] === true);
  return {optedOut};
}

export {APP_URL};
