import type { AuthUser } from "./auth";
import { buildQuery, type ApiCategory, type ApiProduct, type ApiReview, type ApiVariant, type Paginated } from "./catalog";
import { apiFetch } from "./client";
import type { ApiContentBlock, ApiPage, ApiPost, ApiPostCategory } from "./content";
import type { ApiOrder, OrderStatus } from "./orders";

export type AdminVariant = ApiVariant & {
  costPrice: number | null;
  warrantyDays: number | null;
  stock: { available: number; reserved: number };
};
export type AdminProduct = Omit<ApiProduct, "variants"> & {
  variants: AdminVariant[];
  lowStockThreshold: number;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
};

export type UploadedImage = { url: string; path: string; size: number; mimeType: string; originalName: string };

export type AdminCustomer = AuthUser & { orderCount: number; totalSpent: number };

export type AdminCategory = ApiCategory & {
  isVisible: boolean;
  sortOrder: number;
  productCount: number;
  children: AdminCategory[];
};

export type ApiPromotion = {
  id: number;
  name: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxDiscount: number | null;
  minOrderTotal: number;
  usageLimit: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  status: "scheduled" | "active" | "paused" | "ended";
  description: string | null;
};

export type ApiFundRequest = {
  id: number;
  code: string;
  type: "deposit" | "withdrawal";
  amount: number;
  status: "pending" | "processing" | "completed" | "rejected";
  bankName: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  transferContent: string | null;
  note: string | null;
  rejectReason: string | null;
  createdAt: string;
  user?: Pick<AuthUser, "id" | "email" | "fullName">;
};

export type AdminInventoryRow = {
  id: number;
  sku: string;
  name: string;
  deliveryType: "auto" | "manual";
  isEnabled: boolean;
  productId: number;
  productName: string;
  lowStockThreshold: number;
  available: number;
  reserved: number;
  delivered: number;
  lastMovementAt: string | null;
};

export type AdminTransaction = {
  id: number;
  code: string;
  type: "payment" | "deposit" | "withdrawal" | "refund" | "adjustment";
  channel: "wallet" | "bank_transfer" | "zalo" | "manual";
  amount: number;
  balanceAfter: number;
  status: "pending" | "success" | "failed";
  description: string | null;
  createdAt: string;
  wallet?: { user?: Pick<AuthUser, "id" | "email" | "fullName"> };
};

export type AdminContentBlock = ApiContentBlock & {
  status: "draft" | "published" | "archived";
  startsAt: string | null;
  endsAt: string | null;
  updatedAt: string;
  updatedBy?: Pick<AuthUser, "id" | "fullName"> | null;
};

export type AdminPost = ApiPost & {
  status: "draft" | "published" | "archived";
  contentHtml: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  author?: Pick<AuthUser, "id" | "fullName"> | null;
};

export type AdminTicketMessage = {
  id: number;
  authorType: "customer" | "staff" | "system";
  body: string;
  isInternal: boolean;
  createdAt: string;
  author?: Pick<AuthUser, "id" | "fullName"> | null;
};

export type AdminTicket = {
  id: number;
  code: string;
  customerName: string;
  customerEmail: string | null;
  subject: string;
  priority: "low" | "medium" | "high";
  status: "new" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  updatedAt: string;
  createdAt: string;
  assignee?: Pick<AuthUser, "id" | "fullName"> | null;
  order?: Pick<ApiOrder, "id" | "code" | "status"> | null;
  messages?: AdminTicketMessage[];
};

export type AdminReport = {
  id: number;
  name: string;
  kind: string;
  periodLabel: string;
  format: "excel" | "pdf" | "dashboard";
  status: "generating" | "ready" | "failed";
  params: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: Pick<AuthUser, "id" | "fullName"> | null;
};

export type AdminSetting = {
  id: number;
  key: string;
  group: "store" | "payment" | "roles" | "notifications" | "integrations";
  value: unknown;
  description: string | null;
  isPublic: boolean;
  updatedAt: string;
  updatedBy?: Pick<AuthUser, "id" | "fullName"> | null;
};

