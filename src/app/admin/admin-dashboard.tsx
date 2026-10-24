"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Construction,
  ExternalLink,
  Eye,
  FileDown,
  FileText,
  FileUp,
  Headphones,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Star,
  Tags,
  Users,
  WalletCards,
  Warehouse,
  X,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { IdhubLogo } from "@/components/Idhub-logo";
import { useAuth } from "@/components/auth/auth-provider";
import { refundMethodLabels, refundStatusLabels, type ApiRefundRequest } from "@/lib/api/refunds";
import { adminApi, type AdminNotification, type AdminStats, type AdminReport, type ApiFundRequest, type ImportExcelResult } from "@/lib/api/admin";
import { confirmAction, confirmDanger, promptText } from "./forms/dialogs";
import { roleLabels } from "@/lib/api/auth";
import { formatDateTime, timeAgo } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { CategoryForm } from "./forms/category-form";
import { ContentBlockForm } from "./forms/content-block-form";
import { BlogPostForm } from "./forms/blog-post-form";
import { CustomerDetail } from "./forms/customer-detail";
import { useDialogBehavior } from "./forms/modal";
import { OrderDetail } from "./forms/order-detail";
import { ProductEditor } from "./forms/product-editor";
import { PromotionForm } from "./forms/promotion-form";
import { SettingForm } from "./forms/setting-form";
import { TicketDetail } from "./forms/ticket-detail";
import {
  orderToRow,
  fundRequestStatusLabels,
  fundRequestTypeLabels,
  reportStatusLabels,
  isReleased,
  runRowAction,
  sectionForNotification,
  takeQueuedToast,
  useAdminModuleRows,
  useAdminNotifications,
  useAdminStats,
  type AdminSection,
  type DataRow,
  type ModuleSection,
} from "./admin-data";
import styles from "./admin.module.css";

export type { AdminSection } from "./admin-data";

type ModuleId = AdminSection;

type ModuleDefinition = {
  title: string;
  description: string;
  icon: LucideIcon;
  createLabel?: string;
  columns: { key: string; label: string }[];
};

const navGroups: { label: string; items: { id: ModuleId; label: string; icon: LucideIcon; badge?: keyof AdminStats["badges"] }[] }[] = [
  {
    label: "Tổng quan",
    items: [{ id: "overview", label: "Bảng điều khiển", icon: LayoutDashboard }],
  },
  {
    label: "Vận hành",
    items: [
      { id: "orders", label: "Đơn hàng", icon: ShoppingCart, badge: "orders" },
      { id: "products", label: "Sản phẩm", icon: Package },
      { id: "categories", label: "Danh mục", icon: Tags },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { id: "funds", label: "Nạp tiền ví", icon: ArrowDownCircle, badge: "deposits" },
      { id: "refunds", label: "Yêu cầu hoàn tiền", icon: RotateCcw, badge: "refunds" },
      { id: "transactions", label: "Sổ cái giao dịch", icon: WalletCards },

    ],
  },
  {
    label: "Tài khoản",
    items: [{ id: "customers", label: "Khách hàng", icon: Users }],
  },
  {
    label: "Tăng trưởng",
    items: [
      { id: "traffic", label: "Traffic", icon: BarChart3 },
      { id: "posts", label: "Blog", icon: FileText },
      { id: "content", label: "Banner", icon: SlidersHorizontal },
      { id: "reviews", label: "Đánh giá", icon: Star },
    ],
  },
];

/** System modules live in the profile dropdown (topbar) instead of the sidebar. */
const profileMenuItems: { id: ModuleId; label: string; icon: LucideIcon; badge?: keyof AdminStats["badges"]; hidden?: boolean }[] = [
  // Ẩn theo yêu cầu (01/09/2026) — bỏ `hidden` để mở lại; /admin/settings vẫn truy cập được qua URL.
  { id: "settings", label: "Cài đặt", icon: Settings, hidden: true },
];

