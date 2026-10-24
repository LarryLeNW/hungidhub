import { apiFetch } from "./client";
import type { Paginated } from "./catalog";

export type ApiWallet = {
  id: number;
  userId: number;
  balance: number;
  currency: string;
};

export type WalletTransactionType =
  | "payment"
  | "deposit"
  | "withdrawal"
  | "refund"
  | "adjustment";

export type ApiWalletTransaction = {
  id: number;
  code: string;
  type: WalletTransactionType;
  channel: "wallet" | "bank_transfer" | "zalo" | "manual";
  amount: number;
  balanceAfter: number;
  status: "pending" | "success" | "failed";
  description: string | null;
  orderId?: number | null;
  fundRequestId?: number | null;
  createdAt: string;
};

export type DepositPaymentInstructions = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  transferContent: string;
  code: string;
};

export type FundRequestStatus =
  | "pending"
  | "processing"
  | "completed"
  | "rejected";

export type ApiFundRequest = {
  id: number;
  code: string;
  userId: number;
  type: "deposit" | "withdrawal";
  amount: number;
  status: FundRequestStatus;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  transferContent?: string | null;
  note?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
  paymentInstructions?: DepositPaymentInstructions | null;
};

export const walletApi = {
  getMe: () => apiFetch<ApiWallet>("/wallet"),

  getTransactions: (params: { page?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();
    return apiFetch<Paginated<ApiWalletTransaction>>(
      `/wallet/transactions${query ? `?${query}` : ""}`,
    );
  },

  getFundRequests: (params: { page?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.page) search.set("page", String(params.page));
    if (params.limit) search.set("limit", String(params.limit));
    const query = search.toString();
    return apiFetch<Paginated<ApiFundRequest>>(
      `/wallet/fund-requests${query ? `?${query}` : ""}`,
    );
  },

  getFundRequest: (id: number) =>
    apiFetch<ApiFundRequest>(`/wallet/fund-requests/${id}`),

  createDeposit: (amount: number, note?: string) =>
    apiFetch<ApiFundRequest>("/wallet/fund-requests", {
      method: "POST",
      body: {
        type: "deposit",
        amount,
        note,
      },
    }),
};