export type AdminReview = ApiReview & { product?: { id: number; name: string; slug: string } };

export type AdminNotification = {
  id: number;
  title: string;
  body: string | null;
  section: string | null;
  tone: "cyan" | "blue" | "green" | "amber" | "danger";
  entityType: string | null;
  entityId: number | null;
  readAt: string | null;
  createdAt: string;
};

export type AdminStats = {
  generatedAt: string;
  today: {
    revenue: number;
    revenueChangePercent: number | null;
    orders: number;
    ordersChangePercent: number | null;
    newCustomers: number;
    newCustomersChangePercent: number | null;
  };
  refundRatePercent: number;
  revenueByDay: { date: string; revenue: number; orders: number }[];
  ordersByStatus: Record<string, number>;
  lowStock: { variantId: number; productId: number; sku: string; productName: string; available: number; threshold: number }[];
  recentActivity: { type: "order" | "fund_request" | "ticket" | "customer"; title: string; detail: string; at: string }[];
  badges: { orders: number; inventory: number; deposits: number; support: number };
  traffic: {
    today: { views: number; visitors: number; changePercent: number | null };
    byDay: { date: string; views: number; visitors: number }[];
    topPages: { path: string; views: number }[];
    devices: { desktop: number; mobile: number };
  };
};

// ------------------------------------------------------------------ inputs

export type VariantInput = {
  sku?: string;
  name: string;
  accountType?: string;
  duration?: string;
  durationDays?: number;
  price: number;
  regularPrice?: number;
  costPrice?: number;
  deliveryType?: "auto" | "manual";
  warrantyDays?: number;
  isEnabled?: boolean;
  sortOrder?: number;
};

export type ProductInput = {
  name: string;
  slug?: string;
  shortDescription?: string;
  contentHtml?: string;
  featuredImage?: string;
  badges?: string[];
  status?: "draft" | "active" | "hidden";
  categoryIds?: number[];
  images?: { src: string; alt?: string }[];
  variants?: VariantInput[];
  lowStockThreshold?: number;
  warrantyDays?: number;
  deliveryTimeText?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
};

export type CategoryInput = {
  name: string;
  slug?: string;
  parentId?: number | null;
  description?: string;
  contentHtml?: string;
  imageUrl?: string;
  icon?: string;
  sortOrder?: number;
  isVisible?: boolean;
};

export type PromotionInput = {
  name: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  maxDiscount?: number;
  minOrderTotal?: number;
  usageLimit?: number;
  perUserLimit?: number;
  startsAt?: string;
  endsAt?: string;
  status?: ApiPromotion["status"];
  description?: string;
};

export type ContentBlockInput = {
  title: string;
  type: "banner" | "announcement" | "help_article";
  placement?: string;
  body?: string;
  imageUrl?: string;
  mobileImageUrl?: string;
  linkUrl?: string;
  sortOrder?: number;
  status?: "draft" | "published" | "archived";
  startsAt?: string;
  endsAt?: string;
};

export type PostInput = {
  title: string;
  slug?: string;
  excerpt?: string;
  contentHtml?: string;
  featuredImage?: string;
  status?: AdminPost["status"];
  categoryIds?: number[];
  seoTitle?: string;
  seoDescription?: string;
};

type PageParams = { page?: number; limit?: number; search?: string };

const json = <T,>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) =>
  apiFetch<T>(path, { method, body: body ?? {} });

