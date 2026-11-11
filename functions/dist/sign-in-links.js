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
exports.REQUESTED_LINK_TTL = exports.VALUATION_LINK_TTL = void 0;
exports.createSignInLink = createSignInLink;
exports.runRedeemSignInLink = runRedeemSignInLink;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const users_js_1 = require("./users.js");
// Passwordless sign-in links in our emails. Firebase's own email links ask
// for the address again when opened on another device or browser, and work
// only once, so links opened from a phone's mail app often failed. Ours carry
// a secret token instead: opening one signs the visitor in, on any device, as
// often as they like until it expires. Only the token's hash is stored, so the
// sign_in_links collection (no client access) can't be used to sign in.
const DAY = 24 * 60 * 60 * 1000;
/** The valuation email's "List it" link, which people come back to later. */
exports.VALUATION_LINK_TTL = 7 * DAY;
/** A link the visitor asked for on the login page. */
exports.REQUESTED_LINK_TTL = DAY;
/** The query parameter the app reads the token from. */
const PARAM = "signin";
/**
 * @param {string} token - A link's token.
 * @return {string} Its id in sign_in_links.
 */
function linkId(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
/**
 * Save a sign-in link for an email.
 * @param {string} email - The address the link is emailed to.
 * @param {string} url - The page the link opens, on an allowed base URL.
 * @param {number} ttl - How long the link works, in milliseconds.
 * @return {Promise<string>} The link: url with the token added.
 */
async function createSignInLink(email, url, ttl) {
    const token = (0, crypto_1.randomBytes)(24).toString("hex");
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
async function runRedeemSignInLink(data) {
    var _a;
    const token = String((_a = data.token) !== null && _a !== void 0 ? _a : "");
    if (!/^[0-9a-f]{48}$/.test(token)) {
        throw new https_1.HttpsError("not-found", "This sign-in link isn't valid");
    }
    const link = (await admin.firestore()
        .collection("sign_in_links").doc(linkId(token)).get()).data();
    if (!link) {
        throw new https_1.HttpsError("not-found", "This sign-in link isn't valid");
    }
    if (link.expiresAt.toMillis() < Date.now()) {
        throw new https_1.HttpsError("deadline-exceeded", "This sign-in link has expired");
    }
    const uid = await (0, users_js_1.uidForEmail)(String(link.email));
    return { customToken: await admin.auth().createCustomToken(uid) };
}
//# sourceMappingURL=sign-in-links.js.map