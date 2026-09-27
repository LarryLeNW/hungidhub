import { buildQuery, type Paginated } from "./catalog";
import { apiFetch } from "./client";

export type OrderStatus =
  | "pending_payment"
  | "processing"
  | "completed"
  | "cancelled"
  | "refunded";

export type PaymentMethod = "bank_transfer" | "zalo" | "wallet";

export type ApiInventoryItem = {
  id: number;
  payload: string;
  deliveredAt: string | null;
  expiresAt: string | null;
};

export type ApiOrderItem = {
  id: number;
  productId: number | null;
  variantId: number | null;
  productName: string;
  variantLabel: string | null;
  durationLabel: string | null;
  sku: string | null;
  unitPrice: number;
  regularPrice: number | null;
  quantity: number;
  lineTotal: number;
  deliveryStatus: "pending" | "delivered" | "failed";
  deliveredAt: string | null;
  deliveryNote: string | null;
  warrantyUntil: string | null;
  inventoryItems?: ApiInventoryItem[];
};

export type ApiPayment = {
  id: number;
  method: PaymentMethod;
  amount: number;
  status: "pending" | "paid" | "failed" | "refunded";
  provider: string | null;
  transferContent: string | null;
  paidAt: string | null;
};

export type PaymentInstructions = {
  method: PaymentMethod;
  amount: number;
  transferContent: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
};

export type ApiOrder = {
  id: number;
  code: string;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  note: string | null;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discountTotal: number;
  total: number;
  promotionCode: string | null;
  paidAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  items: ApiOrderItem[];
  payments?: ApiPayment[];
  paymentInstructions?: PaymentInstructions | null;
};

export type CreateOrderInput = {
  customer?: { name: string; phone: string; email: string };
  items: { variantId: number; quantity: number }[];
  paymentMethod: PaymentMethod;
  note?: string;
  promotionCode?: string;
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending_payment: "Chờ thanh toán",
  processing: "Đang xử lý",
  completed: "Hoàn tất",
  cancelled: "Đã hủy",
  refunded: "Hoàn tiền",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  bank_transfer: "Chuyển khoản ngân hàng",
  zalo: "Liên hệ Zalo",
  wallet: "Số dư IDHUB",
};

export const ordersApi = {
  /** Works for guests (no token) and signed-in users (token attached automatically). */
  create: (input: CreateOrderInput) =>
    apiFetch<ApiOrder>("/orders", { method: "POST", body: input }),

  lookup: (code: string, email: string) =>
    apiFetch<ApiOrder>(`/orders/lookup${buildQuery({ code, email })}`, { auth: false }),

  listMine: (params: { page?: number; limit?: number; status?: OrderStatus } = {}) =>
    apiFetch<Paginated<ApiOrder>>(`/orders/me${buildQuery(params)}`),

  getMine: (code: string) => apiFetch<ApiOrder>(`/orders/me/${encodeURIComponent(code)}`),
};
