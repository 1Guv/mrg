# Nudge Email — DNS/MX Validation Design

**Date:** 2026-06-02  
**Status:** Approved

## Overview

Before sending a nudge email, validate that the recipient's email domain has MX records (can receive mail). Store the result on the queue document so it's visible in the admin UI and never re-checked unnecessarily. Invalid addresses stay in the queue with a 👎 indicator; valid ones proceed to send as normal.

---

## Architecture

### 1. Cloud Function — `nudge-emails.ts`

**New helper: `checkMxRecord(email: string): Promise<boolean>`**

- Extracts the domain from the email address.
- Calls `dns.promises.resolveMx(domain)`.
- Returns `true` if at least one MX record is found, `false` if the lookup throws or returns an empty array.
- Pure utility — no Firestore side effects.

**Updated: `runScheduledNudgeEmails`**

For each due entry, before attempting to send:

1. If `emailValid` is already set (`true` or `false`) — skip the DNS check entirely.
2. If `emailValid` is `null` / `undefined` (new entries and all existing backfill entries) — run `checkMxRecord`.
   - **Invalid** (`false`): write `emailValid: false` to the document. Skip sending. Do **not** advance `nextSendAt` (entry stays due so the status is visible, but it will never be re-checked because `emailValid` is now set).
   - **Valid** (`true`): write `emailValid: true` to the document, then proceed to send as normal.

This naturally handles backfill — every existing entry that has never been checked has no `emailValid` field, so it gets checked on the next scheduled run.

---

### 2. Firestore — `listing_nudge_queue` documents

One new field added to documents:

| Field | Type | Values |
|---|---|---|
| `emailValid` | `boolean \| null` | `true` = valid MX, `false` = no MX records, absent/`null` = not yet checked |

No migration needed — absent field is treated as "not yet checked" by the function logic.

---

### 3. TypeScript Interface — `admin.service.ts`

`NudgeQueueEntry` gets one new optional field:

```ts
emailValid?: boolean | null;
```

---

### 4. Admin UI — `account-dashboard.component.ts`

**`nudgeQueueColumns`** — add `'emailValid'` to the columns array.

**Table column definition** — new `matColumnDef="emailValid"`:
- Header: `Email Valid`
- Cell: `👍` when `true`, `👎` when `false`, `—` when absent/`null`

---

## Error Handling

- DNS lookup failures (e.g. network timeout, SERVFAIL) are treated as invalid (`false`) — same outcome as no MX records. This is safe: a transient DNS failure won't cause a permanent mark because the function will retry on the next scheduled run... wait — actually `emailValid` would be set to `false` on a DNS error, which would permanently block the email. 

**Correction:** distinguish DNS errors from confirmed-no-MX:
- Confirmed no MX records (`ENODATA` / empty array) → `emailValid: false`
- DNS error (timeout, `ENOTFOUND` on the lookup itself, `SERVFAIL`) → leave `emailValid` unset, log a warning, and skip sending for this run. The entry remains unchecked and will be retried next scheduled run.

---

## Scope

- Only affects `runScheduledNudgeEmails` — no changes to queue creation (`runOnAutoValuationCreated`) or unsubscribe logic.
- No external API or new dependencies — uses Node's built-in `dns` module.
- No new Cloud Function endpoints.
