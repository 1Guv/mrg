# List Now Conversion — Design

**Status:** Adopted — approved and built 2026-11-03

**Goal:** Turn a revealed valuation into a £30 listing. Once the exact figure is unlocked, ask whether they'd sell, show them their listing ready to publish, show real buyer demand, and offer an honest, time-limited 10% off.

---

## Why

From 23 Oct to 3 Nov 2026 there were 8 completed valuations and 0 checkouts. "List Now" is a bare button: it asks for a big decision with nothing to make it concrete, safe or timely.

The psychology behind each part:

| Part | Principle |
|------|-----------|
| "Would you sell at this price?" | A small yes first (commitment). It also sorts real sellers from the curious. |
| Listing preview | Ownership (endowment): the advert already looks like theirs, so publishing is approving, not starting. |
| Buyer demand | Social proof, real numbers only. |
| 10% off with a real expiry | Honest urgency. No fake timers. |

## Non-goals and anti-goals

- **Not in scope:** the 90-day relist guarantee (deferred; see the memory note), any cap on nudge emails (the user chose to keep daily sends), or photo upload.
- **Anti-goals:** fake numbers, fake countdowns, or blocking the result behind the question. The figure stays fully visible, and "List Now" stays one tap away.

---

## What the visitor sees

The block shows only when the result is unlocked. It replaces the first "List Now" button (between the totals card and the share icons) on all four result types: Current, Prefix, Suffix and Dateless. The bottom "List Now" button stays.

```
┌──────────────────────────────────────┐
│  🔥 12 buyers searched for plates     │  ← only when ≥ 5 (part 3)
│     like YO1 in the last 30 days      │
│                                       │
│  Would you sell YO1 for £146,800?     │
│  [ Yes ]  [ Maybe later ]  [ Just curious ]
└──────────────────────────────────────┘
```

**Yes** expands the block in place:

```
│  Here's your listing, ready to go     │
│  ┌ plate-listing-card (preview) ───┐  │
│  │  YO1          £146,800          │  │
│  │  Listed by you · Today          │  │
│  └─────────────────────────────────┘  │
│  [ Publish for £27  (£30) ]           │
│  10% off — ends Wed 5 Nov, 15:30      │
│  Edit price or details on next step   │
```

"Publish" goes to `/list-plate` with `plate`, `price`, `min`, `max` and `voucher`, exactly as `listNow()` does today plus the voucher.

**Maybe later** replaces the buttons with: "No problem — we'll check in weekly and tell you if demand for plates like YO1 picks up." Next to it is a small "List now anyway" link.

**Just curious** shows: "Thanks — we won't send you selling reminders for YO1." It also has the "List now anyway" link.

The voucher line (part 6) also shows on the bottom "List Now" button area when a voucher exists, as "10% off until Wed 5 Nov, 15:30".

---

## Part 1 — Listing preview

- Reuse `app-plate-listing-card` (src/app/shared/plate-listing-card). Add a `'preview'` value to its `variant` input that disables Message Seller and the share buttons.
- Build a preview `PlateListing` from the result:
  - plate
  - type
  - asking price = the exact valuation
  - initials, from the signed-in user's display name or the gate's first name; fall back to "You"
  - created date = today
  - other required fields as placeholders
