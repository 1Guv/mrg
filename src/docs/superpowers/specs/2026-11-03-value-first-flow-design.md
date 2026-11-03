# Value-First Valuation Flow — Design

**Status:** Adopted — approved and built 2026-11-03

**Goal:** More plates listed for the £30 fee. Let visitors see what their plate is worth before asking for anything, and ask for an email at the point it is worth giving: to unlock the exact figure, or to list.

---

## Why

GA4 data from 23 Oct to 3 Nov 2026:

- 192 visitors, but only 11 started a valuation.
- 8 valuations were completed.
- 0 checkouts started, and 0 purchases.

Today a logged-out visitor must fill in five required fields before the valuation runs: first name, last name, email, city/town and "What does this plate mean to you?". We don't know how many people quit at that form, because nothing is tracked when it is shown or abandoned.

The owner collected those fields to build a customer list, and possibly to target Facebook ads by location. Only the email is doing real work today: it seeds the nudge emails, which are the main route back to `/list-plate`. Name personalises those emails. City feeds a "top cities" table on the admin page. Plate meaning is stored but not used.

Two more problems:

- **There is no customer list.** Sign-ups through the details dialog never get a `users` document. Their details exist only inside each `auto_valuations` record and the admin notification email.
- **Visitors who reach `/list-plate` logged out hit a wall.** This is mostly people opening a nudge email on a different device. Logging in sends them to `/account-dashboard` and drops the plate and price.

## Goals

1. Any visitor can run a valuation with no form, for all four plate types: Current, Prefix, Suffix and Dateless.
2. The result shows the **range** (£min – £max) free. The **exact figure** unlocks once the visitor gives a first name and an email.
3. Giving an email:
   - shows the exact figure on screen straight away
   - creates the account quietly, as today
   - writes a proper `users` record
   - sends the visitor a valuation email with a **"List it for £30"** button that signs them in on any device and opens `/list-plate` with the plate and price filled in
   - enrols them in the existing nudge emails
4. A **"List it for £30"** button sits beside the result. A logged-out visitor gives the same two fields first, then goes straight to a pre-filled `/list-plate`, already signed in.
5. An email that already has an account works too. That visitor still gets the exact figure and the valuation email with its sign-in link. The current "Continue anyway" dead end is removed.
6. Every funnel step can be measured in GA4.

## Non-goals

