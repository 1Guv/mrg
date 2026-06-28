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
exports.getNudgeStatus = exports.toggleNudgeEmails = exports.unsubscribeNudge = exports.scheduledNudgeEmails = exports.onAutoValuationCreated = exports.generateCelebrityArticle = exports.generateDailyArticle = exports.triggerArticleGeneration = exports.getAnalytics = exports.manualSocialPostFullVideos = exports.manualSocialPost = exports.scheduledSocialPost = exports.valuePlate = exports.stripeWebhook = exports.createCheckoutSession = exports.triggerWeeklyReport = exports.triggerCelebrityArticleGeneration = exports.weeklyReport = exports.getUsers = void 0;
const constants_js_1 = require("./constants.js");
const functionsV1 = __importStar(require("firebase-functions/v1"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const valuation_js_1 = require("./valuation.js");
const social_post_js_1 = require("./social-post.js");
const analytics_js_1 = require("./analytics.js");
const article_generator_js_1 = require("./article-generator.js");
const firestore_1 = require("firebase-functions/v2/firestore");
const nudge_emails_js_1 = require("./nudge-emails.js");
admin.initializeApp();
const db = admin.firestore();
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
const valuationApiKey = (0, params_1.defineSecret)("VALUATION_API_KEY");
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
const gscRefreshToken = (0, params_1.defineSecret)("GSC_REFRESH_TOKEN");
const gscClientId = (0, params_1.defineSecret)("GSC_CLIENT_ID");
const gscClientSecret = (0, params_1.defineSecret)("GSC_CLIENT_SECRET");
const nudgeUnsubscribeSecret = (0, params_1.defineSecret)("NUDGE_UNSUBSCRIBE_SECRET");
const socialSecretNames = [
    "SHEETS_CLIENT_EMAIL",
    "SHEETS_PRIVATE_KEY",
    "SHEETS_SHEET_ID",
    "PROXY_SECRET",
    "CREATOMATE_TEMPLATE_ID",
    "BUFFER_API_KEY",
];
const fullVideoSecretNames = [
    "SHEETS_CLIENT_EMAIL",
    "SHEETS_PRIVATE_KEY",
    "SHEETS_SHEET_ID",
    "PROXY_SECRET",
    "CREATOMATE_FULL_VIDEO_TEMPLATE_ID",
    "BUFFER_API_KEY",
];
// Reuses the Sheets service account — same SA has GA4 Data API Viewer access.
const analyticsSecretNames = [
    "SHEETS_CLIENT_EMAIL",
    "SHEETS_PRIVATE_KEY",
];
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
// ── Shared weekly report logic ─────────────────────────────────────────────
/**
 * Fetches weekly stats from Firestore and writes a mail document.
 * @return {Promise<string>} The Firestore document ID of the mail doc.
 */
async function runWeeklyReport() {
    var _a, _b, _c;
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    console.log("weeklyReport: starting run");
    // ── Plate Searches ────────────────────────────────────────
    console.log("weeklyReport: fetching plate_searches...");
    const searchesSnap = await db.collection("plate_searches")
        .where("searchedAt", ">=", sevenDaysAgo)
        .get();
    console.log(`weeklyReport: plate_searches count = ${searchesSnap.size}`);
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
    // ── Buyer Searches ────────────────────────────────────────
    console.log("weeklyReport: fetching buyer_searches...");
    const buyerSearchesSnap = await db.collection("buyer_searches")
        .where("searchedAt", ">=", sevenDaysAgo)
        .get();
    console.log(`weeklyReport: buyer_searches count = ${buyerSearchesSnap.size}`);
    const buyerSearchDocs = buyerSearchesSnap.docs.map((d) => d.data());
    const buyerSearchTotal = buyerSearchDocs.length;
    const termMap = new Map();
    for (const d of buyerSearchDocs) {
        const term = String((_a = d["term"]) !== null && _a !== void 0 ? _a : "");
        const results = Number((_b = d["resultsCount"]) !== null && _b !== void 0 ? _b : 0);
        const entry = (_c = termMap.get(term)) !== null && _c !== void 0 ? _c : { count: 0, totalResults: 0 };
        entry.count++;
        entry.totalResults += results;
        termMap.set(term, entry);
    }
    const top10 = [...termMap.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10);
    const zeroResultCount = buyerSearchDocs
        .filter((d) => { var _a; return Number((_a = d["resultsCount"]) !== null && _a !== void 0 ? _a : 0) === 0; }).length;
    const buyerSearchRows = top10.length ?
        top10.map(([term, data]) => {
            const avg = data.count > 0 ?
                Math.round(data.totalResults / data.count) : 0;
            return `<tr>
      <td>${term}</td>
      <td>${data.count}</td>
      <td>${avg}</td>
    </tr>`;
        }).join("") :
        "<tr><td colspan='3'>No buyer searches this week</td></tr>";
    // ── Feature Requests ──────────────────────────────────────
    console.log("weeklyReport: fetching feature_requests...");
    const requestsSnap = await db.collection("feature_requests")
        .where("requestedAt", ">=", sevenDaysAgo)
        .get();
    console.log(`weeklyReport: feature_requests count = ${requestsSnap.size}`);
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
    console.log("weeklyReport: fetching valuation_feedback...");
    const feedbackSnap = await db.collection("valuation_feedback")
        .where("submittedAt", ">=", sevenDaysAgo)
        .get();
    console.log(`weeklyReport: valuation_feedback count = ${feedbackSnap.size}`);
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
    /* eslint-disable max-len */
    const tableStyle = "border-collapse:collapse;width:100%";
    const thStyle = "background:#003399;color:#fff";
    /* eslint-enable max-len */
    const html = `
  <h1>MR Valuations — Weekly Report</h1>
  <p><strong>Period:</strong> ${dateRange}</p>

  <h2>🔍 Plate Searches (${searches.length})</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}">
    <thead style="${thStyle}">
      <tr><th>Plate</th><th>Type</th><th>Badge</th><th>User</th></tr>
    </thead>
    <tbody>${searchRows}</tbody>
  </table>

  <h2>🔎 Buyer Searches (${buyerSearchTotal})</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}">
    <thead style="${thStyle}">
      <tr><th>Term</th><th>Searches</th><th>Avg Results</th></tr>
    </thead>
    <tbody>${buyerSearchRows}</tbody>
  </table>
  ${zeroResultCount > 0 ?
        "<p style=\"color:#b00;font-weight:bold\">⚠️ " +
            zeroResultCount + " searches returned 0 results</p>" : ""}

  <h2>🚀 Feature Requests (${requests.length})</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}">
    <thead style="${thStyle}">
      <tr><th>Plate</th><th>Type Requested</th></tr>
    </thead>
    <tbody>${requestRows}</tbody>
  </table>

  <h2>💬 Feedback (${feedback.length} — 👍 ${agreed}, 👎 ${disagreed})</h2>
  <table border="1" cellpadding="6" cellspacing="0" style="${tableStyle}">
    <thead style="${thStyle}">
      <tr>
        <th>Plate</th><th>Valuation</th>
        <th>Popularity</th><th>Verdict</th>
      </tr>
    </thead>
    <tbody>${feedbackRows}</tbody>
  </table>

  <br>
  <p style="color:#999;font-size:12px">
    MR Valuations automated weekly report
  </p>
`;
    console.log("weeklyReport: writing to mail collection...");
    const mailRef = await db.collection("mail").add({
        to: ["guv.mr.valuations@gmail.com"],
        message: {
            subject: `MR Valuations Weekly Report — ${dateRange}`,
            html,
        },
    });
    console.log(`weeklyReport: mail doc written — ID: ${mailRef.id}`);
    return mailRef.id;
}
exports.weeklyReport = (0, scheduler_1.onSchedule)({ schedule: "every sunday 08:00", maxInstances: 10 }, async () => {
    try {
        await runWeeklyReport();
        console.log("weeklyReport: done");
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`weeklyReport: FAILED — ${msg}`);
        throw err;
    }
});
/** Admin-only HTTP trigger to manually fire a celebrity article on demand. */
exports.triggerCelebrityArticleGeneration = (0, https_1.onRequest)({
    maxInstances: 1,
    timeoutSeconds: 300,
    secrets: [geminiApiKey],
}, async (request, response) => {
    var _a, _b;
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
    }
    const authHeader = (_a = request.headers.authorization) !== null && _a !== void 0 ? _a : "";
    if (!authHeader.startsWith("Bearer ")) {
        response.status(401).json({ error: "Unauthorized" });
        return;
    }
    let email;
    try {
        const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
        email = (_b = decoded.email) !== null && _b !== void 0 ? _b : "";
    }
    catch (_c) {
        response.status(401).json({ error: "Invalid token" });
        return;
    }
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (email !== adminEmail) {
        response.status(403).json({ error: "Not authorised" });
        return;
    }
    try {
        await (0, article_generator_js_1.runGenerateCelebrityArticle)(geminiApiKey.value());
        response.status(200).json({ success: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("triggerCelebrityArticleGeneration error:", msg);
        response.status(500).json({ error: msg });
    }
});
/** Admin-only HTTP trigger to manually run the weekly report for testing. */
exports.triggerWeeklyReport = (0, https_1.onRequest)({ maxInstances: 1 }, async (request, response) => {
    var _a, _b;
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
    }
    const authHeader = (_a = request.headers.authorization) !== null && _a !== void 0 ? _a : "";
    if (!authHeader.startsWith("Bearer ")) {
        response.status(401).json({ error: "Unauthorized" });
        return;
    }
    let email;
    try {
        const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
        email = (_b = decoded.email) !== null && _b !== void 0 ? _b : "";
    }
    catch (_c) {
        response.status(401).json({ error: "Invalid token" });
        return;
    }
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (email !== adminEmail) {
        response.status(403).json({ error: "Not authorised" });
        return;
    }
    try {
        const mailId = await runWeeklyReport();
        response.status(200).json({ success: true, mailDocId: mailId });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        response.status(500).json({ error: msg });
    }
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
                    unit_amount: constants_js_1.LISTING_FEE_PENCE,
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
/** Scheduled: runs every hour, processes pending rows in the Google Sheet. */
exports.scheduledSocialPost = functionsV1
    .runWith({ secrets: socialSecretNames, timeoutSeconds: 540 })
    .pubsub.schedule("every 60 minutes")
    .onRun(async () => {
    var _a, _b, _c, _d, _e, _f;
    const result = await (0, social_post_js_1.processQueue)((_a = process.env.SHEETS_CLIENT_EMAIL) !== null && _a !== void 0 ? _a : "", (_b = process.env.SHEETS_PRIVATE_KEY) !== null && _b !== void 0 ? _b : "", (_c = process.env.SHEETS_SHEET_ID) !== null && _c !== void 0 ? _c : "", (_d = process.env.PROXY_SECRET) !== null && _d !== void 0 ? _d : "", (_e = process.env.CREATOMATE_TEMPLATE_ID) !== null && _e !== void 0 ? _e : "", (_f = process.env.BUFFER_API_KEY) !== null && _f !== void 0 ? _f : "");
    console.log(`Scheduled run complete. Processed: ${result.processed}`);
});
/** Manual trigger: callable from the Angular admin dashboard. */
exports.manualSocialPost = functionsV1
    .runWith({ secrets: socialSecretNames, timeoutSeconds: 540 })
    .https.onCall(async (_data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
        throw new functionsV1.https.HttpsError("permission-denied", "Not authorised");
    }
    const result = await (0, social_post_js_1.processQueue)((_a = process.env.SHEETS_CLIENT_EMAIL) !== null && _a !== void 0 ? _a : "", (_b = process.env.SHEETS_PRIVATE_KEY) !== null && _b !== void 0 ? _b : "", (_c = process.env.SHEETS_SHEET_ID) !== null && _c !== void 0 ? _c : "", (_d = process.env.PROXY_SECRET) !== null && _d !== void 0 ? _d : "", (_e = process.env.CREATOMATE_TEMPLATE_ID) !== null && _e !== void 0 ? _e : "", (_f = process.env.BUFFER_API_KEY) !== null && _f !== void 0 ? _f : "");
    return { success: true, processed: result.processed };
});
/** Manual trigger: process full-video queue from the "Full Videos" tab. */
exports.manualSocialPostFullVideos = functionsV1
    .runWith({ secrets: fullVideoSecretNames, timeoutSeconds: 540 })
    .https.onCall(async (_data, context) => {
    var _a, _b, _c, _d, _e, _f;
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
        throw new functionsV1.https.HttpsError("permission-denied", "Not authorised");
    }
    const result = await (0, social_post_js_1.processQueueFullVideos)((_a = process.env.SHEETS_CLIENT_EMAIL) !== null && _a !== void 0 ? _a : "", (_b = process.env.SHEETS_PRIVATE_KEY) !== null && _b !== void 0 ? _b : "", (_c = process.env.SHEETS_SHEET_ID) !== null && _c !== void 0 ? _c : "", (_d = process.env.PROXY_SECRET) !== null && _d !== void 0 ? _d : "", (_e = process.env.CREATOMATE_FULL_VIDEO_TEMPLATE_ID) !== null && _e !== void 0 ? _e : "", (_f = process.env.BUFFER_API_KEY) !== null && _f !== void 0 ? _f : "");
    return { success: true, processed: result.processed };
});
/** Returns GA4 analytics data; callable from the Angular admin dashboard. */
exports.getAnalytics = functionsV1
    .runWith({ secrets: analyticsSecretNames, timeoutSeconds: 30 })
    .https.onCall(async (_data, context) => {
    var _a, _b;
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
        throw new functionsV1.https.HttpsError("permission-denied", "Not authorised");
    }
    try {
        return await (0, analytics_js_1.fetchAnalytics)((_a = process.env.SHEETS_CLIENT_EMAIL) !== null && _a !== void 0 ? _a : "", (_b = process.env.SHEETS_PRIVATE_KEY) !== null && _b !== void 0 ? _b : "");
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        throw new functionsV1.https.HttpsError("internal", msg);
    }
});
/** Manual trigger: admin HTTP endpoint to fire article generation on demand. */
exports.triggerArticleGeneration = (0, https_1.onRequest)({
    maxInstances: 1,
    timeoutSeconds: 300,
    secrets: [geminiApiKey, gscRefreshToken, gscClientId, gscClientSecret],
}, async (request, response) => {
    var _a, _b;
    // CORS — allow the hosted app to call this endpoint
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (request.method === "OPTIONS") {
        response.status(204).send("");
        return;
    }
    // Auth — verify Firebase ID token
    const authHeader = (_a = request.headers.authorization) !== null && _a !== void 0 ? _a : "";
    if (!authHeader.startsWith("Bearer ")) {
        response.status(401).json({ error: "Unauthorized" });
        return;
    }
    let email;
    try {
        const decoded = await admin
            .auth()
            .verifyIdToken(authHeader.slice(7));
        email = (_b = decoded.email) !== null && _b !== void 0 ? _b : "";
    }
    catch (_c) {
        response.status(401).json({ error: "Invalid token" });
        return;
    }
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (email !== adminEmail) {
        response.status(403).json({ error: "Not authorised" });
        return;
    }
    try {
        await (0, article_generator_js_1.runGenerateDailyArticle)(geminiApiKey.value(), gscRefreshToken.value(), gscClientId.value(), gscClientSecret.value());
        response.status(200).json({ success: true });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("triggerArticleGeneration error:", msg);
        response.status(500).json({ error: msg });
    }
});
/** Daily SEO article generation: picks best GSC keyword, calls Gemini. */
exports.generateDailyArticle = (0, scheduler_1.onSchedule)({
    schedule: "0 8,14 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    secrets: [geminiApiKey, gscRefreshToken, gscClientId, gscClientSecret],
}, async () => {
    await (0, article_generator_js_1.runGenerateDailyArticle)(geminiApiKey.value(), gscRefreshToken.value(), gscClientId.value(), gscClientSecret.value());
});
/** Nightly celebrity article: grounded Gemini search + real-time valuations. */
exports.generateCelebrityArticle = (0, scheduler_1.onSchedule)({
    schedule: "0 21 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    secrets: [geminiApiKey],
}, async () => {
    await (0, article_generator_js_1.runGenerateCelebrityArticle)(geminiApiKey.value());
});
// ── Plate listing nudge emails ──────────────────────────────────────────────
/** Seeds the nudge queue when a new auto_valuation is created. */
exports.onAutoValuationCreated = (0, firestore_1.onDocumentCreated)("auto_valuations/{docId}", async (event) => {
    var _a, _b;
    const data = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!data)
        return;
    const savedAt = (_b = data["savedAt"]) !== null && _b !== void 0 ? _b : admin.firestore.Timestamp.now();
    await (0, nudge_emails_js_1.runOnAutoValuationCreated)(data, savedAt);
});
/** Runs every 6 hours — sends due nudge emails and advances queue timers. */
exports.scheduledNudgeEmails = (0, scheduler_1.onSchedule)({
    schedule: "every 6 hours",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    secrets: [nudgeUnsubscribeSecret],
}, async () => {
    await (0, nudge_emails_js_1.runScheduledNudgeEmails)(nudgeUnsubscribeSecret.value());
});
/** One-click unsubscribe endpoint linked from nudge emails. */
exports.unsubscribeNudge = (0, https_1.onRequest)({ maxInstances: 10, secrets: [nudgeUnsubscribeSecret] }, async (request, response) => {
    const email = request.query["email"];
    const token = request.query["token"];
    if (!email || !token) {
        response.status(400).send("Bad request");
        return;
    }
    const valid = await (0, nudge_emails_js_1.runUnsubscribeNudge)(email, token, nudgeUnsubscribeSecret.value());
    if (!valid) {
        response.status(400).send("Invalid token");
        return;
    }
    response.redirect(`${nudge_emails_js_1.APP_URL}/unsubscribed`);
});
/** Callable — toggles nudge email opt-out for the current user. */
exports.toggleNudgeEmails = (0, https_1.onCall)({ maxInstances: 10 }, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    const optOut = Boolean((_a = request.data) === null || _a === void 0 ? void 0 : _a.optOut);
    await (0, nudge_emails_js_1.runToggleNudgeEmails)(request.auth.uid, optOut);
    return { success: true };
});
/** Callable — returns nudge email opt-out status for the current user. */
exports.getNudgeStatus = (0, https_1.onCall)({ maxInstances: 10 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "Must be logged in");
    }
    return (0, nudge_emails_js_1.runGetNudgeStatus)(request.auth.uid);
});
//# sourceMappingURL=index.js.map