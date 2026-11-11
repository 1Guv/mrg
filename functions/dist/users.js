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
exports.sourceFromProviders = sourceFromProviders;
exports.maskEmail = maskEmail;
exports.runOnUserCreated = runOnUserCreated;
exports.uidForEmail = uidForEmail;
const admin = __importStar(require("firebase-admin"));
/** gRPC status Firestore returns when create() finds a document. */
const ALREADY_EXISTS = 6;
/**
 * @param {Array<{providerId: string}>} providerData - The user's providers.
 * @return {UserSource} How the account was made. No providers means the
 *   admin SDK made it, which only captureValuationEmail does.
 */
function sourceFromProviders(providerData = []) {
    const ids = providerData.map((p) => p.providerId);
    if (ids.includes("google.com"))
        return "google";
    if (ids.includes("facebook.com"))
        return "facebook";
    if (ids.includes("password"))
        return "manual";
    return "valuation";
}
/**
 * Masks an email address for logs, e.g. "jo***@example.com".
 * @param {string} email - The address.
 * @return {string} The masked address.
 */
function maskEmail(email) {
    const [local, domain] = email.split("@");
    return `${(local !== null && local !== void 0 ? local : "").slice(0, 2)}***@${domain !== null && domain !== void 0 ? domain : ""}`;
}
/**
 * Writes users/{uid} for a new Auth account. Does nothing if the document
 * is already there, e.g. captureValuationEmail wrote it first.
 * @param {NewAuthUser} user - The account just created.
 * @return {Promise<void>}
 */
async function runOnUserCreated(user) {
    var _a, _b;
    const [firstName, ...rest] = String((_a = user.displayName) !== null && _a !== void 0 ? _a : "").trim().split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ");
    const doc = {
        uid: user.uid,
        email: String((_b = user.email) !== null && _b !== void 0 ? _b : "").toLowerCase(),
        source: sourceFromProviders(user.providerData),
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        marketingConsent: false,
    };
    if (firstName)
        doc.firstName = firstName;
    if (lastName)
        doc.lastName = lastName;
    try {
        await admin.firestore().collection("users").doc(user.uid).create(doc);
        console.log(`users: created ${user.uid} (${doc.source})`);
    }
    catch (err) {
        if (err.code === ALREADY_EXISTS)
            return;
        throw err;
    }
}
/**
 * @param {string} email - A verified email.
 * @return {Promise<string>} The uid of that email's account, created if
 *   there isn't one.
 */
async function uidForEmail(email) {
    try {
        const user = await admin.auth().getUserByEmail(email);
        if (!user.emailVerified) {
            await admin.auth().updateUser(user.uid, { emailVerified: true });
        }
        return user.uid;
    }
    catch (err) {
        if (err.code !== "auth/user-not-found")
            throw err;
        return (await admin.auth().createUser({ email, emailVerified: true })).uid;
    }
}
//# sourceMappingURL=users.js.map