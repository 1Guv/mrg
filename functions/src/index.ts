import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as admin from "firebase-admin";
import Stripe from "stripe";

setGlobalOptions({maxInstances: 10});

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

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

export const weeklyReport = onSchedule("every sunday 08:00", async () => {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Plate Searches ────────────────────────────────────────
  const searchesSnap = await db.collection("plate_searches")
    .where("searchedAt", ">=", sevenDaysAgo)
    .get();

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
  const requestsSnap = await db.collection("feature_requests")
    .where("requestedAt", ">=", sevenDaysAgo)
    .get();

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
  const feedbackSnap = await db.collection("valuation_feedback")
    .where("submittedAt", ">=", sevenDaysAgo)
    .get();

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

  const tableStyle =
    "border-collapse:collapse;width:100%";
  const thStyle =
    "background:#003399;color:#fff";

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
      const initials = meta.initials || (meta.email ?? "XX").substring(0, 2).toUpperCase();

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
