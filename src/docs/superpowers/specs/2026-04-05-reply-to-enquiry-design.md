# Reply to Enquiry — Design Spec
**Date:** 2026-04-05

## Overview
Sellers (admins) can reply to buyer enquiries directly from the Messages tab in the Account Dashboard. A Reply button on each enquiry card opens a dialog pre-filled with context; the seller types a reply which is sent to the buyer via the platform `mail` collection (Firebase Email Extension).

---

## Architecture

### Modified / Created Files

| Action | File | Change |
|--------|------|--------|
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.ts` | New standalone dialog component |
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.html` | Dialog template |
| Create | `src/app/shared/reply-to-enquiry-dialog/reply-to-enquiry-dialog.component.scss` | Dialog styles |
| Modify | `src/app/services/seller-enquiry.service.ts` | Add `sendReply()` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.ts` | Inject `MatDialog`, add `onReply()` |
| Modify | `src/app/core/account-dashboard/account-dashboard.component.html` | Add Reply button to enquiry cards |

---

## 1. SellerEnquiryService — `sendReply()`

```typescript
sendReply(enquiry: SellerEnquiry, replyMessage: string): Promise<void> {
  const mailRef = collection(this.firestore, 'mail');
  return addDoc(mailRef, {
    to: [enquiry.buyerEmail],
    message: {
      subject: `Re: Your enquiry about ${enquiry.plateCharacters.toUpperCase()}`,
      html: `
        <h2>The seller has replied to your enquiry</h2>
        <p><strong>Plate:</strong> ${enquiry.plateCharacters.toUpperCase()}</p>
        <p><strong>Reply:</strong> ${replyMessage}</p>
        <hr>
        <p style="color:#888"><em>Your original message: ${enquiry.message}</em></p>
      `
    }
  }).then(() => {});
}
```

---

## 2. ReplyToEnquiryDialogComponent

**Input:** Receives `SellerEnquiry` via `MAT_DIALOG_DATA`.

**Template sections:**
- Header: `Reply to [plateCharacters | uppercase]`
- Context (read-only): buyer email, enquiry type, original message
- Form: single `replyMessage` textarea — required, minLength 10
- Buttons: Cancel, Send Reply
- States: loading spinner, success (check icon + "Reply sent!"), error message

**`onSubmit()`:**
```typescript
async onSubmit(): Promise<void> {
  if (this.form.invalid) return;
  this.loading = true;
  this.errorMessage = '';
  try {
    await this.enquiryService.sendReply(this.enquiry, this.form.value.replyMessage);
    this.submitted = true;
  } catch {
    this.errorMessage = 'Something went wrong. Please try again.';
  } finally {
    this.loading = false;
  }
}
```

---

## 3. AccountDashboardComponent

### TypeScript
- Import `ReplyToEnquiryDialogComponent` and `MatDialogModule`
- Add method:
```typescript
onReply(enquiry: SellerEnquiry): void {
  this.dialog.open(ReplyToEnquiryDialogComponent, { width: '520px', data: enquiry });
}
```

### HTML — Reply button added to each enquiry card
```html
<button mat-stroked-button color="primary" (click)="onReply(enquiry)">
  Reply
</button>
```

---

## Data Flow

```
Admin clicks Reply on enquiry card
  → AccountDashboardComponent.onReply(enquiry)
    → MatDialog.open(ReplyToEnquiryDialogComponent, { data: enquiry })
      → Seller types reply, clicks Send Reply
        → SellerEnquiryService.sendReply(enquiry, replyMessage)
          → addDoc(mail, { to: [buyerEmail], message: { subject, html } })
          → Dialog shows success state
```
