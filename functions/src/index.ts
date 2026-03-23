import {setGlobalOptions} from "firebase-functions";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

setGlobalOptions({maxInstances: 10});

admin.initializeApp();
const db = admin.firestore();

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
