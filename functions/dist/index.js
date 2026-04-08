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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.manualSocialPost = exports.scheduledSocialPost = exports.valuePlate = exports.stripeWebhook = exports.createCheckoutSession = exports.weeklyReport = exports.getUsers = void 0;
const firebase_functions_1 = require("firebase-functions");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const valuation_js_1 = require("./valuation.js");
const social_post_js_1 = require("./social-post.js");
(0, firebase_functions_1.setGlobalOptions)({ maxInstances: 10 });
admin.initializeApp();
const db = admin.firestore();
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
const valuationApiKey = (0, params_1.defineSecret)("VALUATION_API_KEY");
// Social post pipeline secrets
const sheetsClientEmail = (0, params_1.defineSecret)("SHEETS_CLIENT_EMAIL");
const sheetsPrivateKey = (0, params_1.defineSecret)("SHEETS_PRIVATE_KEY");
const sheetsSheetId = (0, params_1.defineSecret)("SHEETS_SHEET_ID");
const creatomateApiKey = (0, params_1.defineSecret)("CREATOMATE_API_KEY");
const creatomateTemplateId = (0, params_1.defineSecret)("CREATOMATE_TEMPLATE_ID");
const publerApiKey = (0, params_1.defineSecret)("PUBLER_API_KEY");
const publerProfileIds = (0, params_1.defineSecret)("PUBLER_PROFILE_IDS");
exports.getUsers = (0, https_1.onCall)({ maxInstances: 1 }, async (request) => {
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!request.auth || request.auth.token.email !== adminEmail) {
        throw new https_1.HttpsError("permission-denied", "Not authorised");
    }
    const users = [];
    let pageToken;
    do {
        const result = await admin.auth().listUsers(1000, pageToken);
        result.users.forEach((u) => {
            var _a, _b;
            users.push({
                uid: u.uid,
                email: (_a = u.email) !== null && _a !== void 0 ? _a : "",
                emailVerified: u.emailVerified,
                createdAt: u.metadata.creationTime,
                lastSignIn: (_b = u.metadata.lastSignInTime) !== null && _b !== void 0 ? _b : null,
                disabled: u.disabled,
            });
        });
        pageToken = result.pageToken;
    } while (pageToken);
    return { users };
});
exports.weeklyReport = (0, scheduler_1.onSchedule)("every sunday 08:00", async () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    // ── Plate Searches ────────────────────────────────────────
    const searchesSnap = await db.collection("plate_searches")
        .where("searchedAt", ">=", sevenDaysAgo)
        .get();
    const searches = searchesSnap.docs.map((d) => d.data());
    const searchRows = searches.length ?
        searches.map((s) => {
            var _a, _b, _c;
            return `<tr>
        <td>${(_a = s["registration"]) !== null && _a !== void 0 ? _a : "-"}</td>
        <td>${(_b = s["type"]) !== null && _b !== void 0 ? _b : "-"}</td>
        <td>${(_c = s["badge"]) !== null && _c !== void 0 ? _c : "-"}</td>
        <td>${s["userId"] ? "Logged in" : "Guest"}</td>
      </tr>`;
        }).join("") :
        "<tr><td colspan='4'>No searches this week</td></tr>";
    // ── Feature Requests ──────────────────────────────────────
    const requestsSnap = await db.collection("feature_requests")
        .where("requestedAt", ">=", sevenDaysAgo)
        .get();
    const requests = requestsSnap.docs.map((d) => d.data());
    const requestRows = requests.length ?
        requests.map((r) => {
            var _a, _b;
            return `<tr>
        <td>${(_a = r["registration"]) !== null && _a !== void 0 ? _a : "-"}</td>
        <td>${(_b = r["type"]) !== null && _b !== void 0 ? _b : "-"}</td>
      </tr>`;
        }).join("") :
        "<tr><td colspan='2'>No feature requests this week</td></tr>";
    // ── Valuation Feedback ────────────────────────────────────
    const feedbackSnap = await db.collection("valuation_feedback")
        .where("submittedAt", ">=", sevenDaysAgo)
        .get();
    const feedback = feedbackSnap.docs.map((d) => d.data());
    const agreed = feedback.filter((f) => f["agreed"] === true).length;
    const disagreed = feedback.filter((f) => f["agreed"] === false).length;
    const feedbackRows = feedback.length ?
        feedback.map((f) => {
            var _a, _b, _c;
            return `<tr>
        <td>${(_a = f["registration"]) !== null && _a !== void 0 ? _a : "-"}</td>
        <td>£${Number((_b = f["valuation"]) !== null && _b !== void 0 ? _b : 0).toFixed(2)}</td>
        <td>${(_c = f["popularityMultiplier"]) !== null && _c !== void 0 ? _c : "-"}x</td>
        <td>${f["agreed"] ? "👍 Agree" : "👎 Disagree"}</td>
      </tr>`;
        }).join("") :
        "<tr><td colspan='4'>No feedback this week</td></tr>";
    // ── Build email ───────────────────────────────────────────
    const from = sevenDaysAgo.toLocaleDateString("en-GB");
    const to = now.toLocaleDateString("en-GB");
    const dateRange = `${from} – ${to}`;
    const tableStyle = "border-collapse:collapse;width:100%";
    const thStyle = "background:#003399;color:#fff";
    const html = `
    <h1>MR Valuations — Weekly Report</h1>
    <p><strong>Period:</strong> ${dateRange}</p>

    <h2>🔍 Plate Searches (${searches.length})</h2>
    <table border="1" cellpadding="6" cellspacing="0"
      style="${tableStyle}">
      <thead style="${thStyle}">
        <tr>
          <th>Plate</th>
          <th>Type</th>
          <th>Badge</th>
          <th>User</th>
        </tr>
      </thead>
      <tbody>${searchRows}</tbody>
    </table>

    <h2>🚀 Feature Requests (${requests.length})</h2>
    <table border="1" cellpadding="6" cellspacing="0"
      style="${tableStyle}">
      <thead style="${thStyle}">
        <tr>
          <th>Plate</th>
          <th>Type Requested</th>
        </tr>
      </thead>
      <tbody>${requestRows}</tbody>
    </table>

    <h2>💬 Feedback (${feedback.length} — 👍 ${agreed}, 👎 ${disagreed})</h2>
    <table border="1" cellpadding="6" cellspacing="0"
      style="${tableStyle}">
      <thead style="${thStyle}">
        <tr>
          <th>Plate</th>
          <th>Valuation</th>
          <th>Popularity</th>
          <th>Verdict</th>
        </tr>
      </thead>
      <tbody>${feedbackRows}</tbody>
    </table>

    <br>
    <p style="color:#999;font-size:12px">
      MR Valuations automated weekly report
    </p>
  `;
    await db.collection("mail").add({
        to: ["guv.mr.valuations@gmail.com"],
        message: {
            subject: `MR Valuations Weekly Report — ${dateRange}`,
            html,
        },
    });
});
exports.createCheckoutSession = (0, https_1.onCall)({ maxInstances: 10, secrets: [stripeSecretKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    const { plateCharacters, askingPrice, phone, email, initials, meanings, negotiable, appBaseUrl, } = request.data;
    const sellerUid = request.auth.uid;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: email,
        line_items: [
            {
                price_data: {
                    currency: "gbp",
                    unit_amount: 600,
                    product_data: {
                        name: `Plate listing: ${String(plateCharacters).toUpperCase()}`,
                        description: "One-off listing fee — listed until sold",
                    },
                },
                quantity: 1,
            },
        ],
        // eslint-disable-next-line max-len
        success_url: `${appBaseUrl}/list-plate/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appBaseUrl}/list-plate`,
        metadata: {
            plateCharacters: String(plateCharacters).toUpperCase(),
            askingPrice: String(askingPrice),
            phone: String(phone),
            email: String(email),
            initials: String(initials !== null && initials !== void 0 ? initials : "").toUpperCase(),
            meanings: String(meanings !== null && meanings !== void 0 ? meanings : ""),
            negotiable: negotiable ? "true" : "false",
            sellerUid,
        },
    });
    return { url: session.url };
});
exports.stripeWebhook = (0, https_1.onRequest)({ maxInstances: 10, secrets: [stripeSecretKey, stripeWebhookSecret] }, async (request, response) => {
    var _a;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe = new stripe_1.default(stripeSecretKey.value());
    const sig = request.headers["stripe-signature"];
    let event;
    try {
        event = stripe.webhooks.constructEvent(request.rawBody, sig, stripeWebhookSecret.value());
    }
    catch (err) {
        response.status(400).send(`Webhook error: ${err}`);
        return;
    }
    if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const meta = session.metadata;
        const fallback = ((_a = meta.email) !== null && _a !== void 0 ? _a : "XX").substring(0, 2).toUpperCase();
        const initials = meta.initials || fallback;
        await db.collection("plate-listings-new").add({
            plateCharacters: meta.plateCharacters,
            askingPrice: meta.askingPrice,
            lCEmail: meta.email,
            lCNumber: meta.phone,
            lCName: meta.email,
            plateListingAccName: meta.email,
            plateListingAccTelNumber: meta.phone,
            meanings: meta.meanings,
            plateNegotiable: meta.negotiable === "true",
            sellerUid: meta.sellerUid,
            initials,
            createdDate: new Date().toISOString(),
            isSold: false,
            soldPrice: null,
            viewsPlaceholder: 0,
            plateBestOffer: false,
            offersOver: false,
            orNearestOffer: false,
            plateType: "",
            plateCategory: "",
            profiletPicUrl: "",
            profiletPicInitials: true,
            messageSeller: "",
        });
    }
    response.status(200).send("ok");
});
exports.valuePlate = (0, https_1.onRequest)({ maxInstances: 10, secrets: [valuationApiKey] }, (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    const key = request.query["key"];
    if (!key || key !== valuationApiKey.value()) {
        response.status(401).json({ error: "Missing or invalid API key" });
        return;
    }
    const rawPlate = request.query["plate"];
    if (!rawPlate) {
        response.status(400).json({ error: "Missing plate parameter" });
        return;
    }
    const result = (0, valuation_js_1.valuatePlate)(rawPlate.trim());
    if (!result) {
        response.status(400).json({ error: "Plate format not recognised" });
        return;
    }
    response.status(200).json(result);
});
const socialSecrets = [
    sheetsClientEmail,
    sheetsPrivateKey,
    sheetsSheetId,
    valuationApiKey,
    creatomateApiKey,
    creatomateTemplateId,
    publerApiKey,
    publerProfileIds,
];
/** Scheduled: runs every hour, processes pending rows in the Google Sheet. */
exports.scheduledSocialPost = (0, scheduler_1.onSchedule)({ schedule: "every 60 minutes", timeoutSeconds: 540, secrets: socialSecrets }, async () => {
    const result = await (0, social_post_js_1.processQueue)(sheetsClientEmail, sheetsPrivateKey, sheetsSheetId, valuationApiKey, creatomateApiKey, creatomateTemplateId, publerApiKey, publerProfileIds);
    console.log(`Scheduled run complete. Processed: ${result.processed}`);
});
/** Manual trigger: callable from the Angular admin dashboard. */
exports.manualSocialPost = (0, https_1.onCall)({ timeoutSeconds: 540, secrets: socialSecrets }, async (request) => {
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!request.auth || request.auth.token.email !== adminEmail) {
        throw new https_1.HttpsError("permission-denied", "Not authorised");
    }
    const result = await (0, social_post_js_1.processQueue)(sheetsClientEmail, sheetsPrivateKey, sheetsSheetId, valuationApiKey, creatomateApiKey, creatomateTemplateId, publerApiKey, publerProfileIds);
    return { success: true, processed: result.processed };
});
//# sourceMappingURL=index.js.map