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
  voucherCode?: string | null;
  discountAppliedPence?: number | null;
  _collection?: string;
}
