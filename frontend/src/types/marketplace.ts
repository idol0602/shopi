export type ProductStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "HIDDEN" | "OUT_OF_STOCK";

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PROOF_UPLOADED"
  | "CONFIRMED"
  | "SHIPPED"
  | "CANCELLED"
  | "PAYMENT_FAILED";

export interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  priceAmount: number;
  currency: string;
  category: string;
  imageUrls: string[];
  status: ProductStatus;
  quantity?: number;
  sellerId: string;
  sellerName?: string;
  sellerRating?: number;
  sellerLocation?: string;
  reservedByUserId?: string;
  condition?: "NEW" | "LIKE_NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE";
  conditionDetail?: string;
  createdAt: number;
  updatedAt: number;
  reservationDeadlineEpochMs?: number;
}

export interface VietQRPayload {
  bankId: string;
  bankName: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
  qrImageUrl: string;
}

export interface Order {
  id: string;
  productId: string;
  buyerId: string;
  sellerId: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  vietQrPayload?: VietQRPayload;
  receiptImageUrl?: string;
  paymentDeadlineEpochMs: number;
  createdAt: number;
  updatedAt: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
