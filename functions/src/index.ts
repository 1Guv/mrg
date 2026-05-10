import * as functionsV1 from "firebase-functions/v1";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import {valuatePlate} from "./valuation.js";
import {processQueue, processQueueFullVideos} from "./social-post.js";
import {fetchAnalytics} from "./analytics.js";
import {
  runGenerateDailyArticle,
  runGenerateCelebrityArticle,
} from "./article-generator.js";

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");
const valuationApiKey = defineSecret("VALUATION_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const gscRefreshToken = defineSecret("GSC_REFRESH_TOKEN");
const gscClientId = defineSecret("GSC_CLIENT_ID");
const gscClientSecret = defineSecret("GSC_CLIENT_SECRET");

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

export const getUsers = onCall({maxInstances: 1}, async (request) => {
  const adminEmail = "gurvinder.singh.sandhu@gmail.com";
  if (!request.auth || request.auth.token.email !== adminEmail) {
    throw new HttpsError("permission-denied", "Not authorised");
  }

  const users: object[] = [];
  let pageToken: string | undefined;

  do {
    const result = await admin.auth().listUsers(1000, pageToken);
    result.users.forEach((u) => {
      users.push({
        uid: u.uid,
        email: u.email ?? "",
        emailVerified: u.emailVerified,
        createdAt: u.metadata.creationTime,
        lastSignIn: u.metadata.lastSignInTime ?? null,
        disabled: u.disabled,
      });
    });

    pageToken = result.pageToken;
  } while (pageToken);

  return {users};
});

// ── Shared weekly report logic ─────────────────────────────────────────────

/**
 * Fetches weekly stats from Firestore and writes a mail document.
 * @return {Promise<string>} The Firestore document ID of the mail doc.
 */
async function runWeeklyReport(): Promise<string> {
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
    searches.map((s) =>
      `<tr>
      <td>${s["registration"] ?? "-"}</td>
      <td>${s["type"] ?? "-"}</td>
      <td>${s["badge"] ?? "-"}</td>
      <td>${s["userId"] ? "Logged in" : "Guest"}</td>
    </tr>`
    ).join("") :
    "<tr><td colspan='4'>No searches this week</td></tr>";

  // ── Feature Requests ──────────────────────────────────────
  console.log("weeklyReport: fetching feature_requests...");
  const requestsSnap = await db.collection("feature_requests")
    .where("requestedAt", ">=", sevenDaysAgo)
    .get();
  console.log(`weeklyReport: feature_requests count = ${requestsSnap.size}`);

  const requests = requestsSnap.docs.map((d) => d.data());
  const requestRows = requests.length ?
    requests.map((r) =>
      `<tr>
      <td>${r["registration"] ?? "-"}</td>
      <td>${r["type"] ?? "-"}</td>
    </tr>`
    ).join("") :
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
    feedback.map((f) =>
      `<tr>
      <td>${f["registration"] ?? "-"}</td>
      <td>£${Number(f["valuation"] ?? 0).toFixed(2)}</td>
      <td>${f["popularityMultiplier"] ?? "-"}x</td>
      <td>${f["agreed"] ? "👍 Agree" : "👎 Disagree"}</td>
    </tr>`
    ).join("") :
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

export const weeklyReport = onSchedule(
  {schedule: "every sunday 08:00", maxInstances: 10},
  async () => {
    try {
      await runWeeklyReport();
      console.log("weeklyReport: done");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`weeklyReport: FAILED — ${msg}`);
      throw err;
    }
  }
);

/** Admin-only HTTP trigger to manually run the weekly report for testing. */
export const triggerWeeklyReport = onRequest(
  {maxInstances: 1},
  async (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");
    response.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }
    const authHeader = request.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      response.status(401).json({error: "Unauthorized"});
      return;
    }
    let email: string;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
      email = decoded.email ?? "";
    } catch {
      response.status(401).json({error: "Invalid token"});
      return;
    }
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (email !== adminEmail) {
      response.status(403).json({error: "Not authorised"});
      return;
    }
    try {
      const mailId = await runWeeklyReport();
      response.status(200).json({success: true, mailDocId: mailId});
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      response.status(500).json({error: msg});
    }
  }
);