export const adminApi = {
  stats: () => apiFetch<AdminStats>("/admin/stats"),

  notifications: () => apiFetch<{ items: AdminNotification[]; unreadCount: number }>("/admin/notifications"),
  markNotificationRead: (id: number) => json<AdminNotification>(`/admin/notifications/${id}/read`, "POST"),
  markAllNotificationsRead: () => json<void>("/admin/notifications/read-all", "POST"),

  // orders
  listOrders: (params: PageParams & { status?: OrderStatus } = {}) =>
    apiFetch<Paginated<ApiOrder>>(`/admin/orders${buildQuery(params)}`),
  getOrder: (id: number) => apiFetch<ApiOrder>(`/admin/orders/${id}`),
  confirmPayment: (id: number, transactionRef?: string) =>
    json<ApiOrder>(`/admin/orders/${id}/confirm-payment`, "POST", transactionRef ? { transactionRef } : {}),
  completeOrder: (id: number, deliveryNotes?: Record<string, string>) =>
    json<ApiOrder>(`/admin/orders/${id}/complete`, "POST", deliveryNotes ? { deliveryNotes } : {}),
  cancelOrder: (id: number, reason: string) => json<ApiOrder>(`/admin/orders/${id}/cancel`, "POST", { reason }),
  refundOrder: (id: number, reason: string) => json<ApiOrder>(`/admin/orders/${id}/refund`, "POST", { reason }),

  // products & variants & stock
  listProducts: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<AdminProduct>>(`/admin/products${buildQuery(params)}`),
  getProduct: (id: number) => apiFetch<AdminProduct>(`/admin/products/${id}`),
  createProduct: (input: ProductInput) => json<AdminProduct>("/admin/products", "POST", input),
  updateProduct: (id: number, input: Partial<ProductInput>) => json<AdminProduct>(`/admin/products/${id}`, "PATCH", input),
  setProductStatus: (id: number, status: "draft" | "active" | "hidden") =>
    json<AdminProduct>(`/admin/products/${id}/status/${status}`, "PATCH"),
  deleteProduct: (id: number) => json<void>(`/admin/products/${id}`, "DELETE"),
  addVariant: (productId: number, input: VariantInput) => json<AdminVariant>(`/admin/products/${productId}/variants`, "POST", input),
  updateVariant: (id: number, input: Partial<VariantInput>) => json<AdminVariant>(`/admin/variants/${id}`, "PATCH", input),
  deleteVariant: (id: number) => json<void>(`/admin/variants/${id}`, "DELETE"),
  /** Multipart image upload → public URL (stored on products/categories/content). */
  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return apiFetch<UploadedImage>("/admin/uploads/images", { method: "POST", body: form });
  },
  importInventory: (variantId: number, items: string[], note?: string) =>
    json<{ imported: number; available: number }>(`/admin/variants/${variantId}/inventory`, "POST", { items, note }),
  listInventory: (params: PageParams = {}) =>
    apiFetch<Paginated<AdminInventoryRow>>(`/admin/inventory${buildQuery(params)}`),

  // customers
  listUsers: (params: PageParams & { role?: string } = {}) =>
    apiFetch<Paginated<AdminCustomer>>(`/users${buildQuery(params)}`),
  getUser: (id: number) => apiFetch<AuthUser>(`/users/${id}`),
  setUserStatus: (id: number, isActive: boolean) => json<AuthUser>(`/users/${id}/status`, "PATCH", { isActive }),
  setUserRole: (id: number, role: "admin" | "customer") => json<AuthUser>(`/users/${id}/role`, "PATCH", { role }),

  // finance
  listTransactions: (params: PageParams & { type?: string; status?: string } = {}) =>
    apiFetch<Paginated<AdminTransaction>>(`/admin/transactions${buildQuery(params)}`),
  listFundRequests: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<ApiFundRequest>>(`/admin/fund-requests${buildQuery(params)}`),
  approveFundRequest: (id: number, note?: string) =>
    json<ApiFundRequest>(`/admin/fund-requests/${id}/approve`, "POST", note ? { note } : {}),
  rejectFundRequest: (id: number, reason: string) => json<ApiFundRequest>(`/admin/fund-requests/${id}/reject`, "POST", { reason }),

  // catalog structure
  listCategories: () => apiFetch<AdminCategory[]>("/admin/categories"),
  createCategory: (input: CategoryInput) => json<AdminCategory>("/admin/categories", "POST", input),
  updateCategory: (id: number, input: Partial<CategoryInput>) => json<AdminCategory>(`/admin/categories/${id}`, "PATCH", input),
  deleteCategory: (id: number) => json<void>(`/admin/categories/${id}`, "DELETE"),

  // promotions
  listPromotions: (params: PageParams = {}) => apiFetch<Paginated<ApiPromotion>>(`/admin/promotions${buildQuery(params)}`),
  getPromotion: (id: number) => apiFetch<ApiPromotion>(`/admin/promotions/${id}`),
  createPromotion: (input: PromotionInput) => json<ApiPromotion>("/admin/promotions", "POST", input),
  updatePromotion: (id: number, input: Partial<PromotionInput>) => json<ApiPromotion>(`/admin/promotions/${id}`, "PATCH", input),
  deletePromotion: (id: number) => json<void>(`/admin/promotions/${id}`, "DELETE"),

  // content
  listContentBlocks: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<AdminContentBlock>>(`/admin/content/blocks${buildQuery(params)}`),
  createContentBlock: (input: ContentBlockInput) => json<AdminContentBlock>("/admin/content/blocks", "POST", input),
  updateContentBlock: (id: number, input: Partial<ContentBlockInput>) =>
    json<AdminContentBlock>(`/admin/content/blocks/${id}`, "PATCH", input),
  deleteContentBlock: (id: number) => json<void>(`/admin/content/blocks/${id}`, "DELETE"),
  listPosts: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<AdminPost>>(`/admin/content/posts${buildQuery(params)}`),
  getPost: (id: number) => apiFetch<AdminPost>(`/admin/content/posts/${id}`),
  listPostCategories: () => apiFetch<ApiPostCategory[]>("/admin/content/posts/categories"),
  createPost: (input: PostInput) => json<AdminPost>("/admin/content/posts", "POST", input),
  updatePost: (id: number, input: Partial<PostInput>) => json<AdminPost>(`/admin/content/posts/${id}`, "PATCH", input),
  deletePost: (id: number) => json<void>(`/admin/content/posts/${id}`, "DELETE"),
  setPostStatus: (id: number, status: AdminPost["status"]) =>
    json<AdminPost>(`/admin/content/posts/${id}/status/${status}`, "PATCH"),
  listPages: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<ApiPage>>(`/admin/content/pages${buildQuery(params)}`),

  // support
  listTickets: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<AdminTicket>>(`/admin/support/tickets${buildQuery(params)}`),
  getTicket: (id: number) => apiFetch<AdminTicket>(`/admin/support/tickets/${id}`),
  updateTicket: (id: number, input: { status?: AdminTicket["status"]; priority?: AdminTicket["priority"] }) =>
    json<AdminTicket>(`/admin/support/tickets/${id}`, "PATCH", input),
  replyTicket: (id: number, body: string, isInternal = false) =>
    json<AdminTicket>(`/admin/support/tickets/${id}/messages`, "POST", { body, isInternal }),

  // reviews
  listReviews: (params: PageParams & { status?: string } = {}) =>
    apiFetch<Paginated<AdminReview>>(`/admin/reviews${buildQuery(params)}`),
  setReviewStatus: (id: number, status: "pending" | "approved" | "rejected") =>
    json<ApiReview>(`/admin/reviews/${id}/status`, "PATCH", { status }),

  // reports & settings
  listReports: (params: PageParams = {}) => apiFetch<Paginated<AdminReport>>(`/admin/reports${buildQuery(params)}`),
  reportKinds: () => apiFetch<Record<string, string>>("/admin/reports/kinds"),
  generateReport: (input: { kind: string; periodStart: string; periodEnd: string; name?: string }) =>
    json<AdminReport>("/admin/reports", "POST", input),
  listSettings: () => apiFetch<AdminSetting[]>("/admin/settings"),
  updateSetting: (key: string, input: { value: unknown; description?: string; isPublic?: boolean }) =>
    json<AdminSetting>(`/admin/settings/${encodeURIComponent(key)}`, "PUT", input),
};
