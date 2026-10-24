import { apiFetch } from "./client";
import { buildQuery, type Paginated } from "./catalog";
import type { ApiOrder } from "./orders";
import type { AuthUser } from "./auth";

export type RefundRequestStatus = "pending" | "processing" | "completed" | "rejected" | "cancelled";
export type RefundMethod = "wallet" | "bank_transfer";

export type ApiRefundRequest = {
  id: number;
  code: string;
  orderId: number;
  order?: ApiOrder;
  userId: number | null;
  user?: Pick<AuthUser, "id" | "email" | "fullName">;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  amount: number;
  status: RefundRequestStatus;
  refundMethod: RefundMethod;
  reason: string;
  description: string | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  proofImageUrl: string | null;
  reviewedById: number | null;
  reviewedBy?: Pick<AuthUser, "id" | "fullName"> | null;
  reviewedAt: string | null;
  adminNote: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateRefundRequestInput = {
  orderCode: string;
  customerEmail?: string;
  reason: string;
  description?: string;
  refundMethod?: RefundMethod;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  proofImageUrl?: string;
};

export const refundStatusLabels: Record<RefundRequestStatus, string> = {
  pending: "Chờ xử lý",
  processing: "Đang xử lý",
  completed: "Đã hoàn tiền",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export const refundMethodLabels: Record<RefundMethod, string> = {
  wallet: "Ví Idhub",
  bank_transfer: "Chuyển khoản ngân hàng",
};

export const refundsApi = {
  create: (data: CreateRefundRequestInput) =>
    apiFetch<ApiRefundRequest>("/refund-requests", {
      method: "POST",
      body: data,
    }),

  listMine: (params: { page?: number; limit?: number; status?: RefundRequestStatus } = {}) =>
    apiFetch<Paginated<ApiRefundRequest>>(`/refund-requests/me${buildQuery(params)}`),

  getMine: (id: number) =>
    apiFetch<ApiRefundRequest>(`/refund-requests/${id}`),

  cancelMine: (id: number) =>
    apiFetch<ApiRefundRequest>(`/refund-requests/${id}/cancel`, {
      method: "POST",
    }),

  lookup: (code: string, email: string) =>
    apiFetch<ApiRefundRequest>(`/refund-requests/lookup${buildQuery({ code, email })}`),
};
