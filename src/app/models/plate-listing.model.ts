export interface PlateListing {
  id: number;
  lCName: string;
  lCNumber: string;
  lCEmail: string;
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
  plateListingAccName: string;
  plateListingAccTelNumber: string;
  plateType: string;
  plateCategory: string;
  isSold: boolean;
  soldPrice: number | null;
  sellerUid?: string;
  _collection?: string;
}