- Asking price: use the exact figure, rounded to the nearest £10. *(Builder's call.)*

## Part 2 — "Would you sell?"

**Client.** Answers are `yes`, `later` or `curious`, stored per plate for the session, so the block remembers the answer if they change answers and recalculate.

**Server.** Add a callable `recordSellIntent({registration, answer, email?})`.
- **Identity:** the auth email if signed in; otherwise the email given at the gate. Hold that in `ValuationGateService` for the session.
- **Rate limit:** 20 per IP per hour, using the existing `rate_limits` pattern.
- **Storage:** writes `sell_intents/{email}_{REG}` with `{email, uid?, registration, answer, answeredAt}`. Last answer wins.
- **Effect on `listing_nudge_queue`:** applies to the matching email + registration entry.
  - `later`: set `cadenceDays: 7` and `nextSendAt` = now + 7 days.
  - `curious`: set `unsubscribed: true` and `stopReason: 'just_curious'` on that one entry only, so other plates keep their nudges. This needs no new index, because the scheduler already filters on `unsubscribed == false`.
  - `yes`: no change.
- **Queue entry not created yet:** the entry is made by the `onAutoValuationCreated` trigger, so it may not exist when the answer arrives. `runOnAutoValuationCreated` therefore checks `sell_intents` when it creates an entry and applies the same rules.
- **Scheduler change:** `runScheduledNudgeEmails` uses `cadenceDays ?? 1` when moving `nextSendAt` on.
- **Security:** anyone could send another person's email and stop or slow their nudges. The only harm is fewer emails, so this is accepted. *(My call.)*

**Rules:** `sell_intents` can be read by admins only, with no client writes.

**Tracking.** Add these to `ConversionTrackingService`:
- `sell_intent` with `{answer, plate_type}`
- `list_preview_publish` when Publish is pressed; the existing `listNowClicked` fires as well

## Part 3 — Buyer demand

Add a callable `getBuyerDemand({registration})` that returns `{count}`, or `{count: 0}` below the threshold.

- **Counting:** count `buyer_searches` from the last 30 days whose `term` "matches" the plate, and drop the seller's own searches (same `userId`) where known. At current volumes, scan the 30-day window and match in memory. Revisit with stored counters if `buyer_searches` grows past a few thousand docs a month. *(Builder's call.)*
- **Matching:** compare the term and the plate, both lowercase with spaces removed. A search matches if either:
  - the term is at least 2 characters and the plate contains it ("yo" matches YO1), or
  - the plate is at least 2 characters and the term contains it ("yo1car" matches YO1).
  Builder writes unit tests for these rules.
- **Threshold:** only show the line when the count is 5 or more; below that, return 0 and the line is hidden.
- **Wording:** "🔥 {count} buyers searched for plates like {REG} in the last 30 days".
- **Caching:** cache per plate for the session on the client. Rate-limit the callable: 30 per IP per hour.

## Part 6 — Result-page voucher

Add a callable `getResultVoucher({registration, email?})`, using the same identity rules as part 2. Call it once when the result unlocks.

- **One voucher per email and plate:**
  - if an active voucher for that pair hasn't expired, return it
  - otherwise mint one: 10% off, single use, `expires_at` = now + 48h on the Stripe promotion code
- **Storage:** stored in `vouchers` as now, plus new `email` and `registration` fields, `audience: 'result'` and `expiresAt`. Clients still can't read it except through the callable's response.
- **Rate limit:** 10 per IP per hour. Each code saves £3 and works once, so the abuse risk is accepted. *(My call.)*
- **Nudge emails:** on the first send, reuse an unexpired voucher for the same email + plate instead of minting a new one. When the 48h voucher has lapsed, keep today's behaviour and mint a fresh 24h one.
- **Display:** show the price as "£27 (£30)", worked out from `percentOff` in the response rather than assuming 10%, plus the real expiry date and time in the visitor's local time. Hide the voucher line once it expires.
- **Expiry check at checkout:** `createCheckoutSession` already falls back to full price when Stripe rejects an expired code. On `/list-plate`, the price hint must also stop assuming 10% when the code has expired. Pass `voucherExpires` in the query string and hide the discount after it. *(Builder's call; the server stays the source of truth.)*

---

## Rollout and measurement

- Deploy functions first (callables + trigger/scheduler changes), then the site.
- **GA4 funnel:** `valuation_complete` → `sell_intent` (by answer) → `list_preview_publish` / `list_now_click` → `list_plate_view` → `begin_checkout` → `purchase`.
- Review after 2–3 weeks, alongside the value-first flow numbers.
