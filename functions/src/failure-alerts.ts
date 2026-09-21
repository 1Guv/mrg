import * as admin from "firebase-admin";

/**
 * Failure alerting for unattended scheduled jobs.
 *
 * These jobs have no audience. When generateDailyArticle started failing on
 * 2026-05-17 it kept failing twice a day until September, because a failed
 * run and a successful one look identical from outside. Anything on a
 * schedule needs to announce its own failures.
 */

const ADMIN_EMAIL = "guv.mr.valuations@gmail.com";

/** Don't re-alert the same failure more often than this. */
const THROTTLE_MS = 6 * 60 * 60 * 1000;

/** Firestore doc holding per-job alert state. */
const STATE_DOC = "meta/alertState";

interface JobAlertState {
  signature: string;
  lastAlertAt: admin.firestore.Timestamp;
  consecutiveFailures: number;
}

/**
 * Reduce an error to a stable key, so a repeat of the same fault is
 * throttled but a genuinely different one alerts straight away. Digits are
 * masked so that ids and timestamps inside a message don't make every
 * occurrence look unique.
 * @param {unknown} err - The thrown value.
 * @return {string} A stable signature.
 */
function signatureOf(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.split("\n")[0].replace(/\d+/g, "#").slice(0, 200);
}

/**
 * Escape text for inclusion in an HTML email body.
 * @param {string} s - Raw text.
 * @return {string} Escaped text.
 */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Decide whether to send, and record the attempt. Returns the running
 * failure count when an alert should go out, or null to stay quiet.
 * @param {string} job - Job name.
 * @param {string} signature - Error signature.
 * @return {Promise<number|null>} Failure count, or null to suppress.
 */
async function claimAlertSlot(
  job: string,
  signature: string
): Promise<number | null> {
  const db = admin.firestore();
  const ref = db.doc(STATE_DOC);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const all = (snap.data() ?? {}) as Record<string, JobAlertState>;
    const prev = all[job];
    const now = admin.firestore.Timestamp.now();

    const sameFault = prev?.signature === signature;
    const age = prev ? now.toMillis() - prev.lastAlertAt.toMillis() : Infinity;
    const consecutiveFailures = sameFault ?
      (prev?.consecutiveFailures ?? 0) + 1 :
      1;

    // A new fault always alerts; a repeat waits out the throttle window.
    const shouldSend = !sameFault || age >= THROTTLE_MS;

    tx.set(ref, {
      [job]: {
        signature,
        consecutiveFailures,
        lastAlertAt: shouldSend ? now : (prev?.lastAlertAt ?? now),
      },
    }, {merge: true});

    return shouldSend ? consecutiveFailures : null;
  });
}

/**
 * Clear a job's failure state after a successful run.
 * @param {string} job - Job name.
 * @return {Promise<void>}
 */
async function clearAlertState(job: string): Promise<void> {
  const db = admin.firestore();
  const ref = db.doc(STATE_DOC);
  const snap = await ref.get();
  if (!snap.exists || !(snap.data() ?? {})[job]) return;
  await ref.set(
    {[job]: admin.firestore.FieldValue.delete()},
    {merge: true}
  );
  console.log(`failure-alerts: ${job} recovered — state cleared`);
}

/**
 * Queue a failure email via the Firestore mail collection.
 * @param {string} job - Job name.
 * @param {unknown} err - The thrown value.
 * @param {number} count - Consecutive failures with this signature.
 * @return {Promise<void>}
 */
async function sendAlert(
  job: string,
  err: unknown,
  count: number
): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error && err.stack ? err.stack : "";
  const when = new Date().toISOString();
  const repeat = count > 1 ?
    `<p><strong>${count} consecutive failures</strong> with this error. ` +
    "Further alerts for the same fault are suppressed for 6 hours.</p>" :
    "";

  const html = `
    <div style="font-family:system-ui,Arial,sans-serif;line-height:1.6">
      <h2 style="margin:0 0 8px">Scheduled job failed: ${esc(job)}</h2>
      <p style="color:#6b7280;margin:0 0 16px">${esc(when)}</p>
      ${repeat}
      <pre style="background:#f9fafb;border:1px solid #e5e7eb;padding:12px;
border-radius:8px;white-space:pre-wrap;word-break:break-word">${esc(msg)}</pre>
      ${stack ? "<details><summary>Stack</summary><pre style=\"" +
    "background:#f9fafb;padding:12px;border-radius:8px;" +
    "white-space:pre-wrap;font-size:12px\">" +
    esc(stack) + "</pre></details>" : ""}
      <p style="color:#6b7280;font-size:13px">
        Logs: <code>firebase functions:log --only ${esc(job)}</code>
      </p>
    </div>`;

  await admin.firestore().collection("mail").add({
    to: [ADMIN_EMAIL],
    message: {
      subject: `[MR Valuations] ${job} failed`,
      html,
    },
  });
}

/**
 * Run a scheduled job, emailing on failure.
 *
 * The original error is always re-thrown, so Cloud Run still records the
 * failure and retry behaviour is unchanged. Alerting problems are logged and
 * swallowed — a broken alerter must not turn a recoverable job failure into
 * something worse.
 * @param {string} job - Job name, used in the subject and for throttling.
 * @param {Function} run - The job body.
 * @return {Promise<T>} Whatever the job returns.
 */
export async function withFailureAlert<T>(
  job: string,
  run: () => Promise<T>
): Promise<T> {
  let result: T;
  try {
    result = await run();
  } catch (err) {
    try {
      const count = await claimAlertSlot(job, signatureOf(err));
      if (count === null) {
        console.log(`failure-alerts: ${job} alert throttled`);
      } else {
        await sendAlert(job, err, count);
        console.log(`failure-alerts: ${job} alert queued`);
      }
    } catch (alertErr) {
      const m = alertErr instanceof Error ? alertErr.message : String(alertErr);
      console.error(`failure-alerts: could not alert for ${job} — ${m}`);
    }
    throw err;
  }

  try {
    await clearAlertState(job);
  } catch (clearErr) {
    const m = clearErr instanceof Error ? clearErr.message : String(clearErr);
    console.error(`failure-alerts: could not clear state for ${job} — ${m}`);
  }
  return result;
}
