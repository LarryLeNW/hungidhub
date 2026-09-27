"use client";

import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  type AdminCategory,
  type AdminContentBlock,
  type AdminCustomer,
  type AdminInventoryRow,
  type AdminNotification,
  type AdminPost,
  type AdminProduct,
  type AdminReport,
  type AdminReview,
  type AdminSetting,
  type AdminStats,
  type AdminTicket,
  type AdminTransaction,
  type AdminVariant,
  type ApiPromotion,
} from "@/lib/api/admin";
import { orderStatusLabels, paymentMethodLabels, type ApiOrder } from "@/lib/api/orders";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";

export type AdminSection =
  | "overview"
  | "traffic"
  | "orders"
  | "products"
  | "inventory"
  | "customers"
  | "transactions"
  | "categories"
  | "promotions"
  | "content"
  | "posts"
  | "support"
  | "reviews"
  | "reports"
  | "settings";

export type ModuleSection = Exclude<AdminSection, "overview" | "traffic">;

/** Sections handed over in this release; every other section shows a "Đang hoàn thiện" placeholder. */
export const RELEASED_SECTIONS: readonly AdminSection[] = [
  "overview",
  "traffic",
  "orders",
  "products",
  "inventory",
  "customers",
  "categories",
  "promotions",
  "content",
  "posts",
  "support",
  "reviews",
  "settings",
];

export function isReleased(section: AdminSection) {
  return RELEASED_SECTIONS.includes(section);
}

/**
 * Table row: visible columns are plain strings; `_ref`/`_status`/`_action` are hidden helpers
 * (backend id, raw status, label of the quick action available for this row).
 */
export type DataRow = Record<string, string> & { id: string };

// ----------------------------------------------------------------- label maps

const promotionStatusLabels: Record<ApiPromotion["status"], string> = {
  scheduled: "Đã lên lịch",
  active: "Đang chạy",
  paused: "Tạm dừng",
  ended: "Đã kết thúc",
};

const transactionTypeLabels: Record<AdminTransaction["type"], string> = {
  payment: "Thanh toán",
  deposit: "Nạp tiền",
  withdrawal: "Rút tiền",
  refund: "Hoàn tiền",
  adjustment: "Điều chỉnh",
};

const channelLabels: Record<AdminTransaction["channel"], string> = {
  wallet: "Số dư IDHUB",
  bank_transfer: "Chuyển khoản",
  zalo: "Zalo",
  manual: "Thủ công",
};

const transactionStatusLabels: Record<AdminTransaction["status"], string> = {
  pending: "Đang xử lý",
  success: "Thành công",
  failed: "Thất bại",
};

const publishLabels: Record<AdminContentBlock["status"], string> = {
  draft: "Bản nháp",
  published: "Đang hiển thị",
  archived: "Đã lưu trữ",
};

const placementLabels: Record<string, string> = {
  home: "Trang chủ",
  global: "Toàn hệ thống",
  help_center: "Trung tâm trợ giúp",
  category: "Trang danh mục",
  product: "Trang sản phẩm",
};

const ticketStatusLabels: Record<AdminTicket["status"], string> = {
  new: "Mới",
  in_progress: "Đang xử lý",
  waiting_customer: "Chờ phản hồi",
  resolved: "Đã giải quyết",
  closed: "Đã đóng",
};

const priorityLabels: Record<AdminTicket["priority"], string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

const reportStatusLabels: Record<AdminReport["status"], string> = {
  generating: "Đang tạo",
  ready: "Sẵn sàng",
  failed: "Lỗi",
};

const settingGroupLabels: Record<AdminSetting["group"], string> = {
  store: "Thông tin cửa hàng",
  payment: "Thanh toán",
  roles: "Vai trò & phân quyền",
  notifications: "Thông báo",
  integrations: "API & tích hợp",
};

// ------------------------------------------------------------------- mappers

export function orderToRow(order: ApiOrder): DataRow {
  return {
    id: `#${order.code}`,
    _ref: String(order.id),
    _status: order.status,
    _action:
      order.status === "pending_payment"
        ? "Xác nhận đã thanh toán"
        : order.status === "processing"
          ? "Hoàn tất & giao hàng"
          : "",
    customer: order.customerName,
    product: order.items
      .map((item) => [item.productName, item.durationLabel].filter(Boolean).join(" - "))
      .join(", "),
    value: formatCurrency(order.total),
    method: paymentMethodLabels[order.paymentMethod],
    status: orderStatusLabels[order.status],
    date: timeAgo(order.createdAt),
  };
}

