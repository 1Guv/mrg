import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, UpperCasePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { Subscription } from 'rxjs';
import { EnquiryMessage, isUnread, SellerEnquiry, SellerEnquiryService } from '../../services/seller-enquiry.service';

type InboxView = 'selling' | 'buying';

/**
 * The dashboard's Messages: conversations about the user's own plates
 * (Selling) and the plates they've enquired about (Buying). Opening one
 * shows every message from both sides, with a reply box.
 */
@Component({
  selector: 'app-messages-inbox',
  standalone: true,
  imports: [DatePipe, UpperCasePipe, FormsModule, MatButtonModule],
  templateUrl: './messages-inbox.component.html',
  styleUrl: './messages-inbox.component.scss'
})
export class MessagesInboxComponent {
  private enquiryService = inject(SellerEnquiryService);

  readonly selling = input<SellerEnquiry[]>([]);
  readonly buying = input<SellerEnquiry[]>([]);
  readonly listingFee = input(0);
  /** Listing whose unlock checkout is opening, if any. */
  readonly unlockingId = input<string | null>(null);
  readonly unlockError = input('');
  readonly unlock = output<SellerEnquiry>();

  /** null until the visitor picks: then Selling, or Buying if they only buy. */
  private chosenView = signal<InboxView | null>(null);
  readonly view = computed<InboxView>(() =>
    this.chosenView() ?? (this.selling().length || !this.buying().length ? 'selling' : 'buying'));
  readonly conversations = computed(() => this.view() === 'selling' ? this.selling() : this.buying());

  readonly openId = signal<string | null>(null);
  readonly messages = signal<EnquiryMessage[]>([]);
  draft = '';
  readonly sending = signal(false);
  readonly sendError = signal('');

  private messagesSub?: Subscription;

  constructor() {
    effect(() => {
      const id = this.openId();
      this.messagesSub?.unsubscribe();
      this.messages.set([]);
      if (!id) return;
      this.messagesSub = this.enquiryService.getMessages(id)
        .subscribe({ next: m => this.messages.set(m), error: () => this.messages.set([]) });
    });
    inject(DestroyRef).onDestroy(() => this.messagesSub?.unsubscribe());
  }

  setView(view: InboxView): void {
    this.chosenView.set(view);
    this.openId.set(null);
  }

  unread(conversation: SellerEnquiry): boolean {
    return isUnread(conversation, this.side());
  }

  unreadCount(view: InboxView): number {
    const side = view === 'selling' ? 'seller' : 'buyer';
    return (view === 'selling' ? this.selling() : this.buying()).filter(c => isUnread(c, side)).length;
  }

  private side(): 'seller' | 'buyer' {
    return this.view() === 'selling' ? 'seller' : 'buyer';
  }

  toggle(conversation: SellerEnquiry): void {
    this.openId.set(this.openId() === conversation.id ? null : conversation.id ?? null);
    if (this.openId() && this.unread(conversation)) {
      // Clears it from the header's count; a failure just leaves it unread.
      this.enquiryService.markRead(conversation.id!, this.side()).catch(err => console.error('Mark read failed', err));
    }
    this.draft = '';
    this.sendError.set('');
  }

  /** Messages to show; enquiries from before conversations only have their first message. */
  thread(conversation: SellerEnquiry): EnquiryMessage[] {
    const saved = this.messages();
    if (saved.length || !conversation.message) return saved;
    return [{ from: 'buyer', text: conversation.message, sentAt: conversation.submittedAt }];
  }

  isMine(message: EnquiryMessage): boolean {
    return message.from === (this.view() === 'selling' ? 'seller' : 'buyer');
  }

  /** Whose turn it is: the other side spoke last. */
  needsYou(conversation: SellerEnquiry): boolean {
    const last = conversation.lastMessageFrom ?? 'buyer';
    return this.view() === 'selling' ? last === 'buyer' : last === 'seller';
  }

  status(conversation: SellerEnquiry): string {
    if (this.view() === 'selling') {
      if (conversation.locked) return 'Locked — unlock to read';
      return this.needsYou(conversation) ? 'Awaiting your reply' : 'You replied';
    }
    if (conversation.locked) return 'Waiting for the seller';
    return this.needsYou(conversation) ? 'New reply' : 'Sent';
  }

  snippet(conversation: SellerEnquiry): string {
    if (conversation.locked) {
      return this.view() === 'selling' ? `“${conversation.preview ?? ''}”` : 'The seller has been emailed about your message';
    }
    return conversation.lastMessageText ?? conversation.message ?? '';
  }

  lastAt(conversation: SellerEnquiry): Date | null {
    return (conversation.lastMessageAt ?? conversation.submittedAt)?.toDate?.() ?? null;
  }

  async send(conversation: SellerEnquiry): Promise<void> {
    const text = this.draft.trim();
    if (!text || !conversation.id) return;
    this.sending.set(true);
    this.sendError.set('');
    try {
      await this.enquiryService.sendMessage(conversation.id, text);
      this.draft = '';
    } catch {
      this.sendError.set('Your message didn\'t send. Please try again.');
    } finally {
      this.sending.set(false);
    }
  }
}