export const createCheckoutSession = onCall(
  {maxInstances: 10, secrets: [stripeSecretKey]},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const {
      plateCharacters,
      askingPrice,
      phone,
      email,
      initials,
      meanings,
      negotiable,
      appBaseUrl,
    } = request.data;

    const sellerUid = request.auth.uid;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe =
      new (Stripe as any)(stripeSecretKey.value()) as import("stripe").Stripe;

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
        initials: String(initials ?? "").toUpperCase(),
        meanings: String(meanings ?? ""),
        negotiable: negotiable ? "true" : "false",
        sellerUid,
      },
    });

    return {url: session.url};
  }
);

export const stripeWebhook = onRequest(
  {maxInstances: 10, secrets: [stripeSecretKey, stripeWebhookSecret]},
  async (request, response) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stripe =
      new (Stripe as any)(stripeSecretKey.value()) as import("stripe").Stripe;
    const sig = request.headers["stripe-signature"] as string;

    type StripeEvent =
      ReturnType<import("stripe").Stripe["webhooks"]["constructEvent"]>;
    let event: StripeEvent;
    try {
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      response.status(400).send(`Webhook error: ${err}`);
      return;
    }

    if (event.type === "checkout.session.completed") {
      type CheckoutSession =
        Awaited<ReturnType<
          import("stripe").Stripe["checkout"]["sessions"]["create"]
        >>;
      const session = event.data.object as CheckoutSession;
      const meta = session.metadata as {
        plateCharacters: string;
        askingPrice: string;
        phone: string;
        email: string;
        initials: string;
        meanings: string;
        negotiable: string;
        sellerUid: string;
      };
      const fallback = (meta.email ?? "XX").substring(0, 2).toUpperCase();
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
  }
);

export const valuePlate = onRequest(
  {maxInstances: 10, secrets: [valuationApiKey]},
  (request, response) => {
    response.set("Access-Control-Allow-Origin", "*");

    const key = request.query["key"] as string | undefined;
    if (!key || key !== valuationApiKey.value()) {
      response.status(401).json({error: "Missing or invalid API key"});
      return;
    }

    const rawPlate = request.query["plate"] as string | undefined;
    if (!rawPlate) {
      response.status(400).json({error: "Missing plate parameter"});
      return;
    }

    const result = valuatePlate(rawPlate.trim());
    if (!result) {
      response.status(400).json({error: "Plate format not recognised"});
      return;
    }

    response.status(200).json(result);
  }
);

/** Scheduled: runs every hour, processes pending rows in the Google Sheet. */
export const scheduledSocialPost = functionsV1
  .runWith({secrets: socialSecretNames, timeoutSeconds: 540})
  .pubsub.schedule("every 60 minutes")
  .onRun(async () => {
    const result = await processQueue(
      process.env.SHEETS_CLIENT_EMAIL ?? "",
      process.env.SHEETS_PRIVATE_KEY ?? "",
      process.env.SHEETS_SHEET_ID ?? "",
      process.env.PROXY_SECRET ?? "",
      process.env.CREATOMATE_TEMPLATE_ID ?? "",
      process.env.BUFFER_API_KEY ?? ""
    );
    console.log(`Scheduled run complete. Processed: ${result.processed}`);
  });

/** Manual trigger: callable from the Angular admin dashboard. */
export const manualSocialPost = functionsV1
  .runWith({secrets: socialSecretNames, timeoutSeconds: 540})
  .https.onCall(async (_data, context) => {
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
      throw new functionsV1.https.HttpsError(
        "permission-denied", "Not authorised"
      );
    }
    const result = await processQueue(
      process.env.SHEETS_CLIENT_EMAIL ?? "",
      process.env.SHEETS_PRIVATE_KEY ?? "",
      process.env.SHEETS_SHEET_ID ?? "",
      process.env.PROXY_SECRET ?? "",
      process.env.CREATOMATE_TEMPLATE_ID ?? "",
      process.env.BUFFER_API_KEY ?? ""
    );
    return {success: true, processed: result.processed};
  });