function productToRow(product: AdminProduct): DataRow {
  const available = product.variants.reduce((sum, variant) => sum + variant.stock.available, 0);
  const cheapest = product.variants.reduce<AdminVariant | undefined>(
    (best, variant) => (!best || variant.price < best.price ? variant : best),
    undefined,
  );
  const hasAutoStock = product.variants.some((variant) => variant.deliveryType === "auto");
  const status =
    product.status === "hidden"
      ? "Ẩn"
      : product.status === "draft"
        ? "Nháp"
        : hasAutoStock && available === 0
          ? "Hết hàng"
          : hasAutoStock && available < product.lowStockThreshold
            ? "Sắp hết"
            : "Đang bán";
  return {
    id: `SP-${product.id}`,
    _ref: String(product.id),
    _status: product.status,
    _action: product.status === "active" ? "Ẩn khỏi cửa hàng" : "Đăng bán",
    name: product.name,
    category: product.categories.map((category) => category.name).join(", ") || "—",
    // Cheapest variant: "giá gốc" (regular/list price) vs "giá bán" (what the customer pays).
    regularPrice: cheapest?.regularPrice ? formatCurrency(cheapest.regularPrice) : "—",
    price: cheapest ? formatCurrency(cheapest.price) : "—",
    variants: String(product.variants.length),
    stock: hasAutoStock ? String(available) : "Giao tay",
    status,
  };
}

function inventoryToRow(row: AdminInventoryRow): DataRow {
  const status =
    row.deliveryType === "manual"
      ? "Giao tay"
      : row.available === 0
        ? "Hết hàng"
        : row.available < row.lowStockThreshold
          ? "Sắp hết"
          : "Ổn định";
  return {
    id: row.sku,
    _ref: String(row.id),
    name: `${row.productName} · ${row.name}`,
    available: row.deliveryType === "manual" ? "—" : String(row.available),
    reserved: row.deliveryType === "manual" ? "—" : String(row.reserved),
    delivered: String(row.delivered),
    updated: row.lastMovementAt ? timeAgo(row.lastMovementAt) : "Chưa nhập",
    status,
  };
}

function customerToRow(user: AdminCustomer): DataRow {
  const isNew = Date.now() - new Date(user.createdAt).getTime() < 7 * 86_400_000;
  return {
    id: `KH-${user.id}`,
    _ref: String(user.id),
    _status: user.isActive ? "active" : "locked",
    _action: user.isActive ? "Tạm khóa tài khoản" : "Mở khóa tài khoản",
    name: user.fullName,
    email: user.email,
    orders: String(user.orderCount ?? 0),
    spend: formatCurrency(user.totalSpent ?? 0),
    status: !user.isActive ? "Tạm khóa" : isNew ? "Mới" : "Hoạt động",
  };
}

function transactionToRow(transaction: AdminTransaction): DataRow {
  const user = transaction.wallet?.user;
  return {
    id: transaction.code,
    _ref: String(transaction.id),
    type: transactionTypeLabels[transaction.type],
    account: user?.fullName ?? user?.email ?? "—",
    value: `${transaction.amount > 0 ? "+" : "−"}${formatCurrency(Math.abs(transaction.amount))}`,
    method: channelLabels[transaction.channel],
    status: transactionStatusLabels[transaction.status],
    date: timeAgo(transaction.createdAt),
  };
}

function flattenCategories(nodes: AdminCategory[], depth = 0): DataRow[] {
  return nodes.flatMap((node) => [
    {
      id: `DM-${node.id}`,
      _ref: String(node.id),
      _status: node.isVisible ? "visible" : "hidden",
      _action: node.isVisible ? "Ẩn danh mục" : "Hiển thị danh mục",
      name: `${"— ".repeat(depth)}${node.name}`,
      path: `/${node.path}`,
      products: String(node.productCount ?? 0),
      order: String(node.sortOrder).padStart(2, "0"),
      status: node.isVisible ? "Hiển thị" : "Ẩn",
    },
    ...flattenCategories(node.children ?? [], depth + 1),
  ]);
}

function promotionToRow(promotion: ApiPromotion): DataRow {
  return {
    id: promotion.name,
    _ref: String(promotion.id),
    _status: promotion.status,
    _action:
      promotion.status === "active"
        ? "Tạm dừng"
        : promotion.status === "paused" || promotion.status === "scheduled"
          ? "Kích hoạt"
          : "",
    code: promotion.code,
    discount: promotion.type === "percent" ? `${promotion.value}%` : formatCurrency(promotion.value),
    uses: `${promotion.usageCount} / ${promotion.usageLimit ?? "∞"}`,
    end: promotion.endsAt ? formatDateTime(promotion.endsAt) : "Không giới hạn",
    status: promotionStatusLabels[promotion.status],
  };
}