- **Hiding the exact figure for real.** The valuation is calculated in the browser, so the email gate is a nudge, not a lock. Someone who inspects the page can see the number, and that's fine.
- **Changing the valuation maths, the £30 fee, Stripe, vouchers or the nudge email content.**
- **Re-pointing the admin "top cities" table at GA4.** That is a follow-up. Until then, the table only counts older valuations that still have a city.
- **A valuation box on article pages** (flow item #1) and **keeping the plate and price after login and after a Stripe cancel** (#3). These are separate pieces of work that come next, in that order: #3, then #1.
- **A/B testing.** At roughly one valuation a day there isn't enough traffic. We ship, then watch the GA4 numbers for a few weeks.

## Anti-goals (a failure even if it works)

- **The free result feels like bait.** The range must be real and visible without scrolling. Articles promise a "free instant valuation", so the visitor has to get one.
- **More than two fields** in the email form, or any required field besides first name and email.
- **Two emails within minutes of each other** (the valuation email, then the first nudge).
- **Email addresses written somewhere the browser can read back.** The rules from the 2026-10-26 privacy fix stay tight. In particular, the client can still only write to `mail` addressed to the admin.

## The flow

```
enter plate ──► (per-type form for Current/Prefix/Suffix, unchanged) ──► result
                                                                          │
     ┌────────────────────────────────────────────────────────────────────┤
     │ Estimated value £1,200 – £1,800                                     │
     │ Get your exact valuation: [First name] [Email] [Email me]           │
     │ ☐ Send me tips & offers, and show me relevant ads                   │
     │ [ List it for £30 → ]                                               │
     └────────────────────────────────────────────────────────────────────┘
         │ submit email                         │ List it (logged out)
         ▼                                      ▼
   exact figure shown,                   same 2 fields, then
   valuation email sent                  /list-plate?plate&price&min&max (signed in)
```

Logged-in visitors skip the email form entirely. They see the exact figure and the range, as they do today.

## Decisions

**Owner's calls**

- Show the range free and put the exact figure behind an email.
- Collect only first name and email. Drop last name, city/town and plate meaning from the flow.
- The valuation email carries a "List it for £30" call to action.
- Do this piece first, then #3, then #1.
- An optional consent tick box, so consented emails can be used for Facebook ads.
- Backfill the existing accounts into the `users` customer list as part of this work.

**Claude's calls (the owner can override them)**

1. **Sign-in link.** Use Firebase's built-in email-link sign-in.
   - A Cloud Function generates it with `admin.auth().generateSignInWithEmailLink`, and its `continueUrl` is `/list-plate?plate=…&price=…&min=…&max=…`.
   - If the link is opened on a device where the email isn't stored locally, the page asks the visitor to confirm their email. This is Firebase's standard protection.
   - The **Email link** provider has to be switched on in the Firebase console.
2. **Sending runs on the server.** A new callable, e.g. `captureValuationEmail`, takes `{firstName, email, marketingConsent, registration, type, price, minPrice, maxPrice}`. It:
   - creates or finds the Auth user
   - writes or merges a `users` record keyed by uid, with `source: 'valuation'`, `marketingConsent` and `consentAt`
   - writes the `auto_valuations` record with the email, which keeps the nudge queue trigger working unchanged
   - queues the visitor's valuation email in `mail`
   - returns a custom token only when it **created** the user, so the browser signs in straight away; existing accounts get no token, and their only way in is the email link
   - is rate-limited per IP or email, so it can't be used to spam people
3. **Creating the `auto_valuations` record moves to the server** for anyone who submits the form. Anonymous valuations still get a client-side record with no email, as today. A valuation that gets an email therefore ends up as two records: one anonymous, one with the email. That's accepted; the admin counts may need deduplicating later.
4. **The first nudge is delayed.** When the valuation email has just gone out, the first nudge waits 24 hours instead of 30 minutes.
5. **Consent tick box.** It is optional and unticked by default, and covers "tips & offers" and ads. Uploading emails to Meta as a Custom Audience is only allowed for people who ticked it.
6. **Removed:** the pre-valuation `UserDetailsDialogComponent` and `PostValuationPromptService`, along with City/Town, last name and plate meaning in the flow.
   - `saveFeatureRequest` keeps working without those details.
   - The admin table columns stay and show "—".
7. **One shared result block.** The four result components (Dateless results, Current, Prefix, Suffix) share a single new block for the range, the email form and "List it". Each one currently has its own copy of the result markup.
8. **"List it" for an email that already has an account.** No custom token is issued, so the visitor can't be signed in on the spot. The page shows "We've emailed you a link to finish listing AB12CDE", with a "Resend" button. The link in that email lands them signed in on a pre-filled `/list-plate`.
9. **Getting back in after a link expires.** Firebase email links work once and expire.
   - `/login`, and the sign-in prompt on `/list-plate`, both gain **"Email me a sign-in link"**. Its `continueUrl` is the current URL, query string included, so a visitor arriving from a nudge email returns to the same pre-filled page.
   - The password-reset email that today's dialog sends is **dropped**: it would land minutes after the valuation email. Visitors can still set a password later through "Forgot password".
10. **The account dashboard keeps the valuation.** `captureValuationEmail` also writes the valuation under the user's uid, the same as `addValuation` does today, so it shows on their dashboard. This applies to new and existing accounts.
11. **The admin notification email stays, but is sent by the server.** Anonymous visitors can't write to `mail`, so `onAutoValuationCreated` sends it instead. When an email was captured, it includes the first name and the email.

## Customer list backfill (owner's call: include it)

On 2026-11-03 the `users` collection held 15 records, against 400 Auth accounts and 298 distinct emails in `auto_valuations`. `firestore.rules` has no `users` match, so the client's `saveUserProfile` writes have been denied.

- **One-off script** (`scripts/backfill-users.mjs`):
  - Run it with `--dry-run` first.
  - Write one `users/{uid}` record per Auth account, merging the most recent `firstName`, `lastName` and `city` from that email's `auto_valuations`.
  - Set `source: 'backfill'` and `marketingConsent: false`.
  - It must be safe to re-run.
- **Emails with no account.** Emails found in `auto_valuations` that have no Auth account are left out of `users`. They stay in `auto_valuations` and the nudge queue.
- **Sign-ups write through the server.** Writes to `users` move to a server-side path keyed by uid: Auth `onCreate` or the existing callables, Claude's call. This covers Google, Facebook and manual sign-up. `firestore.rules` gets an explicit `users` match: the owner can read their own record, admins can read all, and clients can't write.
- **Existing records.** Whether the 15 records keep their random ids or are migrated to uid keys is the builder's call; nothing reads them by id today.

## Tracking

New `ConversionTrackingService` methods:

- `email_gate_view`: the form is shown with the result
- `email_gate_submit`: with `has_consent`
- `list_now_click`: with `logged_in`
- `list_plate_view`: with `source` = `valuation` / `email_link` / `nudge` / `direct`

Fixes to existing events:

- `generate_lead` is reused for the email capture, with `lead_source: 'valuation_email'`. It is GA4's recommended event for this.
- `purchase` sends `value`: 30, or the discounted amount.
- `begin_checkout` sends the discounted amount when a voucher is applied.

## Outside the repo

- Firebase console:
  - turn on the **Email link** sign-in provider
  - make sure `mrvaluations.co.uk` is an authorised domain
- GA4: mark `generate_lead` (`valuation_email`) and `purchase` as key events.

## Done when

- A logged-out visitor values each of the four plate types with no form and sees the range.
- Submitting a first name and email:
  - shows the exact figure
  - creates a `users` record
  - delivers the valuation email
  - creates one nudge queue entry, with the first send at +24h
- In a new browser, the email's "List it" link lands on `/list-plate`, signed in, with the plate and price filled in.
- An email that already has an account gets the email and link, and is not shown an error.
- "List it" while logged out leads to the same signed-in, pre-filled `/list-plate` after the two fields (new email). An email that already has an account sees "check your inbox" instead.
- "Email me a sign-in link" on `/login` and on `/list-plate` returns the visitor to the page they were on, signed in.
- A visitor who gives an email sees that valuation on their account dashboard.
- The admin notification email arrives for anonymous valuations as well as captured ones.
- After the backfill, `users` holds one record per Auth account (about 400), all with `marketingConsent: false`, and new sign-ups by any method appear there.
- The new events appear in GA4 DebugView.