/** Column layout per module; rows come from `admin-data.ts` (API). */
const moduleDefinitions: Record<ModuleSection, ModuleDefinition> = {
  orders: {
    title: "Quản lý đơn hàng",
    description: "Theo dõi, xác nhận thanh toán và giao hàng cho toàn bộ đơn.",
    icon: ShoppingCart,
    columns: [
      { key: "id", label: "Mã đơn" },
      { key: "customer", label: "Khách hàng" },
      { key: "product", label: "Sản phẩm" },
      { key: "value", label: "Giá trị" },
      { key: "method", label: "Thanh toán" },
      { key: "status", label: "Trạng thái" },
      { key: "date", label: "Thời gian" },
    ],
  },
  products: {
    title: "Quản lý sản phẩm",
    description: "Giá gốc / giá bán của gói rẻ nhất, số gói, tồn kho tự động và trạng thái hiển thị.",
    icon: Package,
    createLabel: "Thêm sản phẩm",
    columns: [
      { key: "id", label: "Mã SP" },
      { key: "name", label: "Tên sản phẩm" },
      { key: "category", label: "Danh mục" },
      { key: "regularPrice", label: "Giá gốc" },
      { key: "price", label: "Giá bán" },
      { key: "variants", label: "Số gói" },
      { key: "stock", label: "Tồn kho" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  inventory: {
    title: "Quản lý kho hàng",
    description: "Từng SKU: số suất khả dụng, đang giữ, đã giao và lần nhập kho gần nhất.",
    icon: Warehouse,
    columns: [
      { key: "id", label: "SKU" },
      { key: "name", label: "Sản phẩm · Gói" },
      { key: "available", label: "Khả dụng" },
      { key: "reserved", label: "Đang giữ" },
      { key: "delivered", label: "Đã giao" },
      { key: "updated", label: "Cập nhật" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  customers: {
    title: "Quản lý khách hàng",
    description: "Tài khoản khách, số đơn đã thanh toán và tổng chi tiêu.",
    icon: Users,
    columns: [
      { key: "id", label: "Mã KH" },
      { key: "name", label: "Khách hàng" },
      { key: "email", label: "Email" },
      { key: "orders", label: "Đơn hàng" },
      { key: "spend", label: "Tổng chi" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  funds: {
    title: "Yêu cầu nạp tiền",
    description: "Danh sách và duyệt các yêu cầu nạp tiền vào ví của khách hàng.",
    icon: ArrowDownCircle,
    columns: [
      { key: "id", label: "Mã YC" },
      { key: "type", label: "Loại" },
      { key: "account", label: "Khách hàng" },
      { key: "amount", label: "Số tiền" },
      { key: "bank", label: "Ngân hàng / STK" },
      { key: "note", label: "Ghi chú" },
      { key: "status", label: "Trạng thái" },
      { key: "date", label: "Thời gian" },
    ],
  },
  refunds: {
    title: "Yêu cầu hoàn tiền",
    description: "Danh sách và duyệt các yêu cầu hoàn tiền đơn hàng từ khách hàng.",
    icon: RotateCcw,
    columns: [
      { key: "id", label: "Mã YC" },
      { key: "order", label: "Đơn hàng" },
      { key: "account", label: "Khách hàng" },
      { key: "amount", label: "Số tiền" },
      { key: "method", label: "Hình thức" },
      { key: "reason", label: "Lý do" },
      { key: "status", label: "Trạng thái" },
      { key: "date", label: "Thời gian" },
    ],
  },
  transactions: {
    title: "Quản lý giao dịch",
    description: "Sổ cái ví Idhub: thanh toán, nạp, rút, hoàn tiền và điều chỉnh.",
    icon: WalletCards,
    columns: [
      { key: "id", label: "Mã GD" },
      { key: "type", label: "Loại" },
      { key: "account", label: "Tài khoản" },
      { key: "value", label: "Số tiền" },
      { key: "method", label: "Phương thức" },
      { key: "status", label: "Trạng thái" },
      { key: "date", label: "Thời gian" },
    ],
  },
  categories: {
    title: "Quản lý danh mục",
    description: "Cây danh mục, số sản phẩm và thứ tự hiển thị trên cửa hàng.",
    icon: Tags,
    createLabel: "Thêm danh mục",
    columns: [
      { key: "id", label: "Mã" },
      { key: "name", label: "Danh mục" },
      { key: "path", label: "Đường dẫn" },
      { key: "products", label: "Sản phẩm" },
      { key: "order", label: "Thứ tự" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  promotions: {
    title: "Quản lý khuyến mãi",
    description: "Mã giảm giá, lượt dùng và lịch chạy chiến dịch.",
    icon: Megaphone,
    createLabel: "Tạo khuyến mãi",
    columns: [
      { key: "id", label: "Chiến dịch" },
      { key: "code", label: "Mã" },
      { key: "discount", label: "Ưu đãi" },
      { key: "uses", label: "Lượt dùng" },
      { key: "end", label: "Kết thúc" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  content: {
    title: "Quản lý Banner",
    description: "Banner, thông báo hệ thống và bài trợ giúp trên cửa hàng.",
    icon: SlidersHorizontal,
    createLabel: "Tạo Banner",
    columns: [
      { key: "id", label: "Mã" },
      { key: "title", label: "Nội dung" },
      { key: "channel", label: "Vị trí" },
      { key: "updated", label: "Cập nhật" },
      { key: "owner", label: "Người sửa" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  posts: {
    title: "Quản lý blog",
    description: "Tạo, biên tập và xuất bản bài viết trên cửa hàng.",
    icon: FileText,
    createLabel: "Tạo bài viết",
    columns: [
      { key: "id", label: "Mã" },
      { key: "title", label: "Tiêu đề" },
      { key: "category", label: "Chuyên mục" },
      { key: "author", label: "Tác giả" },
      { key: "views", label: "Lượt xem" },
      { key: "updated", label: "Cập nhật" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  support: {
    title: "Trung tâm hỗ trợ",
    description: "Phiếu hỗ trợ, khiếu nại và tranh chấp giao dịch của khách.",
    icon: Headphones,
    columns: [
      { key: "id", label: "Mã phiếu" },
      { key: "customer", label: "Khách hàng" },
      { key: "subject", label: "Nội dung" },
      { key: "priority", label: "Ưu tiên" },
      { key: "updated", label: "Cập nhật" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  reviews: {
    title: "Đánh giá sản phẩm",
    description: "Kiểm duyệt đánh giá khách gửi; duyệt xong điểm sao của sản phẩm được tính lại.",
    icon: Star,
    columns: [
      { key: "id", label: "Mã" },
      { key: "product", label: "Sản phẩm" },
      { key: "author", label: "Người viết" },
      { key: "rating", label: "Sao" },
      { key: "content", label: "Nội dung" },
      { key: "created", label: "Gửi lúc" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  reports: {
    title: "Báo cáo & phân tích",
    description: "Tổng hợp doanh thu theo sản phẩm/danh mục, tỷ lệ hoàn tiền, khách hàng.",
    icon: BarChart3,
    createLabel: "Tạo báo cáo",
    columns: [
      { key: "id", label: "Báo cáo" },
      { key: "period", label: "Kỳ dữ liệu" },
      { key: "owner", label: "Người tạo" },
      { key: "updated", label: "Cập nhật" },
      { key: "format", label: "Định dạng" },
      { key: "status", label: "Trạng thái" },
    ],
  },
  settings: {
    title: "Cài đặt hệ thống",
    description: "Cấu hình cửa hàng, thanh toán, thông báo và tích hợp (lưu trong bảng settings).",
    icon: Settings,
    columns: [
      { key: "id", label: "Khóa" },
      { key: "description", label: "Mô tả" },
      { key: "group", label: "Nhóm" },
      { key: "value", label: "Giá trị" },
      { key: "updated", label: "Cập nhật" },
      { key: "status", label: "Phạm vi" },
    ],
  },
};

const REPORT_KINDS: Record<string, string> = {
  revenue_by_product: "Doanh thu theo sản phẩm",
  revenue_by_category: "Doanh thu theo danh mục",
  refund_rate: "Tỷ lệ hoàn tiền",
  customers: "Khách hàng mới & chi tiêu",
};

const notificationIcons: Record<string, LucideIcon> = {
  orders: ShoppingCart,
  inventory: AlertTriangle,
  support: Headphones,
  customers: Users,
  transactions: RefreshCw,
};

const statusTone = (status: string) => {
  if (/hoàn tất|thành công|đang bán|ổn định|hoạt động|hiển thị|đang chạy|sẵn sàng|công khai|đã giải quyết|đã duyệt/i.test(status)) return "success";
  if (/đang xử lý|chờ|sắp hết|mới|đã lên lịch|đang tạo|bản nháp|tạm dừng|nháp|giao tay|nội bộ/i.test(status)) return "warning";
  if (/hủy|hết hàng|tạm khóa|hoàn tiền|đã kết thúc|đã đóng|ẩn|từ chối|thất bại|lỗi|lưu trữ/i.test(status)) return "danger";
  return "neutral";
};

function StatusBadge({ children }: { children: string }) {
  return <span className={`${styles.status} ${styles[statusTone(children)]}`}>{children}</span>;
}

function AdminSidebar({
  active,
  open,
  badges,
  onSelect,
  onClose,
  onLogout,
}: {
  active: ModuleId;
  open: boolean;
  badges: AdminStats["badges"] | null;
  onSelect: (id: ModuleId) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <button className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`} onClick={onClose} aria-label="Đóng menu" />
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <IdhubLogo href="/admin" size="sm" admin />
          <button className={styles.closeMenu} onClick={onClose} aria-label="Đóng menu"><X size={20} /></button>
        </div>
        <nav className={styles.nav} aria-label="Điều hướng quản trị">
          {navGroups.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const released = isReleased(item.id);
                const badge = released && item.badge && badges ? (badges[item.badge] ?? 0) : 0;
                return (
                  <button
                    key={item.id}
                    className={`${active === item.id ? styles.navActive : ""} ${released ? "" : styles.navPending}`}
                    onClick={() => { onSelect(item.id); onClose(); }}
                    disabled={!released}
                    title={released ? undefined : "Phân hệ này sẽ được bàn giao ở đợt tiếp theo"}
                    aria-current={active === item.id ? "page" : undefined}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                    {badge > 0 && <em>{badge > 99 ? "99+" : badge}</em>}
                    {!released && <em className={styles.navSoon}>Đang hoàn thiện</em>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.logoutButton} onClick={onLogout}><LogOut size={17} /> Đăng xuất</button>
        </div>
      </aside>
    </>
  );
}

function changeLabel(percent: number | null) {
  if (percent === null) return { text: "Hôm qua chưa có dữ liệu", positive: true };
  const sign = percent > 0 ? "+" : "";
  return { text: `${sign}${percent.toLocaleString("vi-VN")}%`, positive: percent >= 0 };
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}

/** Sections whose rows can be deleted from the table (soft delete server-side). */
const DELETABLE = new Set<ModuleId>(["products", "categories", "promotions", "content", "posts"]);

function PendingSection({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <section className={styles.pendingSection} aria-label={`${label} đang hoàn thiện`}>
      <span className={styles.pendingIcon}><Construction size={26} /></span>
      <h1>Đang hoàn thiện</h1>
      <p>Phân hệ <strong>{label}</strong> chưa nằm trong đợt bàn giao này và sẽ được mở ở đợt tiếp theo.</p>
      <button className={styles.primaryButton} onClick={onBack}><LayoutDashboard size={17} /> Về bảng điều khiển</button>
    </section>
  );
}

function Overview({
  stats,
  statsError,
  userName,
  onNavigate,
  onRefresh,
  onOpenProduct,
}: {
  stats: AdminStats | null;
  statsError: string | null;
  userName: string;
  onNavigate: (id: ModuleId) => void;
  onRefresh: () => void;
  onOpenProduct: (productId: number) => void;
}) {
  const today = new Date();
  const dateLabel = new Intl.DateTimeFormat("vi-VN", { day: "numeric", month: "long", year: "numeric" }).format(today);

  const statCards = stats
    ? [
        { label: "Doanh thu hôm nay", value: formatCurrency(stats.today.revenue), change: changeLabel(stats.today.revenueChangePercent), icon: CircleDollarSign, tone: "cyan" },
        { label: "Đơn thanh toán hôm nay", value: String(stats.today.orders), change: changeLabel(stats.today.ordersChangePercent), icon: ShoppingCart, tone: "blue" },
        { label: "Khách hàng mới", value: String(stats.today.newCustomers), change: changeLabel(stats.today.newCustomersChangePercent), icon: Users, tone: "green" },
        { label: "Tỷ lệ hoàn tiền (30 ngày)", value: `${stats.refundRatePercent.toLocaleString("vi-VN")}%`, change: { text: "trên tổng đơn 30 ngày", positive: stats.refundRatePercent < 5 }, icon: RefreshCw, tone: "amber" },
      ]
    : [];

  const chartMax = Math.max(1, ...(stats?.revenueByDay.map((day) => day.revenue) ?? [1]));
  const periodRevenue = stats?.revenueByDay.reduce((sum, day) => sum + day.revenue, 0) ?? 0;
  const periodOrders = stats?.revenueByDay.reduce((sum, day) => sum + day.orders, 0) ?? 0;
  const trafficMax = Math.max(1, ...(stats?.traffic.byDay.map((day) => day.views) ?? [1]));
  const deviceTotal = (stats?.traffic.devices.desktop ?? 0) + (stats?.traffic.devices.mobile ?? 0);
  const mobilePercent = deviceTotal ? Math.round(((stats?.traffic.devices.mobile ?? 0) / deviceTotal) * 100) : 0;

  const quickActions = [
    { label: "Thêm sản phẩm", detail: "Nhập kho, giá bán, biến thể", icon: Plus, id: "products" as ModuleId },
    { label: "Quản lý danh mục", detail: "Cây danh mục, thứ tự, icon menu", icon: Tags, id: "categories" as ModuleId },
    { label: "Hỗ trợ khách", detail: stats ? `${stats.badges.support} phiếu đang mở` : "…", icon: Headphones, id: "support" as ModuleId },
    { label: "Cài đặt cửa hàng", detail: "Thông tin liên hệ, thanh toán, trang chủ", icon: Settings, id: "settings" as ModuleId },
  ];

  const activityIcon: Record<AdminStats["recentActivity"][number]["type"], { icon: LucideIcon; tone: string }> = {
    order: { icon: ShoppingCart, tone: "cyan" },
    fund_request: { icon: CircleDollarSign, tone: "amber" },
    ticket: { icon: Headphones, tone: "danger" },
    customer: { icon: Users, tone: "blue" },
  };

  return (
    <div className={styles.overview}>
      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            <ShieldCheck size={15} /> {statsError ? "Không kết nối được máy chủ thống kê" : stats ? `Số liệu cập nhật ${timeAgo(stats.generatedAt)}` : "Đang tải số liệu…"}
          </span>
          <h1>{greeting()}, {userName}</h1>
          <p>Đây là tình hình hoạt động của Idhub hôm nay, {dateLabel}.</p>
        </div>
        <div className={styles.heroActions}>
          <button className={styles.secondaryButton} onClick={onRefresh}><RefreshCw size={17} /> Làm mới</button>
          <button className={styles.primaryButton} onClick={() => onNavigate("products")}><Plus size={17} /> Thêm sản phẩm</button>
        </div>
      </section>

      {statsError ? <p role="alert" className={styles.inlineAlert}>{statsError}</p> : null}

      <section className={styles.statsGrid} aria-label="Chỉ số kinh doanh">
        {statCards.length ? statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className={styles.statCard} key={stat.label}>
              <div className={`${styles.statIcon} ${styles[stat.tone]}`}><Icon size={20} /></div>
              <div className={styles.statMeta}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small className={stat.change.positive ? styles.up : styles.down}>
                  {stat.change.positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{stat.change.text}
                  {stat.change.text.endsWith("%") ? <i> so với hôm qua</i> : null}
                </small>
              </div>
            </article>
          );
        }) : Array.from({ length: 4 }).map((_, index) => (
          <article className={styles.statCard} key={index}>
            <div className={`${styles.statIcon} ${styles.blue}`}><LoaderCircle size={20} className="animate-spin" /></div>
            <div className={styles.statMeta}><span>Đang tải…</span><strong>—</strong></div>
          </article>
        ))}
      </section>

      <section className={styles.dashboardGrid}>
        <article className={`${styles.panel} ${styles.revenuePanel}`}>
          <div className={styles.panelHeader}>
            <div><h2>Doanh thu</h2><p>12 ngày gần nhất (đơn đã thanh toán)</p></div>
          </div>
          <div className={styles.revenueSummary}><strong>{formatCurrency(periodRevenue)}</strong><span>{periodOrders} đơn</span></div>
          <div className={styles.chart} aria-label="Biểu đồ doanh thu 12 ngày">
            <div className={styles.chartLines}><i /><i /><i /><i /></div>
            <div className={styles.bars}>
              {(stats?.revenueByDay ?? []).map((day) => (
                <span key={day.date} style={{ height: `${Math.max(2, Math.round((day.revenue / chartMax) * 100))}%` }} title={`${day.date}: ${formatCurrency(day.revenue)}`}>
                  <i>{formatCurrency(day.revenue)}</i>
                </span>
              ))}
            </div>
          </div>
          <div className={styles.chartLabels}>
            {(stats?.revenueByDay ?? []).map((day) => <span key={day.date}>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span>)}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.quickPanel}`}>
          <div className={styles.panelHeader}><div><h2>Thao tác nhanh</h2><p>Công việc thường dùng</p></div></div>
          <div className={styles.quickGrid}>
            {quickActions.map((action) => {
              const Icon = action.icon;
              return <button key={action.label} onClick={() => onNavigate(action.id)}><span><Icon size={18} /></span><div><strong>{action.label}</strong><small>{action.detail}</small></div><ChevronRight size={16} /></button>;
            })}
          </div>
        </article>
      </section>

      <section className={styles.lowerGrid}>
        <article className={`${styles.panel} ${styles.trafficPanel}`}>
          <div className={styles.panelHeader}>
            <div><h2>Traffic website</h2><p>Lượt truy cập trong 14 ngày gần nhất</p></div>
            <span className={styles.trafficLive}><i /> Đang ghi nhận</span>
          </div>
          <div className={styles.trafficSummary}>
            <div><span>Lượt xem hôm nay</span><strong>{stats?.traffic.today.views.toLocaleString("vi-VN") ?? "—"}</strong></div>
            <div><span>Khách hôm nay</span><strong>{stats?.traffic.today.visitors.toLocaleString("vi-VN") ?? "—"}</strong></div>
            <div><span>So với hôm qua</span><strong className={(stats?.traffic.today.changePercent ?? 0) >= 0 ? styles.up : styles.down}>{stats?.traffic.today.changePercent == null ? "Mới" : `${stats.traffic.today.changePercent >= 0 ? "+" : ""}${stats.traffic.today.changePercent}%`}</strong></div>
            <div><span>Thiết bị mobile</span><strong>{mobilePercent}%</strong></div>
          </div>
          <div className={styles.trafficBody}>
            <div className={styles.trafficChart} aria-label="Biểu đồ traffic 14 ngày">
              {(stats?.traffic.byDay ?? []).map((day) => (
                <div key={day.date}>
                  <span title={`${day.views} lượt xem · ${day.visitors} khách`} style={{ height: `${Math.max(3, Math.round((day.views / trafficMax) * 100))}%` }} />
                  <small>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</small>
                </div>
              ))}
            </div>
            <div className={styles.topPages}>
              <h3>Trang được xem nhiều</h3>
              {stats?.traffic.topPages.length ? stats.traffic.topPages.map((page, index) => (
                <div key={page.path}><span>{index + 1}</span><code>{page.path}</code><strong>{page.views.toLocaleString("vi-VN")}</strong></div>
              )) : <p className={styles.emptyNote}>{stats ? "Chưa có dữ liệu truy cập." : "Đang tải…"}</p>}
            </div>
          </div>
        </article>

        <div className={styles.sideStack}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Cảnh báo kho</h2><p>SKU giao tự động dưới ngưỡng</p></div><button className={styles.iconButton} onClick={() => onNavigate("products")} aria-label="Xem sản phẩm"><ChevronRight size={17} /></button></div>
            <div className={styles.alertList}>
              {stats?.lowStock.length ? stats.lowStock.map((item) => (
                <button key={item.variantId} onClick={() => onOpenProduct(item.productId)}>
                  <span className={styles[item.available === 0 ? "danger" : "warning"]}><AlertTriangle size={16} /></span>
                  <div><strong>{item.productName}</strong><small>{item.sku} · {item.available === 0 ? "Đã hết hàng" : `Còn ${item.available} / ngưỡng ${item.threshold}`}</small></div>
                  <ChevronRight size={15} />
                </button>
              )) : <p className={styles.emptyNote}>{stats ? "Không có SKU nào dưới ngưỡng." : "Đang tải…"}</p>}
            </div>
          </article>
          <article className={styles.panel}>
            <div className={styles.panelHeader}><div><h2>Hoạt động gần đây</h2><p>Đơn, hỗ trợ, khách mới</p></div></div>
            <div className={styles.activityList}>
              {stats?.recentActivity.length ? stats.recentActivity.map((item, index) => {
                const meta = activityIcon[item.type];
                const Icon = meta.icon;
                return (
                  <div key={`${item.type}-${index}`}><span className={styles[meta.tone]}><Icon size={15} /></span><p><strong>{item.title}</strong> {item.detail}<small>{timeAgo(item.at)}</small></p></div>
                );
              }) : <p className={styles.emptyNote}>{stats ? "Chưa có hoạt động nào." : "Đang tải…"}</p>}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function TrafficView({ stats, error, onRefresh }: { stats: AdminStats | null; error: string | null; onRefresh: () => void }) {
  const trafficMax = Math.max(1, ...(stats?.traffic.byDay.map((day) => day.views) ?? [1]));
  const devices = stats?.traffic.devices;
  const deviceTotal = (devices?.desktop ?? 0) + (devices?.mobile ?? 0);
  const mobilePercent = deviceTotal ? Math.round(((devices?.mobile ?? 0) / deviceTotal) * 100) : 0;

  return (
    <div>
      <section className={styles.pageTitle}>
        <div className={styles.titleIcon}><BarChart3 size={23} /></div>
        <div><h1>Thống kê traffic</h1><p>Theo dõi lượt xem, khách truy cập và các trang được quan tâm.</p></div>
        <div className={styles.pageActions}><button className={styles.secondaryButton} onClick={onRefresh}><RefreshCw size={16} /> Làm mới</button></div>
      </section>
      {error ? <p role="alert" className={styles.inlineAlert}>{error}</p> : null}
      <article className={`${styles.panel} ${styles.trafficPagePanel}`}>
        <div className={styles.panelHeader}>
          <div><h2>Traffic 14 ngày gần nhất</h2><p>Dữ liệu first-party từ storefront IDHUB</p></div>
          <span className={styles.trafficLive}><i /> Đang ghi nhận</span>
        </div>
        <div className={styles.trafficSummary}>
          <div><span>Lượt xem hôm nay</span><strong>{stats?.traffic.today.views.toLocaleString("vi-VN") ?? "—"}</strong></div>
          <div><span>Khách hôm nay</span><strong>{stats?.traffic.today.visitors.toLocaleString("vi-VN") ?? "—"}</strong></div>
          <div><span>So với hôm qua</span><strong className={(stats?.traffic.today.changePercent ?? 0) >= 0 ? styles.up : styles.down}>{stats?.traffic.today.changePercent == null ? "Mới" : `${stats.traffic.today.changePercent >= 0 ? "+" : ""}${stats.traffic.today.changePercent}%`}</strong></div>
          <div><span>Mobile / Desktop</span><strong>{mobilePercent}% / {100 - mobilePercent}%</strong></div>
        </div>
        <div className={styles.trafficBody}>
          <div className={styles.trafficChart} aria-label="Biểu đồ traffic 14 ngày">
            {(stats?.traffic.byDay ?? []).map((day) => (
              <div key={day.date}>
                <span title={`${day.views} lượt xem · ${day.visitors} khách`} style={{ height: `${Math.max(3, Math.round((day.views / trafficMax) * 100))}%` }} />
                <small>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</small>
              </div>
            ))}
          </div>
          <div className={styles.topPages}>
            <h3>Trang được xem nhiều</h3>
            {stats?.traffic.topPages.length ? stats.traffic.topPages.map((page, index) => (
              <div key={page.path}><span>{index + 1}</span><code>{page.path}</code><strong>{page.views.toLocaleString("vi-VN")}</strong></div>
            )) : <p className={styles.emptyNote}>{stats ? "Chưa có dữ liệu truy cập." : "Đang tải…"}</p>}
          </div>
        </div>
      </article>
    </div>
  );
}

function ManagementView({ definition, rows: allRows, loading, query, onQueryChange, onCreate, onInspect, onQuickUpdate, onDelete, onExportExcel, onImportExcel }: {
  definition: ModuleDefinition;
  rows: DataRow[];
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onCreate: () => void;
  onInspect: (row: DataRow) => void;
  onQuickUpdate: (row: DataRow) => void;
  onDelete?: (row: DataRow) => void;
  onExportExcel?: () => void;
  onImportExcel?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState("Tất cả trạng thái");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const pageSize = 10;
  const statuses = useMemo(() => ["Tất cả trạng thái", ...Array.from(new Set(allRows.map((row) => row.status)))], [allRows]);
  const filteredRows = useMemo(() => allRows.filter((row) => {
    const matchesQuery = Object.entries(row).some(([key, value]) => !key.startsWith("_") && value.toLowerCase().includes(query.toLowerCase()));
    const matchesStatus = statusFilter === "Tất cả trạng thái" || row.status === statusFilter;
    return matchesQuery && matchesStatus;
  }), [allRows, query, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const rows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const actionable = allRows.filter((row) => row._action).length;

  useEffect(() => {
    const closeMenu = (event: PointerEvent) => {
      if (!statusMenuRef.current?.contains(event.target as Node)) setStatusMenuOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setStatusMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const Icon = definition.icon;
  return (
    <div className={styles.management}>
      <section className={styles.pageTitle}>
        <div className={styles.titleIcon}><Icon size={23} /></div>
        <div><h1>{definition.title}</h1><p>{definition.description}</p></div>
        <div className={styles.pageActions}>
          {onExportExcel && (
            <button type="button" className={styles.secondaryButton} onClick={onExportExcel}>
              <FileDown size={16} /> Xuất Excel
            </button>
          )}
          {onImportExcel && (
            <button type="button" className={styles.secondaryButton} onClick={onImportExcel}>
              <FileUp size={16} /> Nhập Excel
            </button>
          )}
          {definition.createLabel && <button className={styles.primaryButton} onClick={onCreate}><Plus size={17} /> {definition.createLabel}</button>}
        </div>
      </section>

      <section className={styles.summaryStrip}>
        <div><span>Tổng dữ liệu</span><strong>{allRows.length}</strong></div>
        <div><span>Đang lọc</span><strong>{filteredRows.length}</strong></div>
        <div><span>Cần xử lý</span><strong className={styles.warningText}>{actionable}</strong></div>
        <div><span>Nguồn</span><strong>{loading ? "Đang tải…" : "Máy chủ"}</strong></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.toolbar}>
          <label className={styles.searchBox}><Search size={17} /><input value={query} onChange={(event) => { setPage(1); onQueryChange(event.target.value); }} placeholder={`Tìm trong ${definition.title.toLowerCase()}...`} /></label>
          <div className={styles.toolbarRight}>
            <div ref={statusMenuRef} className={styles.statusSelect}>
              <button
                type="button"
                className={`${styles.statusSelectTrigger} ${statusMenuOpen ? styles.statusSelectTriggerOpen : ""}`}
                onClick={() => setStatusMenuOpen((open) => !open)}
                aria-haspopup="listbox"
                aria-expanded={statusMenuOpen}
              >
                <SlidersHorizontal size={16} />
                <span>{statusFilter}</span>
                <ChevronDown size={15} className={statusMenuOpen ? styles.chevronOpen : ""} />
              </button>
              {statusMenuOpen && (
                <div className={styles.statusSelectMenu} role="listbox" aria-label="Lọc theo trạng thái">
                  <div className={styles.statusSelectLabel}>Lọc trạng thái</div>
                  {statuses.map((status) => {
                    const selected = statusFilter === status;
                    return (
                      <button
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={selected ? styles.statusOptionSelected : ""}
                        key={status}
                        onClick={() => {
                          setPage(1);
                          setStatusFilter(status);
                          setStatusMenuOpen(false);
                        }}
                      >
                        <span className={styles.statusOptionDot} />
                        <span>{status}</span>
                        {selected && <CheckCircle2 size={14} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button className={styles.iconButton} onClick={() => { setPage(1); onQueryChange(""); setStatusFilter("Tất cả trạng thái"); }} title="Đặt lại bộ lọc"><RefreshCw size={17} /></button>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className={`${styles.dataTable} ${styles.managementTable}`}>
            <thead><tr>{definition.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th><span className="sr-only">Thao tác</span></th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {definition.columns.map((column, index) => (
                    <td key={column.key} data-label={column.label}>
                      {column.key === "status" ? <StatusBadge>{row[column.key]}</StatusBadge> : index === 0 ? <strong>{row[column.key]}</strong> : row[column.key]}
                    </td>
                  ))}
                  <td data-label="Thao tác">
                    <div className={styles.rowActions}>
                      <button onClick={() => onInspect(row)} title="Xem chi tiết" aria-label={`Xem chi tiết ${row.id}`}><Eye size={16} /></button>
                      {row._action ? <button onClick={() => onQuickUpdate(row)} title={row._action} aria-label={`${row._action} ${row.id}`}><CheckCircle2 size={16} /></button> : null}
                      {onDelete ? <button className={styles.rowDelete} onClick={() => onDelete(row)} title="Xóa (xóa mềm)" aria-label={`Xóa ${row.id}`}><Trash2 size={16} /></button> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && !allRows.length && <div className={styles.emptyState}><LoaderCircle size={24} className="animate-spin" /><strong>Đang tải dữ liệu…</strong></div>}
          {!loading && !filteredRows.length && <div className={styles.emptyState}><Search size={24} /><strong>{allRows.length ? "Không tìm thấy dữ liệu" : "Chưa có dữ liệu"}</strong><span>{allRows.length ? "Thử thay đổi từ khóa hoặc bộ lọc trạng thái." : "Dữ liệu sẽ xuất hiện khi có phát sinh trên cửa hàng."}</span></div>}
        </div>
        <div className={styles.pagination}><span>Hiển thị <strong>{rows.length}</strong> / {filteredRows.length} kết quả</span><div><button disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Trước</button><button className={styles.pageActive}>{currentPage} / {pageCount}</button><button disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Tiếp</button></div></div>
      </section>
    </div>
  );
}


function ExcelImportModal({
  type,
  onClose,
  onSuccess,
}: {
  type: "products" | "categories" | "customers";
  onClose: () => void;
  onSuccess: (message: string) => void;
}) {
  const dialogRef = useDialogBehavior(onClose);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportExcelResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const title =
    type === "products"
      ? "Nhập dữ liệu Sản phẩm từ Excel"
      : type === "categories"
        ? "Nhập dữ liệu Danh mục từ Excel"
        : "Nhập dữ liệu Khách hàng từ Excel";
  const badge = type === "products" ? "SẢN PHẨM" : type === "categories" ? "DANH MỤC" : "KHÁCH HÀNG";

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      if (type === "products") {
        await adminApi.downloadProductsTemplate();
      } else if (type === "categories") {
        await adminApi.downloadCategoriesTemplate();
      } else {
        await adminApi.downloadCustomersTemplate();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không tải được file mẫu.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Vui lòng chọn file Excel để nhập.");
      return;
    }
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const res =
        type === "products"
          ? await adminApi.importProductsExcel(file)
          : type === "categories"
            ? await adminApi.importCategoriesExcel(file)
            : await adminApi.importCustomersExcel(file);
      setResult(res);
      onSuccess(
        `Đã xử lý xong: ${res.successCount} thành công (${res.createdCount} thêm mới, ${res.updatedCount} cập nhật).`,
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nhập dữ liệu thất bại.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={styles.modalLayer}
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="excel-import-title"
      >
        <div className={styles.modalHeader}>
          <div>
            <span>{badge} · EXCEL</span>
            <h2 id="excel-import-title">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleImport}>
          <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(34, 197, 94, 0.05)",
                border: "1px dashed rgba(34, 197, 94, 0.25)",
                borderRadius: "8px",
                padding: "12px 16px",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#e2e8f0" }}>Chưa có file mẫu chuẩn?</div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Tải file mẫu để điền đúng định dạng. Cột có dấu <strong style={{ color: "#ef4444" }}>(*)</strong> là bắt buộc {type === "products" ? "(Tên sản phẩm, Tên gói, Giá bán)" : type === "categories" ? "(Tên danh mục)" : "(Họ và tên, Email)"}.
                </div>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                style={{ minHeight: "32px", fontSize: "12px", whiteSpace: "nowrap" }}
              >
                <FileDown size={15} />
                {downloadingTemplate ? "Đang tải…" : "Tải file mẫu"}
              </button>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#cbd5e1", marginBottom: "8px" }}>
                Chọn file Excel (.xlsx, .xls, .csv)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  setError(null);
                  setResult(null);
                }}
                style={{ display: "none" }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: "2px dashed #334155",
                  borderRadius: "10px",
                  padding: "24px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: file ? "rgba(34, 197, 94, 0.08)" : "#0b101b",
                  transition: "all 0.2s ease",
                }}
              >
                <FileUp size={28} style={{ margin: "0 auto 8px", color: file ? "#22c55e" : "#64748b" }} />
                {file ? (
                  <div>
                    <div style={{ color: "#22c55e", fontWeight: 600, fontSize: "14px" }}>{file.name}</div>
                    <div style={{ color: "#94a3b8", fontSize: "11px", marginTop: "2px" }}>
                      {(file.size / 1024).toFixed(1)} KB — Bấm để chọn file khác
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ color: "#e2e8f0", fontSize: "13px", fontWeight: 500 }}>
                      Nhấp để chọn file hoặc kéo thả vào đây
                    </div>
                    <div style={{ color: "#64748b", fontSize: "11px", marginTop: "4px" }}>
                      Hỗ trợ định dạng .xlsx, .xls, .csv
                    </div>
                  </div>
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className={styles.inlineAlert} style={{ margin: 0 }}>
                {error}
              </p>
            )}

            {result && (
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  padding: "14px",
                }}
              >
                <div style={{ display: "flex", gap: "16px", marginBottom: result.errors.length ? "10px" : "0" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Tổng số dòng:</span>{" "}
                    <strong style={{ color: "#f8fafc" }}>{result.totalRows}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Thành công:</span>{" "}
                    <strong style={{ color: "#22c55e" }}>{result.successCount}</strong> ({result.createdCount} mới,{" "}
                    {result.updatedCount} cập nhật)
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div style={{ marginTop: "8px", borderTop: "1px solid #334155", paddingTop: "8px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "#f87171", marginBottom: "4px" }}>
                      Có {result.errors.length} cảnh báo / lỗi:
                    </div>
                    <div style={{ maxHeight: "120px", overflowY: "auto", fontSize: "11px", color: "#fca5a5" }}>
                      {result.errors.map((err, idx) => (
                        <div key={idx} style={{ padding: "2px 0" }}>
                          • {err}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              {result ? "Đóng" : "Hủy"}
            </button>
            <button type="submit" className={styles.primaryButton} disabled={!file || pending}>
              {pending ? <LoaderCircle size={16} className="animate-spin" /> : <FileUp size={16} />}
              {pending ? "Đang xử lý..." : "Tiến hành nhập"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

/** Generates a report for a period; the only "create" flow still needed in this dashboard. */
function ReportModal({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const dialogRef = useDialogBehavior(onClose);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="create-title">
        <div className={styles.modalHeader}><div><span>BÁO CÁO</span><h2 id="create-title">Tạo báo cáo</h2></div><button onClick={onClose} aria-label="Đóng"><X size={20} /></button></div>
        <form onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setPending(true);
          setError(null);
          try {
            const report = await adminApi.generateReport({
              kind: String(data.get("kind")),
              periodStart: new Date(String(data.get("periodStart"))).toISOString(),
              periodEnd: new Date(`${String(data.get("periodEnd"))}T23:59:59`).toISOString(),
            });
            onCreated(`Báo cáo "${report.name}" đã sẵn sàng (${Array.isArray(report.params?.result) ? (report.params?.result as unknown[]).length : 0} dòng).`);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Không tạo được báo cáo.");
          } finally {
            setPending(false);
          }
        }}>
          <div className={styles.formGrid}>
            <label className={styles.fullField}><span>Loại báo cáo</span><select name="kind" defaultValue="revenue_by_product">{Object.entries(REPORT_KINDS).map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
            <label><span>Từ ngày</span><input name="periodStart" type="date" defaultValue={firstOfMonth} required /></label>
            <label><span>Đến ngày</span><input name="periodEnd" type="date" defaultValue={today} required /></label>
          </div>
          {error ? <p role="alert" className={styles.inlineAlert}>{error}</p> : null}
          <div className={styles.modalActions}><button type="button" className={styles.secondaryButton} onClick={onClose}>Hủy</button><button type="submit" className={styles.primaryButton} disabled={pending}><CheckCircle2 size={17} /> {pending ? "Đang tạo…" : "Tạo báo cáo"}</button></div>
        </form>
      </section>
    </div>
  );
}

function DetailModal({ definition, row, onClose, onUpdate }: { definition: ModuleDefinition; row: DataRow; onClose: () => void; onUpdate: () => void }) {
  const dialogRef = useDialogBehavior(onClose);
  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`${styles.modal} ${styles.detailModal}`} role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className={styles.modalHeader}><div><span>CHI TIẾT DỮ LIỆU</span><h2 id="detail-title">{row.id}</h2></div><button onClick={onClose} aria-label="Đóng"><X size={20} /></button></div>
        <div className={styles.detailGrid}>
          {definition.columns.map((column) => <div key={column.key}><span>{column.label}</span>{column.key === "status" ? <StatusBadge>{row[column.key]}</StatusBadge> : <strong>{row[column.key] || "—"}</strong>}</div>)}
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
          {row._action ? <button type="button" className={styles.primaryButton} onClick={onUpdate}><CheckCircle2 size={17} /> {row._action}</button> : null}
        </div>
      </section>
    </div>
  );
}

function ReportDetailModal({
  reportId,
  onClose,
}: {
  reportId: number;
  onClose: () => void;
}) {
  const dialogRef = useDialogBehavior(onClose);
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi
      .getReport(reportId)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được báo cáo");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reportId]);

  const result = Array.isArray(report?.params?.result) ? (report?.params?.result as Record<string, unknown>[]) : [];

  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true" aria-labelledby="report-detail-title">
        <div className={styles.modalHeader}>
          <div>
            <span>BÁO CÁO DOANH THU & PHÂN TÍCH</span>
            <h2 id="report-detail-title">{report?.name || `Báo cáo #${reportId}`}</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>

        {loading ? (
          <div className={styles.modalLoading}>
            <LoaderCircle size={22} className="animate-spin" />
            <span>Đang tải số liệu báo cáo…</span>
          </div>
        ) : error ? (
          <p role="alert" className={styles.inlineAlert}>{error}</p>
        ) : report ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px 20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "12px",
                background: "rgba(255, 255, 255, 0.03)",
                padding: "12px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.08)",
              }}
            >
              <div>
                <small style={{ color: "#8b97ab", display: "block" }}>Kỳ dữ liệu</small>
                <strong>{report.periodLabel}</strong>
              </div>
              <div>
                <small style={{ color: "#8b97ab", display: "block" }}>Loại báo cáo</small>
                <strong>{REPORT_KINDS[report.kind] || report.kind}</strong>
              </div>
              <div>
                <small style={{ color: "#8b97ab", display: "block" }}>Người tạo</small>
                <strong>{report.createdBy?.fullName || "Hệ thống"}</strong>
              </div>
              <div>
                <small style={{ color: "#8b97ab", display: "block" }}>Trạng thái</small>
                <StatusBadge>{reportStatusLabels[report.status] || report.status}</StatusBadge>
              </div>
            </div>

            {report.status === "failed" ? (
              <p className={styles.inlineAlert}>Tạo báo cáo thất bại: {String(report.params?.errorMessage || "Lỗi không xác định")}</p>
            ) : result.length === 0 ? (
              <div className={styles.emptyState}>
                <Search size={24} />
                <strong>Không có dữ liệu trong kỳ này</strong>
                <span>Chưa phát sinh giao dịch hoặc đơn hàng trong khoảng thời gian đã chọn.</span>
              </div>
            ) : (
              <div className={styles.tableScroll} style={{ maxHeight: "380px" }}>
                <table className={`${styles.dataTable} ${styles.managementTable}`}>
                  <thead>
                    {report.kind === "revenue_by_product" && (
                      <tr>
                        <th>Tên sản phẩm</th>
                        <th style={{ textAlign: "right" }}>Số lượng đã bán</th>
                        <th style={{ textAlign: "right" }}>Doanh thu</th>
                      </tr>
                    )}
                    {report.kind === "revenue_by_category" && (
                      <tr>
                        <th>Danh mục</th>
                        <th style={{ textAlign: "right" }}>Số đơn hàng</th>
                        <th style={{ textAlign: "right" }}>Doanh thu</th>
                      </tr>
                    )}
                    {report.kind === "refund_rate" && (
                      <tr>
                        <th>Ngày</th>
                        <th style={{ textAlign: "right" }}>Tổng đơn</th>
                        <th style={{ textAlign: "right" }}>Đã hoàn tiền</th>
                        <th style={{ textAlign: "right" }}>Đã hủy</th>
                      </tr>
                    )}
                    {report.kind === "customers" && (
                      <tr>
                        <th>Khách hàng</th>
                        <th>Email</th>
                        <th>Ngày đăng ký</th>
                        <th style={{ textAlign: "right" }}>Đơn hàng</th>
                        <th style={{ textAlign: "right" }}>Tổng chi tiêu</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {report.kind === "revenue_by_product" &&
                      result.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{String(row.productName || "—")}</strong></td>
                          <td style={{ textAlign: "right" }}>{Number(row.quantity || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ textAlign: "right" }}><strong>{formatCurrency(Number(row.revenue || 0))}</strong></td>
                        </tr>
                      ))}
                    {report.kind === "revenue_by_category" &&
                      result.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{String(row.category || "Chưa phân loại")}</strong></td>
                          <td style={{ textAlign: "right" }}>{Number(row.orders || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ textAlign: "right" }}><strong>{formatCurrency(Number(row.revenue || 0))}</strong></td>
                        </tr>
                      ))}
                    {report.kind === "refund_rate" &&
                      result.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{String(row.date)}</strong></td>
                          <td style={{ textAlign: "right" }}>{Number(row.orders || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ textAlign: "right", color: "#f87171" }}>{Number(row.refunded || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ textAlign: "right", color: "#fbbf24" }}>{Number(row.cancelled || 0).toLocaleString("vi-VN")}</td>
                        </tr>
                      ))}
                    {report.kind === "customers" &&
                      result.map((row, idx) => (
                        <tr key={idx}>
                          <td><strong>{String(row.fullName || "—")}</strong></td>
                          <td>{String(row.email || "")}</td>
                          <td>{row.createdAt ? formatDateTime(String(row.createdAt)) : "—"}</td>
                          <td style={{ textAlign: "right" }}>{Number(row.orders || 0).toLocaleString("vi-VN")}</td>
                          <td style={{ textAlign: "right" }}><strong>{formatCurrency(Number(row.spent || 0))}</strong></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Đóng</button>
        </div>
      </section>
    </div>
  );
}

function FundRequestDetailModal({
  fundRequestId,
  onClose,
  onProcessed,
}: {
  fundRequestId: number;
  onClose: () => void;
  onProcessed: (message: string) => void;
}) {
  const dialogRef = useDialogBehavior(onClose);
  const [fund, setFund] = useState<ApiFundRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi
      .getFundRequest(fundRequestId)
      .then((data) => {
        if (active) setFund(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được thông tin");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fundRequestId]);

  const handleApprove = async () => {
    if (!fund) return;
    setActionPending(true);
    try {
      await adminApi.approveFundRequest(fund.id, note.trim() || undefined);
      onProcessed(`Đã duyệt và cộng ${formatCurrency(fund.amount)} cho ${fund.user?.fullName || fund.user?.email || fund.code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không duyệt được yêu cầu");
    } finally {
      setActionPending(false);
    }
  };

  const handleReject = async () => {
    if (!fund) return;
    const reason = await promptText({
      title: "Từ chối yêu cầu nạp tiền",
      text: "Nhập lý do từ chối để thông báo cho khách hàng:",
      confirmText: "Từ chối yêu cầu",
    });
    if (!reason?.trim()) return;
    setActionPending(true);
    try {
      await adminApi.rejectFundRequest(fund.id, reason.trim());
      onProcessed(`Đã từ chối yêu cầu ${fund.code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không từ chối được yêu cầu");
    } finally {
      setActionPending(false);
    }
  };

  const isPending = fund?.status === "pending" || fund?.status === "processing";

  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`${styles.modal} ${styles.detailModal}`} role="dialog" aria-modal="true" aria-labelledby="fund-detail-title">
        <div className={styles.modalHeader}>
          <div>
            <span>CHI TIẾT YÊU CẦU NẠP TIỀN</span>
            <h2 id="fund-detail-title">{fund?.code || `#${fundRequestId}`}</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>

        {loading ? (
          <div className={styles.modalLoading}>
            <LoaderCircle size={22} className="animate-spin" />
            <span>Đang tải thông tin…</span>
          </div>
        ) : error ? (
          <p role="alert" className={styles.inlineAlert}>{error}</p>
        ) : fund ? (
          <div style={{ padding: "0 20px" }}>
            <div className={styles.detailGrid}>
              <div>
                <span>Khách hàng</span>
                <strong>{fund.user?.fullName || fund.user?.email || "—"}</strong>
                {fund.user?.email && <small style={{ color: "#8b97ab", display: "block" }}>{fund.user.email}</small>}
              </div>
              <div>
                <span>Số tiền</span>
                <strong style={{ color: "#38bdf8", fontSize: "16px" }}>{formatCurrency(fund.amount)}</strong>
              </div>
              <div>
                <span>Loại yêu cầu</span>
                <strong>{fundRequestTypeLabels[fund.type] || fund.type}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <StatusBadge>{fundRequestStatusLabels[fund.status] || fund.status}</StatusBadge>
              </div>
              <div>
                <span>Ngân hàng / STK</span>
                <strong>{fund.bankName ? `${fund.bankName} - ${fund.bankAccountNumber || ""}` : "—"}</strong>
                {fund.bankAccountName && <small style={{ color: "#8b97ab", display: "block" }}>Chủ TK: {fund.bankAccountName}</small>}
              </div>
              <div>
                <span>Mã đối soát / Nội dung CK</span>
                <strong>{fund.transferContent || fund.code}</strong>
              </div>
              <div>
                <span>Thời gian tạo</span>
                <strong>{formatDateTime(fund.createdAt)}</strong>
              </div>
              {fund.rejectReason && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Lý do từ chối</span>
                  <strong style={{ color: "#f87171" }}>{fund.rejectReason}</strong>
                </div>
              )}
            </div>

            {isPending && (
              <div style={{ marginTop: "16px" }}>
                <label className={styles.fullField}>
                  <span>Ghi chú duyệt (tùy chọn)</span>
                  <input
                    type="text"
                    placeholder="VD: Đã nhận tiền qua ngân hàng..."
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={actionPending}>Đóng</button>
          {isPending && (
            <>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleReject}
                disabled={actionPending}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Từ chối
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleApprove}
                disabled={actionPending}
              >
                <CheckCircle2 size={17} /> {actionPending ? "Đang xử lý…" : "Duyệt & Cộng tiền"}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function RefundRequestDetailModal({
  refundRequestId,
  onClose,
  onProcessed,
}: {
  refundRequestId: number;
  onClose: () => void;
  onProcessed: (message: string) => void;
}) {
  const dialogRef = useDialogBehavior(onClose);
  const [refund, setRefund] = useState<ApiRefundRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [adminNote, setAdminNote] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminApi
      .getRefundRequest(refundRequestId)
      .then((data) => {
        if (active) setRefund(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Không tải được thông tin");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refundRequestId]);

  const handleApprove = async () => {
    if (!refund) return;
    const confirmMessage =
      refund.refundMethod === "wallet"
        ? `Hệ thống sẽ hoàn ${formatCurrency(refund.amount)} trực tiếp vào Ví Idhub của khách hàng ${refund.customerName || refund.customerEmail}. Bạn có chắc chắn muốn duyệt?`
        : `Bạn xác nhận đã chuyển khoản ${formatCurrency(refund.amount)} tới tài khoản ngân hàng của khách hàng?`;
    const ok = await confirmAction("Xác nhận duyệt hoàn tiền", confirmMessage, "Duyệt & Hoàn tiền");
    if (!ok) return;

    setActionPending(true);
    try {
      await adminApi.approveRefundRequest(refund.id, adminNote.trim() || undefined);
      onProcessed(`Đã duyệt hoàn tiền ${formatCurrency(refund.amount)} cho yêu cầu ${refund.code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không duyệt được yêu cầu hoàn tiền");
    } finally {
      setActionPending(false);
    }
  };

  const handleReject = async () => {
    if (!refund) return;
    const reason = await promptText({
      title: "Từ chối yêu cầu hoàn tiền",
      text: "Nhập lý do từ chối để thông báo cho khách hàng:",
      confirmText: "Từ chối yêu cầu",
    });
    if (!reason?.trim()) return;
    setActionPending(true);
    try {
      await adminApi.rejectRefundRequest(refund.id, reason.trim());
      onProcessed(`Đã từ chối yêu cầu hoàn tiền ${refund.code}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không từ chối được yêu cầu hoàn tiền");
    } finally {
      setActionPending(false);
    }
  };

  const isPending = refund?.status === "pending" || refund?.status === "processing";

  return (
    <div className={styles.modalLayer} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`${styles.modal} ${styles.detailModal}`} role="dialog" aria-modal="true" aria-labelledby="refund-detail-title">
        <div className={styles.modalHeader}>
          <div>
            <span>CHI TIẾT YÊU CẦU HOÀN TIỀN</span>
            <h2 id="refund-detail-title">{refund?.code || `#${refundRequestId}`}</h2>
          </div>
          <button onClick={onClose} aria-label="Đóng"><X size={20} /></button>
        </div>

        {loading ? (
          <div className={styles.modalLoading}>
            <LoaderCircle size={22} className="animate-spin" />
            <span>Đang tải thông tin…</span>
          </div>
        ) : error ? (
          <p role="alert" className={styles.inlineAlert}>{error}</p>
        ) : refund ? (
          <div style={{ padding: "0 20px" }}>
            <div className={styles.detailGrid}>
              <div>
                <span>Khách hàng</span>
                <strong>{refund.customerName || "—"}</strong>
                <small style={{ color: "#8b97ab", display: "block" }}>{refund.customerEmail} {refund.customerPhone ? `· ${refund.customerPhone}` : ""}</small>
              </div>
              <div>
                <span>Đơn hàng</span>
                <strong>
                  {refund.order?.code ? `#${refund.order.code}` : `#${refund.orderId}`}
                </strong>
                {refund.order?.items && refund.order.items.length > 0 && (
                  <small style={{ color: "#8b97ab", display: "block" }}>
                    {refund.order.items.map((it) => it.productName).join(", ")}
                  </small>
                )}
              </div>
              <div>
                <span>Số tiền hoàn</span>
                <strong style={{ color: "#38bdf8", fontSize: "16px" }}>{formatCurrency(refund.amount)}</strong>
              </div>
              <div>
                <span>Trạng thái</span>
                <StatusBadge>{refundStatusLabels[refund.status] || refund.status}</StatusBadge>
              </div>
              <div>
                <span>Hình thức hoàn tiền</span>
                <strong style={{ color: refund.refundMethod === "wallet" ? "#34d399" : "#60a5fa" }}>
                  {refundMethodLabels[refund.refundMethod] || refund.refundMethod}
                </strong>
              </div>
              <div>
                <span>Thời gian gửi</span>
                <strong>{formatDateTime(refund.createdAt)}</strong>
              </div>

              {refund.refundMethod === "bank_transfer" && (
                <div style={{ gridColumn: "1 / -1", background: "rgba(15, 23, 42, 0.4)", padding: "12px", borderRadius: "8px", border: "1px solid rgba(148, 163, 184, 0.1)" }}>
                  <span style={{ display: "block", marginBottom: "6px", fontWeight: 600, color: "#93c5fd" }}>Thông tin tài khoản ngân hàng nhận tiền</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <small style={{ color: "#8b97ab" }}>Ngân hàng:</small>
                      <div style={{ fontWeight: 600 }}>{refund.bankName || "—"}</div>
                    </div>
                    <div>
                      <small style={{ color: "#8b97ab" }}>Số tài khoản:</small>
                      <div style={{ fontWeight: 600, color: "#38bdf8", fontFamily: "monospace", fontSize: "15px" }}>{refund.bankAccountNumber || "—"}</div>
                    </div>
                    <div>
                      <small style={{ color: "#8b97ab" }}>Tên chủ tài khoản:</small>
                      <div style={{ fontWeight: 600, textTransform: "uppercase" }}>{refund.bankAccountName || "—"}</div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ gridColumn: "1 / -1" }}>
                <span>Lý do hoàn tiền</span>
                <strong>{refund.reason}</strong>
                {refund.description && (
                  <p style={{ marginTop: "4px", color: "#cbd5e1", whiteSpace: "pre-line", fontSize: "13px" }}>{refund.description}</p>
                )}
              </div>

              {refund.proofImageUrl && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Ảnh bằng chứng</span>
                  <div style={{ marginTop: "6px" }}>
                    <a href={refund.proofImageUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
                      Xem ảnh bằng chứng <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              )}

              {refund.reviewedBy && (
                <div>
                  <span>Người duyệt / xử lý</span>
                  <strong>{refund.reviewedBy.fullName || `Admin #${refund.reviewedById}`}</strong>
                  {refund.reviewedAt && (
                    <small style={{ color: "#8b97ab", display: "block" }}>{formatDateTime(refund.reviewedAt)}</small>
                  )}
                </div>
              )}

              {refund.adminNote && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Ghi chú của Admin</span>
                  <strong style={{ color: "#93c5fd" }}>{refund.adminNote}</strong>
                </div>
              )}

              {refund.rejectReason && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <span>Lý do từ chối</span>
                  <strong style={{ color: "#f87171" }}>{refund.rejectReason}</strong>
                </div>
              )}
            </div>

            {isPending && (
              <div style={{ marginTop: "16px" }}>
                <label className={styles.fullField}>
                  <span>Ghi chú xử lý / duyệt (tùy chọn)</span>
                  <input
                    type="text"
                    placeholder="VD: Đã hoàn vào ví / Đã chuyển khoản qua VCB..."
                    value={adminNote}
                    onChange={(event) => setAdminNote(event.target.value)}
                  />
                </label>
              </div>
            )}
          </div>
        ) : null}

        <div className={styles.modalActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={actionPending}>Đóng</button>
          {isPending && (
            <>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={handleReject}
                disabled={actionPending}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#ef4444",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  padding: "8px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Từ chối
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={handleApprove}
                disabled={actionPending}
              >
                {actionPending ? (
                  <>
                    <LoaderCircle size={16} className="animate-spin" />
                    <span>Đang xử lý…</span>
                  </>
                ) : (
                  <span>Duyệt & Hoàn tiền</span>
                )}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}


export function AdminDashboard({
  initialView = "overview",
  productEditor,
}: {
  initialView?: AdminSection;
  /** When set, the main area shows the full-page product editor (`id` undefined = create). */
  productEditor?: { id?: number };
}) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const active = initialView;
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<DataRow | null>(null);
  const [inspectingReportId, setInspectingReportId] = useState<number | null>(null);
  const [inspectingFundId, setInspectingFundId] = useState<number | null>(null);
  const [inspectingRefundId, setInspectingRefundId] = useState<number | null>(null);
  /** Section-specific editor/detail dialog; `id` undefined = create. */
  const [excelImportType, setExcelImportType] = useState<"products" | "categories" | "customers" | null>(null);
  const [editor, setEditor] = useState<{ section: ModuleSection; id?: number | string } | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);

  const { stats, error: statsError, refresh: refreshStats } = useAdminStats();
  const notifications = useAdminNotifications();
  const remote = useAdminModuleRows(isReleased(active) ? active : "overview");

  useEffect(() => {
    const closePopups = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) setNotificationOpen(false);
      if (!profileRef.current?.contains(event.target as Node)) setProfileOpen(false);
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    };
    document.addEventListener("pointerdown", closePopups);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closePopups);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  // Show a toast queued by a full-page editor before it navigated here.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const queued = takeQueuedToast();
      if (queued) {
        setToast({ message: queued, tone: "success" });
        if (toastTimer.current) window.clearTimeout(toastTimer.current);
        toastTimer.current = window.setTimeout(() => setToast(null), 2800);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const profileInitials = (user?.fullName ?? "Quản trị viên")
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "AD";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const notify = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), tone === "error" ? 4600 : 2800);
  };

  const selectModule = (id: ModuleId) => {
    setQuery("");
    setDetailRow(null);
    setEditor(null);
    setInspectingReportId(null);
    setInspectingFundId(null);
    setInspectingRefundId(null);
    setNotificationOpen(false);
    router.push(id === "overview" ? "/admin" : `/admin/${id}`);
  };

  const handleExportExcel = async (type: "products" | "categories" | "customers") => {
    try {
      const typeLabel =
        type === "products" ? "sản phẩm" : type === "categories" ? "danh mục" : "khách hàng";
      notify(`Đang chuẩn bị file Excel ${typeLabel}...`);
      if (type === "products") {
        await adminApi.exportProductsExcel();
      } else if (type === "categories") {
        await adminApi.exportCategoriesExcel();
      } else {
        await adminApi.exportCustomersExcel();
      }
      notify(`Đã xuất file Excel ${typeLabel} thành công.`);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Xuất file Excel thất bại.", "error");
    }
  };

  const EDITABLE_SECTIONS: ModuleSection[] = ["categories", "promotions", "content", "posts", "settings", "orders", "support", "customers"];

  /** "Xem chi tiết": products open their own page; other sections open a dialog or the generic detail. */
  const inspectRow = (row: DataRow) => {
    if (active === "products" && row._ref) {
      router.push(`/admin/products/${row._ref}`);
      return;
    }
    if (active === "reports" && row._ref) {
      setInspectingReportId(Number(row._ref));
      return;
    }
    if (active === "funds" && row._ref) {
      setInspectingFundId(Number(row._ref));
      return;
    }
    if (active === "refunds" && row._ref) {
      setInspectingRefundId(Number(row._ref));
      return;
    }
    if (active !== "overview" && active !== "traffic" && EDITABLE_SECTIONS.includes(active) && row._ref) {
      setEditor({ section: active, id: active === "settings" ? row.id : Number(row._ref) });
      return;
    }
    setDetailRow(row);
  };

  const createInSection = () => {
    if (active === "reports") {
      setCreateOpen(true);
      return;
    }
    if (active === "products") {
      router.push("/admin/products/new");
      return;
    }
    if (active !== "overview" && active !== "traffic") setEditor({ section: active });
  };

  const afterEditorSaved = async (message: string) => {
    setEditor(null);
    setInspectingReportId(null);
    setInspectingFundId(null);
    setInspectingRefundId(null);
    notify(message);
    await Promise.all([remote.refresh(), refreshStats()]);
  };

  const sectionLabel = [...navGroups.flatMap((group) => group.items), ...profileMenuItems].find((item) => item.id === active)?.label ?? "Quản trị";
  const activeLabel = productEditor ? (productEditor.id ? `${sectionLabel} › SP-${productEditor.id}` : `${sectionLabel} › Thêm mới`) : sectionLabel;
  const definition = active === "overview" || active === "traffic" ? null : moduleDefinitions[active];
  const rows = remote.rows ?? [];

  const openNotification = (notification: AdminNotification) => {
    if (!notification.readAt) void notifications.markRead(notification.id);
    selectModule(sectionForNotification(notification));
  };

  /** Orders: pending -> confirm payment, processing -> deliver & complete (manual lines need a note). */
  const advanceOrder = async (row: DataRow) => {
    const orderId = Number(row._ref);
    if (row._status === "pending_payment") {
      await adminApi.confirmPayment(orderId);
      notify(`${row.id} đã xác nhận thanh toán, chuyển sang Đang xử lý.`);
    } else if (row._status === "processing") {
      try {
        await adminApi.completeOrder(orderId);
      } catch (caught) {
        if (!(caught instanceof Error) || !caught.message.includes("deliveryNotes")) throw caught;
        const note = await promptText({ title: "Giao thủ công", text: "Đơn có gói giao thủ công. Nhập nội dung đã giao cho khách:", multiline: true, confirmText: "Dùng nội dung này" });
        if (!note?.trim()) return;
        const order = await adminApi.getOrder(orderId);
        await adminApi.completeOrder(orderId, Object.fromEntries(order.items.map((item) => [String(item.id), note.trim()])));
      }
      notify(`${row.id} đã hoàn tất và giao hàng.`);
    } else {
      return;
    }
    const updated = orderToRow(await adminApi.getOrder(orderId));
    setDetailRow((current) => (current?.id === row.id ? updated : current));
  };

  /** Xóa mềm từ bảng: bản ghi bị ẩn khỏi cửa hàng, dữ liệu vẫn giữ trong DB. */
  const deleteRow = async (row: DataRow) => {
    const id = Number(row._ref);
    const deleteMessage = active === "posts"
      ? "Bài viết sẽ bị xóa khỏi blog."
      : "Bản ghi sẽ bị ẩn khỏi cửa hàng (xóa mềm), dữ liệu vẫn được giữ lại.";
    if (!(await confirmDanger(`Xóa ${row.id}?`, deleteMessage))) return;
    try {
      if (active === "products") await adminApi.deleteProduct(id);
      else if (active === "categories") await adminApi.deleteCategory(id);
      else if (active === "promotions") await adminApi.deletePromotion(id);
      else if (active === "content") await adminApi.deleteContentBlock(id);
      else if (active === "posts") await adminApi.deletePost(id);
      else return;
      notify(`Đã xóa ${row.id}.`);
      setDetailRow(null);
      await Promise.all([remote.refresh(), refreshStats()]);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Không xóa được bản ghi.", "error");
    }
  };

  const updateRow = async (row: DataRow) => {
    if (!definition || active === "overview" || active === "traffic" || !row._action) return;
    try {
      if (active === "orders") {
        await advanceOrder(row);
      } else {
        notify(await runRowAction(active, row));
        setDetailRow(null);
      }
      await Promise.all([remote.refresh(), refreshStats()]);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Không thực hiện được thao tác.", "error");
    }
  };

  return (
    <div className={styles.shell}>
      <AdminSidebar active={active} open={menuOpen} badges={stats?.badges ?? null} onSelect={selectModule} onClose={() => setMenuOpen(false)} onLogout={handleLogout} />
      <div className={styles.mainArea}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button className={styles.menuButton} onClick={() => setMenuOpen(true)} aria-label="Mở menu"><Menu size={21} /></button>
            <div className={styles.breadcrumb}><span>Quản trị</span><ChevronRight size={14} /><strong>{activeLabel}</strong></div>
          </div>
          <div className={styles.topbarActions}>
            <label className={styles.globalSearch}><Search size={17} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm dữ liệu..." aria-label="Tìm kiếm dữ liệu quản trị" /><kbd>Ctrl K</kbd></label>
            <Link href="/" className={styles.storeLink}><ExternalLink size={16} /><span>Xem cửa hàng</span></Link>
            <div ref={notificationRef} className={styles.notificationWrap}>
              <button
                className={`${styles.notificationButton} ${notificationOpen ? styles.notificationButtonOpen : ""}`}
                onClick={() => setNotificationOpen((open) => !open)}
                aria-label={`Thông báo, ${notifications.unreadCount} chưa đọc`}
                aria-haspopup="dialog"
                aria-expanded={notificationOpen}
              >
                <Bell size={18} />
                {notifications.unreadCount > 0 && <i>{notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}</i>}
              </button>
              {notificationOpen && (
                <section className={styles.notificationPanel} role="dialog" aria-label="Trung tâm thông báo">
                  <div className={styles.notificationHeader}>
                    <div><h2>Thông báo</h2><span>{notifications.unreadCount ? `${notifications.unreadCount} thông báo chưa đọc` : "Bạn đã đọc tất cả"}</span></div>
                    {notifications.unreadCount > 0 && <button onClick={() => void notifications.markAllRead()}>Đánh dấu đã đọc</button>}
                  </div>
                  <div className={styles.notificationList}>
                    {notifications.items.length === 0 ? <p className={styles.emptyNote}>Chưa có thông báo nào.</p> : null}
                    {notifications.items.map((notification) => {
                      const Icon = notificationIcons[notification.section ?? ""] ?? Bell;
                      return (
                        <button
                          key={notification.id}
                          className={!notification.readAt ? styles.notificationUnread : ""}
                          onClick={() => openNotification(notification)}
                        >
                          <span className={`${styles.notificationIcon} ${styles[notification.tone]}`}><Icon size={16} /></span>
                          <span className={styles.notificationContent}>
                            <strong>{notification.title}</strong>
                            <small>{notification.body}</small>
                            <time title={formatDateTime(notification.createdAt)}>{timeAgo(notification.createdAt)}</time>
                          </span>
                          {!notification.readAt && <span className={styles.unreadDot} aria-label="Chưa đọc" />}
                        </button>
                      );
                    })}
                  </div>
                  <button className={styles.notificationFooter} onClick={() => selectModule("support")}>Xem trung tâm hỗ trợ <ChevronRight size={15} /></button>
                </section>
              )}
            </div>
            <div ref={profileRef} className={styles.profileWrap}>
              <button
                className={`${styles.profileButton} ${profileOpen ? styles.profileButtonOpen : ""}`}
                onClick={() => setProfileOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
              >
                <span>{profileInitials}</span>
                <div><strong>{user?.fullName ?? "Quản trị viên"}</strong><small>{user ? roleLabels[user.role] : "Toàn quyền"}</small></div>
                <ChevronDown size={15} />
              </button>
              {profileOpen && (
                <section className={styles.profileMenu} role="menu" aria-label="Menu hệ thống">
                  {profileMenuItems.filter((item) => !item.hidden).map((item) => {
                    const Icon = item.icon;
                    const released = isReleased(item.id);
                    const badge = released && item.badge && stats ? (stats.badges[item.badge] ?? 0) : 0;
                    return (
                      <button
                        key={item.id}
                        role="menuitem"
                        className={`${active === item.id ? styles.profileMenuActive : ""} ${released ? "" : styles.profileMenuPending}`}
                        onClick={() => { selectModule(item.id); setProfileOpen(false); }}
                        disabled={!released}
                        title={released ? undefined : "Phân hệ này sẽ được bàn giao ở đợt tiếp theo"}
                      >
                        <Icon size={17} />
                        <span>{item.label}</span>
                        {badge > 0 && <em>{badge > 99 ? "99+" : badge}</em>}
                        {!released && <em className={styles.profileMenuSoon}>Đang hoàn thiện</em>}
                      </button>
                    );
                  })}
                  {profileMenuItems.some((item) => !item.hidden) && <hr />}
                  <button role="menuitem" className={styles.profileMenuLogout} onClick={() => { setProfileOpen(false); void handleLogout(); }}>
                    <LogOut size={17} />
                    <span>Đăng xuất</span>
                  </button>
                </section>
              )}
            </div>
          </div>
        </header>
        <main className={styles.content}>
          {remote.error && !productEditor ? <p role="alert" className={styles.inlineAlert}>Không tải được dữ liệu từ máy chủ: {remote.error}</p> : null}
          {productEditor ? (
            <ProductEditor key={productEditor.id ?? "new"} productId={productEditor.id} notify={notify} />
          ) : active === "overview" ? (
            <Overview stats={stats} statsError={statsError} userName={user?.fullName ?? "Quản trị viên"} onNavigate={selectModule} onOpenProduct={(id) => router.push(`/admin/products/${id}`)} onRefresh={() => { void refreshStats(); void notifications.refresh(); notify("Đã làm mới số liệu."); }} />
          ) : active === "traffic" ? (
            <TrafficView stats={stats} error={statsError} onRefresh={() => { void refreshStats(); notify("Đã làm mới traffic."); }} />
          ) : !isReleased(active) ? (
            <PendingSection label={sectionLabel} onBack={() => selectModule("overview")} />
          ) : definition && (
            <ManagementView
              key={active}
              definition={definition}
              rows={rows}
              loading={remote.loading}
              query={query}
              onQueryChange={setQuery}
              onCreate={createInSection}
              onInspect={inspectRow}
              onQuickUpdate={(row) => void updateRow(row)}
              onDelete={DELETABLE.has(active) ? (row) => void deleteRow(row) : undefined}
              onExportExcel={active === "products" || active === "categories" || active === "customers" ? () => void handleExportExcel(active) : undefined}
              onImportExcel={active === "products" || active === "categories" || active === "customers" ? () => setExcelImportType(active) : undefined}
            />
          )}
        </main>
      </div>
      {excelImportType && (
        <ExcelImportModal
          type={excelImportType}
          onClose={() => setExcelImportType(null)}
          onSuccess={(message) => {
            setExcelImportType(null);
            notify(message);
            void remote.refresh();
          }}
        />
      )}
      {createOpen && active === "reports" && <ReportModal onClose={() => setCreateOpen(false)} onCreated={(message) => { setCreateOpen(false); notify(message); void remote.refresh(); }} />}
      {inspectingReportId && <ReportDetailModal reportId={inspectingReportId} onClose={() => setInspectingReportId(null)} />}
      {inspectingFundId && <FundRequestDetailModal fundRequestId={inspectingFundId} onClose={() => setInspectingFundId(null)} onProcessed={(message) => { setInspectingFundId(null); notify(message); void Promise.all([remote.refresh(), refreshStats()]); }} />}
      {inspectingRefundId && <RefundRequestDetailModal refundRequestId={inspectingRefundId} onClose={() => setInspectingRefundId(null)} onProcessed={(message) => { setInspectingRefundId(null); notify(message); void Promise.all([remote.refresh(), refreshStats()]); }} />}
      {detailRow && definition && <DetailModal definition={definition} row={detailRow} onClose={() => setDetailRow(null)} onUpdate={() => void updateRow(detailRow)} />}
      {editor?.section === "categories" && <CategoryForm categoryId={editor.id as number | undefined} onClose={() => setEditor(null)} onSaved={(message) => void afterEditorSaved(message)} />}
      {editor?.section === "promotions" && <PromotionForm promotionId={editor.id as number | undefined} onClose={() => setEditor(null)} onSaved={(message) => void afterEditorSaved(message)} />}
      {editor?.section === "content" && <ContentBlockForm blockId={editor.id as number | undefined} onClose={() => setEditor(null)} onSaved={(message) => void afterEditorSaved(message)} />}
      {editor?.section === "posts" && <BlogPostForm postId={editor.id as number | undefined} onClose={() => setEditor(null)} onSaved={(message) => void afterEditorSaved(message)} />}
      {editor?.section === "settings" && typeof editor.id === "string" && <SettingForm settingKey={editor.id} onClose={() => setEditor(null)} onSaved={(message) => void afterEditorSaved(message)} />}
      {editor?.section === "orders" && typeof editor.id === "number" && <OrderDetail orderId={editor.id} onClose={() => setEditor(null)} onChanged={(message) => { notify(message); void Promise.all([remote.refresh(), refreshStats()]); }} />}
      {editor?.section === "support" && typeof editor.id === "number" && <TicketDetail ticketId={editor.id} onClose={() => setEditor(null)} onChanged={(message) => { notify(message); void Promise.all([remote.refresh(), refreshStats()]); }} />}
      {editor?.section === "customers" && typeof editor.id === "number" && <CustomerDetail userId={editor.id} onClose={() => setEditor(null)} onChanged={(message) => { notify(message); void remote.refresh(); }} />}
      <div className={`${styles.toast} ${toast?.tone === "error" ? styles.toastError : ""} ${toast ? styles.toastVisible : ""}`} role="status">{toast?.tone === "error" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}{toast?.message}</div>
    </div>
  );
}