function contentBlockToRow(block: AdminContentBlock): DataRow {
  return {
    id: `ND-${block.id}`,
    _ref: String(block.id),
    _status: block.status,
    _action: block.status === "published" ? "Gỡ xuống" : "Đăng lên",
    title: block.title,
    channel: placementLabels[block.placement] ?? block.placement,
    updated: formatDateTime(block.updatedAt),
    owner: block.updatedBy?.fullName ?? "Hệ thống",
    status: publishLabels[block.status],
  };
}

function postToRow(post: AdminPost): DataRow {
  return {
    id: `BV-${post.id}`,
    _ref: String(post.id),
    _status: post.status,
    _action: post.status === "published" ? "Gỡ bài" : "Đăng bài",
    title: post.title,
    category: post.categories.map((category) => category.name).join(", ") || "—",
    author: post.author?.fullName ?? "Hệ thống",
    views: String(post.viewCount),
    updated: formatDateTime(post.updatedAt),
    status: publishLabels[post.status],
  };
}

function ticketToRow(ticket: AdminTicket): DataRow {
  return {
    id: ticket.code,
    _ref: String(ticket.id),
    _status: ticket.status,
    _action: ticket.status === "closed" ? "" : "Đóng phiếu",
    customer: ticket.customerName,
    subject: ticket.subject,
    priority: priorityLabels[ticket.priority],
    updated: timeAgo(ticket.updatedAt),
    status: ticketStatusLabels[ticket.status],
  };
}

const reviewStatusLabels: Record<AdminReview["status"], string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

function reviewToRow(review: AdminReview): DataRow {
  return {
    id: `DG-${review.id}`,
    _ref: String(review.id),
    _status: review.status,
    _action: review.status === "approved" ? "Gỡ đánh giá" : "Duyệt đánh giá",
    product: review.product?.name ?? "—",
    author: review.authorName,
    rating: `${"★".repeat(review.rating)} (${review.rating}/5)`,
    content: review.content,
    created: timeAgo(review.createdAt),
    status: reviewStatusLabels[review.status],
  };
}

function reportToRow(report: AdminReport): DataRow {
  const rows = Array.isArray(report.params?.result) ? (report.params?.result as unknown[]).length : 0;
  return {
    id: report.name,
    _ref: String(report.id),
    period: report.periodLabel,
    owner: report.createdBy?.fullName ?? "Hệ thống",
    updated: timeAgo(report.updatedAt),
    format: report.format === "dashboard" ? `Dashboard (${rows} dòng)` : report.format.toUpperCase(),
    status: reportStatusLabels[report.status],
  };
}

function settingToRow(setting: AdminSetting): DataRow {
  const preview =
    typeof setting.value === "string" || typeof setting.value === "number"
      ? String(setting.value)
      : Array.isArray(setting.value)
        ? `${setting.value.length} mục`
        : setting.value && typeof setting.value === "object"
          ? `${Object.keys(setting.value).length} trường`
          : "—";
  return {
    id: setting.key,
    _ref: String(setting.id),
    description: setting.description ?? "—",
    group: settingGroupLabels[setting.group],
    value: preview,
    updated: formatDateTime(setting.updatedAt),
    status: setting.isPublic ? "Công khai" : "Nội bộ",
  };
}

async function fetchRows(section: ModuleSection): Promise<DataRow[]> {
  switch (section) {
    case "orders":
      return (await adminApi.listOrders({ limit: 100 })).items.map(orderToRow);
    case "products":
      return (await adminApi.listProducts({ limit: 100 })).items.map(productToRow);
    case "inventory":
      return (await adminApi.listInventory({ limit: 100 })).items.map(inventoryToRow);
    case "customers":
      return (await adminApi.listUsers({ limit: 100, role: "customer" })).items.map(customerToRow);
    case "transactions":
      return (await adminApi.listTransactions({ limit: 100 })).items.map(transactionToRow);
    case "categories":
      return flattenCategories(await adminApi.listCategories());
    case "promotions":
      return (await adminApi.listPromotions({ limit: 100 })).items.map(promotionToRow);
    case "content":
      return (await adminApi.listContentBlocks({ limit: 100 })).items.map(contentBlockToRow);
    case "posts":
      return (await adminApi.listPosts({ limit: 100 })).items.map(postToRow);
    case "support":
      return (await adminApi.listTickets({ limit: 100 })).items.map(ticketToRow);
    case "reviews":
      return (await adminApi.listReviews({ limit: 100 })).items.map(reviewToRow);
    case "reports":
      return (await adminApi.listReports({ limit: 100 })).items.map(reportToRow);
    case "settings":
      return (await adminApi.listSettings()).map(settingToRow);
  }
}

/**
 * Executes the row's quick action (`_action`) against the API. Returns a toast message.
 * Orders are handled by the dashboard itself because completion may need delivery notes.
 */
