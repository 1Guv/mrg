import * as admin from "firebase-admin";

/**
 * The customer list. Every Auth account gets a users/{uid} document, written
 * only from here and from captureValuationEmail; clients can read their own
 * but never write.
 */

export type UserSource =
  "google" | "facebook" | "manual" | "valuation" | "backfill";

/** The parts of an Auth user record this module needs. */
export interface NewAuthUser {
  uid: string;
  email?: string;
  displayName?: string;
  providerData?: Array<{providerId: string}>;
}

/** gRPC status Firestore returns when create() finds a document. */
const ALREADY_EXISTS = 6;

/**
 * @param {Array<{providerId: string}>} providerData - The user's providers.
 * @return {UserSource} How the account was made. No providers means the
 *   admin SDK made it, which only captureValuationEmail does.
 */
export function sourceFromProviders(
  providerData: Array<{providerId: string}> = []
): UserSource {
  const ids = providerData.map((p) => p.providerId);
  if (ids.includes("google.com")) return "google";
  if (ids.includes("facebook.com")) return "facebook";
  if (ids.includes("password")) return "manual";
  return "valuation";
}

/**
 * Masks an email address for logs, e.g. "jo***@example.com".
 * @param {string} email - The address.
 * @return {string} The masked address.
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${(local ?? "").slice(0, 2)}***@${domain ?? ""}`;
}

/**
 * Writes users/{uid} for a new Auth account. Does nothing if the document
 * is already there, e.g. captureValuationEmail wrote it first.
 * @param {NewAuthUser} user - The account just created.
 * @return {Promise<void>}
 */
export async function runOnUserCreated(user: NewAuthUser): Promise<void> {
  const [firstName, ...rest] =
    String(user.displayName ?? "").trim().split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  const doc: Record<string, unknown> = {
    uid: user.uid,
    email: String(user.email ?? "").toLowerCase(),
    source: sourceFromProviders(user.providerData),
    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    marketingConsent: false,
  };
  if (firstName) doc.firstName = firstName;
  if (lastName) doc.lastName = lastName;

  try {
    await admin.firestore().collection("users").doc(user.uid).create(doc);
    console.log(`users: created ${user.uid} (${doc.source})`);
  } catch (err) {
    if ((err as {code?: number}).code === ALREADY_EXISTS) return;
    throw err;
  }
}

/**
 * @param {string} email - A verified email.
 * @return {Promise<string>} The uid of that email's account, created if
 *   there isn't one.
 */
export async function uidForEmail(email: string): Promise<string> {
  try {
    const user = await admin.auth().getUserByEmail(email);
    if (!user.emailVerified) {
      await admin.auth().updateUser(user.uid, {emailVerified: true});
    }
    return user.uid;
  } catch (err) {
    if ((err as {code?: string}).code !== "auth/user-not-found") throw err;
    return (await admin.auth().createUser({email, emailVerified: true})).uid;
  }
}
