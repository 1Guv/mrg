import * as admin from "firebase-admin";
import {HttpsError} from "firebase-functions/v2/https";
import {createHash, randomBytes} from "crypto";
import {uidForEmail} from "./users.js";

// Passwordless sign-in links in our emails. Firebase's own email links ask
// for the address again when opened on another device or browser, and work
// only once, so links opened from a phone's mail app often failed. Ours carry
// a secret token instead: opening one signs the visitor in, on any device, as
// often as they like until it expires. Only the token's hash is stored, so the
// sign_in_links collection (no client access) can't be used to sign in.

const DAY = 24 * 60 * 60 * 1000;
/** The valuation email's "List it" link, which people come back to later. */
export const VALUATION_LINK_TTL = 7 * DAY;
/** A link the visitor asked for on the login page. */
export const REQUESTED_LINK_TTL = DAY;
/** The query parameter the app reads the token from. */
const PARAM = "signin";

/**
 * @param {string} token - A link's token.
 * @return {string} Its id in sign_in_links.
 */
function linkId(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Save a sign-in link for an email.
 * @param {string} email - The address the link is emailed to.
 * @param {string} url - The page the link opens, on an allowed base URL.
 * @param {number} ttl - How long the link works, in milliseconds.
 * @return {Promise<string>} The link: url with the token added.
 */
export async function createSignInLink(
  email: string,
  url: string,
  ttl: number
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const now = Date.now();
  await admin.firestore().collection("sign_in_links").doc(linkId(token)).set({
    email: email.toLowerCase(),
    createdAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(now + ttl),
  });
  const link = new URL(url);
  link.searchParams.set(PARAM, token);
  return link.toString();
}

/**
 * Sign in from an emailed link: opening it proves the visitor owns the email,
 * so their account is created if they don't have one.
 * @param {Record<string, unknown>} data - token.
 * @return {Promise<object>} A custom token that signs them in.
 */
export async function runRedeemSignInLink(
  data: Record<string, unknown>
): Promise<{customToken: string}> {
  const token = String(data.token ?? "");
  if (!/^[0-9a-f]{48}$/.test(token)) {
    throw new HttpsError("not-found", "This sign-in link isn't valid");
  }
  const link = (await admin.firestore()
    .collection("sign_in_links").doc(linkId(token)).get()).data();
  if (!link) {
    throw new HttpsError("not-found", "This sign-in link isn't valid");
  }
  if (link.expiresAt.toMillis() < Date.now()) {
    throw new HttpsError("deadline-exceeded", "This sign-in link has expired");
  }
  const uid = await uidForEmail(String(link.email));
  return {customToken: await admin.auth().createCustomToken(uid)};
}
