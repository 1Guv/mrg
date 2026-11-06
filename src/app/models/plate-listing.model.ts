export interface PlateListing {
  id: number;
  initials: string;
  profiletPicUrl: string;
  profiletPicInitials: boolean;
  createdDate: string;
  plateCharacters: string;
  askingPrice: string;
  plateNegotiable: boolean;
  plateBestOffer: boolean;
  offersOver: boolean;
  orNearestOffer: boolean;
  meanings: string;
  viewsPlaceholder: number | string;
  messageSeller: string;
  plateType: string;
  plateCategory: string;
  isSold: boolean;
  soldPrice: number | null;
  sellerUid?: string;
  /** 'enquiry' for free listings, where the seller pays to unlock enquiries. */
  pricingModel?: 'enquiry';
  enquiriesUnlocked?: boolean;
  voucherCode?: string | null;
  discountAppliedPence?: number | null;
  _collection?: string;
}