export async function runRowAction(section: ModuleSection, row: DataRow): Promise<string> {
  const id = Number(row._ref);
  switch (section) {
    case "products": {
      const next = row._status === "active" ? "hidden" : "active";
      await adminApi.setProductStatus(id, next);
      return next === "active" ? `${row.name} đã được đăng bán.` : `${row.name} đã ẩn khỏi cửa hàng.`;
    }
    case "customers": {
      const nextActive = row._status !== "active";
      await adminApi.setUserStatus(id, nextActive);
      return nextActive ? `${row.name} đã được mở khóa.` : `${row.name} đã bị tạm khóa.`;
    }
    case "categories": {
      const nextVisible = row._status !== "visible";
      await adminApi.updateCategory(id, { isVisible: nextVisible });
      return nextVisible ? `Danh mục đã hiển thị.` : `Danh mục đã ẩn.`;
    }
    case "promotions": {
      const next = row._status === "active" ? "paused" : "active";
      await adminApi.updatePromotion(id, { status: next });
      return next === "active" ? `Mã ${row.code} đang chạy.` : `Mã ${row.code} đã tạm dừng.`;
    }
    case "content": {
      const next = row._status === "published" ? "draft" : "published";
      await adminApi.updateContentBlock(id, { status: next });
      return next === "published" ? `"${row.title}" đang hiển thị.` : `"${row.title}" đã gỡ xuống.`;
    }
    case "posts": {
      const next = row._status === "published" ? "draft" : "published";
      await adminApi.setPostStatus(id, next);
      return next === "published" ? `“${row.title}” đã được đăng.` : `“${row.title}” đã gỡ xuống.`;
    }
    case "support":
      await adminApi.updateTicket(id, { status: "closed" });
      return `${row.id} đã đóng.`;
    case "reviews": {
      const next = row._status === "approved" ? "rejected" : "approved";
      await adminApi.setReviewStatus(id, next);
      return next === "approved" ? `Đánh giá của ${row.author} đã hiển thị.` : `Đánh giá của ${row.author} đã gỡ.`;
    }
    default:
      return "Mục này không có thao tác nhanh.";
  }
}

// --------------------------------------------------------------------- hooks

export type AdminRowsState = {
  rows: DataRow[] | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/** Loads the table rows for a module section from the API. */
export function useAdminModuleRows(section: AdminSection): AdminRowsState {
  const [rows, setRows] = useState<DataRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (section === "overview" || section === "traffic") return;
    setLoading(true);
    try {
      setRows(await fetchRows(section));
      setError(null);
    } catch (caught) {
      setRows(null);
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu từ máy chủ.");
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  return { rows, loading, error, refresh };
}

/** Overview numbers + sidebar badges, refreshed every 60s. */
export function useAdminStats(enabled = true) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStats(await adminApi.stats());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được thống kê.");
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [enabled, refresh]);

  return { stats, error, refresh };
}

/** Latest orders for the overview table. */
export function useRecentOrders(enabled: boolean) {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = window.setTimeout(() => {
      adminApi
        .listOrders({ limit: 5 })
        .then((page) => {
          if (active) setOrders(page.items);
        })
        .catch(() => {
          if (active) setOrders([]);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [enabled]);
  return orders;
}

/** Bell notifications from the API with read state persisted server-side. */
export function useAdminNotifications() {
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const result = await adminApi.notifications();
      setItems(result.items);
      setUnreadCount(result.unreadCount);
    } catch {
      // keep whatever we had
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const markRead = useCallback(async (id: number) => {
    setItems((current) =>
      current.map((item) => (item.id === id && !item.readAt ? { ...item, readAt: new Date().toISOString() } : item)),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
    try {
      await adminApi.markNotificationRead(id);
    } catch {
      // best effort
    }
  }, []);

  const markAllRead = useCallback(async () => {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await adminApi.markAllNotificationsRead();
    } catch {
      // best effort
    }
  }, []);

  return { items, unreadCount, refresh, markRead, markAllRead };
}

const TOAST_KEY = "aihub-admin-toast";

/** Queue a toast to be shown by the next dashboard mount (survives `router.push`). */
export function queueToast(message: string) {
  try {
    window.sessionStorage.setItem(TOAST_KEY, message);
  } catch {
    // storage unavailable – the toast is simply skipped
  }
}

export function takeQueuedToast(): string | null {
  try {
    const message = window.sessionStorage.getItem(TOAST_KEY);
    if (message) window.sessionStorage.removeItem(TOAST_KEY);
    return message;
  } catch {
    return null;
  }
}

export function sectionForNotification(notification: AdminNotification): AdminSection {
  const section = notification.section as string | null;
  if (section === "deposits") return "overview";
  return (section as AdminSection | null) ?? "overview";
}