/** Manual trigger: process full-video queue from the "Full Videos" tab. */
export const manualSocialPostFullVideos = functionsV1
  .runWith({secrets: fullVideoSecretNames, timeoutSeconds: 540})
  .https.onCall(async (_data, context) => {
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
      throw new functionsV1.https.HttpsError(
        "permission-denied", "Not authorised"
      );
    }
    const result = await processQueueFullVideos(
      process.env.SHEETS_CLIENT_EMAIL ?? "",
      process.env.SHEETS_PRIVATE_KEY ?? "",
      process.env.SHEETS_SHEET_ID ?? "",
      process.env.PROXY_SECRET ?? "",
      process.env.CREATOMATE_FULL_VIDEO_TEMPLATE_ID ?? "",
      process.env.BUFFER_API_KEY ?? ""
    );
    return {success: true, processed: result.processed};
  });

/** Returns GA4 analytics data; callable from the Angular admin dashboard. */
export const getAnalytics = functionsV1
  .runWith({secrets: analyticsSecretNames, timeoutSeconds: 30})
  .https.onCall(async (_data, context) => {
    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (!context.auth || context.auth.token.email !== adminEmail) {
      throw new functionsV1.https.HttpsError(
        "permission-denied", "Not authorised"
      );
    }
    try {
      return await fetchAnalytics(
        process.env.SHEETS_CLIENT_EMAIL ?? "",
        process.env.SHEETS_PRIVATE_KEY ?? ""
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new functionsV1.https.HttpsError("internal", msg);
    }
  });

/** Manual trigger: admin HTTP endpoint to fire article generation on demand. */
export const triggerArticleGeneration = onRequest(
  {
    maxInstances: 1,
    timeoutSeconds: 300,
    secrets: [geminiApiKey, gscRefreshToken, gscClientId, gscClientSecret],
  },
  async (request, response) => {
    // CORS — allow the hosted app to call this endpoint
    response.set("Access-Control-Allow-Origin", "*");
    response.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type"
    );
    if (request.method === "OPTIONS") {
      response.status(204).send("");
      return;
    }

    // Auth — verify Firebase ID token
    const authHeader = request.headers.authorization ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      response.status(401).json({error: "Unauthorized"});
      return;
    }
    let email: string;
    try {
      const decoded = await admin
        .auth()
        .verifyIdToken(authHeader.slice(7));
      email = decoded.email ?? "";
    } catch {
      response.status(401).json({error: "Invalid token"});
      return;
    }

    const adminEmail = "gurvinder.singh.sandhu@gmail.com";
    if (email !== adminEmail) {
      response.status(403).json({error: "Not authorised"});
      return;
    }

    try {
      await runGenerateDailyArticle(
        geminiApiKey.value(),
        gscRefreshToken.value(),
        gscClientId.value(),
        gscClientSecret.value()
      );
      response.status(200).json({success: true});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("triggerArticleGeneration error:", msg);
      response.status(500).json({error: msg});
    }
  }
);

/** Daily SEO article generation: picks best GSC keyword, calls Gemini. */
export const generateDailyArticle = onSchedule(
  {
    schedule: "0 8,14 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    secrets: [geminiApiKey, gscRefreshToken, gscClientId, gscClientSecret],
  },
  async () => {
    await runGenerateDailyArticle(
      geminiApiKey.value(),
      gscRefreshToken.value(),
      gscClientId.value(),
      gscClientSecret.value()
    );
  }
);

/** Nightly celebrity article: grounded Gemini search + real-time valuations. */
export const generateCelebrityArticle = onSchedule(
  {
    schedule: "0 21 * * *",
    timeZone: "Europe/London",
    timeoutSeconds: 300,
    secrets: [geminiApiKey],
  },
  async () => {
    await runGenerateCelebrityArticle(geminiApiKey.value());
  }
);
