"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  LoaderCircle,
  PackageOpen,
  RefreshCcw,
  Search,
  ShoppingBag,
  X,
  XCircle,
} from "lucide-react";
import { LoginForm, RegisterForm } from "@/components/auth/auth-forms";
import { useAuth } from "@/components/auth/auth-provider";
import { CancelOrderModal } from "@/components/orders/cancel-order-modal";
import { OrderStatusBadge, OrderSummary } from "@/components/orders/order-summary";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import {
  ordersApi,
  type ApiOrder,
  type OrderStatus,
} from "@/lib/api/orders";

type TabFilter = "all" | OrderStatus;

const inputClass =
  "mt-1.5 h-10 w-full rounded-lg border border-border bg-white px-3 text-[13.5px] text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50";

export function OrderLookup() {
  const { status: authStatus } = useAuth();
  const searchParams = useSearchParams();
  const paramCode = searchParams.get("code")?.trim().toUpperCase().replace(/^#/, "") ?? "";
  const paramEmail = searchParams.get("email")?.trim() ?? "";

  // Auth / Lookup tabs for guest visitors
  const [guestMode, setGuestMode] = useState<"auth" | "lookup">("auth");
  const [authTab, setAuthTab] = useState<"login" | "register">("login");

  // Form inputs for manual lookup
  const [manualCode, setManualCode] = useState(paramCode);
  const [manualEmail, setManualEmail] = useState(paramEmail);
  const [manualPending, setManualPending] = useState(false);

  // Guest order state (loaded via deep link or manual lookup)
  const [guestOrder, setGuestOrder] = useState<ApiOrder | null>(null);
  const [guestError, setGuestError] = useState<string | null>(null);

  // Authenticated user orders
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  // Active selection and filter
  const [selectedCode, setSelectedCode] = useState<string>(paramCode);
  const [detailOrder, setDetailOrder] = useState<ApiOrder | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // Cancel Order Modal State (Proper UI Dialog, NO window.confirm/alert)
  const [cancelingOrder, setCancelingOrder] = useState<ApiOrder | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Success Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  // Mobile navigation: "list" vs "detail"
  const [mobileView, setMobileView] = useState<"list" | "detail">(
    paramCode ? "detail" : "list",
  );

  // 1. Manual guest lookup action
  const handleManualLookup = useCallback(async (code: string, email: string) => {
    if (!code.trim() || !email.trim()) return;
    setGuestError(null);
    setManualPending(true);
    try {
      const order = await ordersApi.lookup(code.trim().toUpperCase().replace(/^#/, ""), email.trim());
      setGuestOrder(order);
    } catch (err: unknown) {
      setGuestOrder(null);
      setGuestError(err instanceof Error ? err.message : "Không tìm thấy đơn hàng với mã và email này.");
    } finally {
      setManualPending(false);
    }
  }, []);

  // 2. Guest auto lookup when URL has both code and email
  useEffect(() => {
    let active = true;
    if (authStatus === "anonymous" && paramCode && paramEmail) {
      setManualPending(true);
      ordersApi
        .lookup(paramCode, paramEmail)
        .then((order) => {
          if (active) {
            setGuestOrder(order);
            setGuestError(null);
          }
        })
        .catch((err: unknown) => {
          if (active) {
            setGuestError(err instanceof Error ? err.message : "Không tìm thấy đơn hàng.");
          }
        })
        .finally(() => {
          if (active) setManualPending(false);
        });
    }
    return () => {
      active = false;
    };
  }, [authStatus, paramCode, paramEmail]);

  // 3. Authenticated orders loader
  const reloadOrders = useCallback(async () => {
    if (authStatus !== "authenticated") return;
    setOrdersLoading(true);
    try {
      const res = await ordersApi.listMine({ limit: 100 });
      setOrders(res.items);
      setOrdersError(null);
    } catch (err: unknown) {
      setOrdersError(err instanceof Error ? err.message : "Không tải được danh sách đơn hàng.");
    } finally {
      setOrdersLoading(false);
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      void reloadOrders();
    }
  }, [authStatus, reloadOrders]);

  // 4. Cancel order modal trigger & submission
  const promptCancelOrder = (orderToCancel: ApiOrder) => {
    setCancelingOrder(orderToCancel);
    setCancelError(null);
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async (orderToCancel: ApiOrder, reason: string) => {
    setCancelLoading(true);
    setCancelError(null);
    try {
      let updated: ApiOrder;
      if (authStatus === "authenticated") {
        updated = await ordersApi.cancelMine(orderToCancel.code, reason);
      } else {
        const email = paramEmail || manualEmail || orderToCancel.customerEmail;
        if (!email) {
          setCancelError("Thiếu email đặt hàng để xác nhận hủy đơn.");
          return;
        }
        updated = await ordersApi.cancelLookup(orderToCancel.code, email, reason);
      }

      setDetailOrder(updated);
      setOrders((prev) =>
        prev ? prev.map((o) => (o.code === updated.code ? updated : o)) : null,
      );
      if (guestOrder && guestOrder.code === updated.code) {
        setGuestOrder(updated);
      }
      setCancelModalOpen(false);
      setToastMessage(`Đã hủy thành công đơn hàng #${orderToCancel.code}.`);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Không thể hủy đơn hàng.");
    } finally {
      setCancelLoading(false);
    }
  };

  // 5. Filtered orders
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (activeTab === "all") return orders;
    if (activeTab === "cancelled") {
      return orders.filter((o) => o.status === "cancelled" || o.status === "refunded");
    }
    return orders.filter((o) => o.status === activeTab);
  }, [orders, activeTab]);

  // 6. Effective selected code
  const effectiveSelectedCode = useMemo(() => {
    if (!filteredOrders || filteredOrders.length === 0) return "";
    if (selectedCode && filteredOrders.some((o) => o.code === selectedCode)) {
      return selectedCode;
    }
    if (paramCode && filteredOrders.some((o) => o.code.toUpperCase() === paramCode)) {
      return paramCode;
    }
    return filteredOrders[0]?.code ?? "";
  }, [selectedCode, filteredOrders, paramCode]);

  // 7. Load full detail for effective selected order
  const reloadDetail = useCallback((code: string) => {
    if (!code) return;
    ordersApi
      .getMine(code)
      .then((full) => {
        setDetailOrder(full);
        setOrders((prev) =>
          prev ? prev.map((o) => (o.code === full.code ? { ...o, ...full } : o)) : null,
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    if (authStatus !== "authenticated" || !effectiveSelectedCode) {
      return;
    }

    ordersApi
      .getMine(effectiveSelectedCode)
      .then((full) => {
        if (active) {
          setDetailOrder(full);
          setOrders((prev) =>
            prev ? prev.map((o) => (o.code === full.code ? { ...o, ...full } : o)) : null,
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [authStatus, effectiveSelectedCode]);

  // 8. Auto polling pending order
  useEffect(() => {
    const targetOrder = detailOrder || guestOrder;
    if (!targetOrder || targetOrder.status !== "pending_payment") {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        if (authStatus === "authenticated") {
          const refreshed = await ordersApi.getMine(targetOrder.code);
          if (refreshed.status !== targetOrder.status) {
            setDetailOrder(refreshed);
            setOrders((prev) =>
              prev ? prev.map((o) => (o.code === refreshed.code ? refreshed : o)) : null,
            );
          }
        } else {
          const email = paramEmail || manualEmail || targetOrder.customerEmail;
          if (email) {
            const refreshed = await ordersApi.lookup(targetOrder.code, email);
            if (refreshed.status !== targetOrder.status) {
              setGuestOrder(refreshed);
            }
          }
        }
      } catch {
        // network retry
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [detailOrder, guestOrder, authStatus, paramEmail, manualEmail]);

  // Current order object to render in detail view
  const currentOrder = useMemo(() => {
    if (detailOrder && detailOrder.code === effectiveSelectedCode) {
      return detailOrder;
    }
    return filteredOrders.find((o) => o.code === effectiveSelectedCode) ?? null;
  }, [detailOrder, filteredOrders, effectiveSelectedCode]);

  // Tab counts
  const counts = useMemo(() => {
    if (!orders) return { all: 0, pending: 0, processing: 0, completed: 0, other: 0 };
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === "pending_payment").length,
      processing: orders.filter((o) => o.status === "processing").length,
      completed: orders.filter((o) => o.status === "completed").length,
      other: orders.filter((o) => o.status === "cancelled" || o.status === "refunded").length,
    };
  }, [orders]);

  // Loading state when initial checking session
  if (authStatus === "loading") {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-border bg-white p-8">
        <span className="inline-flex items-center gap-2.5 text-[14px] font-bold text-muted">
          <LoaderCircle size={20} className="animate-spin text-primary" aria-hidden="true" />
          Đang tải dữ liệu đơn hàng…
        </span>
      </div>
    );
  }

  // Guest view: anonymous visitor
  if (authStatus === "anonymous") {
    // If guest arrived with deep-linked code & email, or performed a lookup that returned an order
    if (guestOrder) {
      return (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 size={18} className="text-primary-strong shrink-0" />
              <p className="text-[13px] font-bold text-slate-800">
                Đang hiển thị đơn hàng <strong className="text-primary-strong">#{guestOrder.code}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="text-xs font-bold text-slate-600 hover:text-slate-900 underline"
                onClick={() => setGuestOrder(null)}
              >
                Tra cứu đơn khác
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm">
            {guestOrder.status === "pending_payment" ? (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-[12.5px] text-amber-900">
                <div className="flex items-center gap-2">
                  <LoaderCircle size={16} className="animate-spin text-amber-600 shrink-0" />
                  <span>Hệ thống đang tự động kiểm tra chuyển khoản qua VietQR...</span>
                </div>
                <button
                  type="button"
                  className="focus-ring inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 font-bold text-rose-600 shadow-xs transition hover:bg-rose-50 hover:border-rose-400"
                  onClick={() => promptCancelOrder(guestOrder)}
                >
                  <XCircle size={13} />
                  <span>Hủy đơn hàng</span>
                </button>
              </div>
            ) : null}

            <OrderSummary order={guestOrder} />

            {guestOrder.status === "pending_payment" ? (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-[12px]">
                <span className="text-slate-500">Đổi ý hoặc không muốn tiếp tục thanh toán?</span>
                <button
                  type="button"
                  className="focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300"
                  onClick={() => promptCancelOrder(guestOrder)}
                >
                  <XCircle size={13} />
                  <span>Hủy đơn này</span>
                </button>
              </div>
            ) : null}
          </div>

          {/* Cancel Order UI Popup Modal */}
          <CancelOrderModal
            order={cancelingOrder}
            open={cancelModalOpen}
            loading={cancelLoading}
            error={cancelError}
            onClose={() => {
              if (!cancelLoading) setCancelModalOpen(false);
            }}
            onConfirm={handleConfirmCancel}
          />

          {/* Floating Success Toast */}
          {toastMessage ? (
            <div className="fixed top-5 right-5 z-100 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white shadow-2xl animate-in fade-in slide-in-from-top-3">
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="ml-2 text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    // Default guest view: Prompt login OR offer quick lookup by code & email
    return (
      <div className="mx-auto max-w-[480px] rounded-2xl border border-border bg-white p-6 sm:p-8 shadow-sm">
        <div className="text-center">
          <div className="mx-auto grid size-13 place-items-center rounded-2xl bg-primary/10 text-primary mb-3">
            <PackageOpen size={26} />
          </div>
          <h2 className="text-[20px] font-black text-slate-900">Xem thông tin đơn hàng</h2>
          <p className="mt-1.5 text-[13px] text-muted leading-relaxed">
            Đăng nhập để xem danh sách tất cả các đơn hàng, hoặc tra cứu trực tiếp bằng mã đơn & email.
          </p>
        </div>

        {/* Guest Mode Tabs */}
        <div className="mt-5 mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-[13px] font-extrabold" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={guestMode === "auth"}
            className={`focus-ring h-9 cursor-pointer rounded-lg transition ${
              guestMode === "auth" ? "bg-white text-primary-strong shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setGuestMode("auth")}
          >
            Đăng nhập tài khoản
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={guestMode === "lookup"}
            className={`focus-ring h-9 cursor-pointer rounded-lg transition ${
              guestMode === "lookup" ? "bg-white text-primary-strong shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
            onClick={() => setGuestMode("lookup")}
          >
            Tra cứu nhanh
          </button>
        </div>

        {guestMode === "auth" ? (
          <div>
            <div className="mb-4 flex items-center justify-center gap-4 text-xs font-bold text-slate-500">
              <button
                type="button"
                className={`transition ${authTab === "login" ? "text-primary font-black underline" : "hover:text-slate-800"}`}
                onClick={() => setAuthTab("login")}
              >
                Đăng nhập
              </button>
              <span>•</span>
              <button
                type="button"
                className={`transition ${authTab === "register" ? "text-primary font-black underline" : "hover:text-slate-800"}`}
                onClick={() => setAuthTab("register")}
              >
                Đăng ký tài khoản mới
              </button>
            </div>

            {authTab === "login" ? (
              <LoginForm idPrefix="orders-page-login" />
            ) : (
              <RegisterForm idPrefix="orders-page-register" />
            )}
          </div>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void handleManualLookup(manualCode, manualEmail);
            }}
          >
            <div>
              <label className="block text-[13px] font-bold text-slate-800" htmlFor="guest-lookup-code">
                Mã đơn hàng
              </label>
              <input
                id="guest-lookup-code"
                className={inputClass}
                placeholder="AH10007"
                value={manualCode}
                required
                disabled={manualPending}
                onChange={(e) => setManualCode(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[13px] font-bold text-slate-800" htmlFor="guest-lookup-email">
                Email nhận hàng
              </label>
              <input
                id="guest-lookup-email"
                type="email"
                className={inputClass}
                placeholder="ban@example.com"
                value={manualEmail}
                required
                disabled={manualPending}
                onChange={(e) => setManualEmail(e.target.value)}
              />
            </div>

            {guestError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12.5px] font-semibold text-rose-700">
                {guestError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={manualPending}
              className="focus-ring mt-2 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary text-[13.5px] font-extrabold text-white transition hover:bg-primary-strong disabled:opacity-60 shadow-sm"
            >
              {manualPending ? (
                <LoaderCircle size={16} className="animate-spin" />
              ) : (
                <Search size={16} />
              )}
              <span>Tra cứu ngay</span>
            </button>
          </form>
        )}
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[12.5px] font-bold">
        {(
          [
            ["all", "Tất cả", counts.all],
            ["pending_payment", "Chờ thanh toán", counts.pending],
            ["processing", "Đang xử lý", counts.processing],
            ["completed", "Hoàn tất", counts.completed],
            ["cancelled", "Đã hủy", counts.other],
          ] as const
        ).map(([key, label, count]) => {
          const isSelected = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              className={`focus-ring inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 transition ${
                isSelected
                  ? "bg-primary font-black text-white shadow-xs"
                  : "bg-white text-slate-700 hover:bg-slate-50 border border-border"
              }`}
              onClick={() => {
                setActiveTab(key);
              }}
            >
              <span>{label}</span>
              <span
                className={`grid size-5 place-items-center rounded-full text-[10.5px] font-extrabold ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          title="Làm mới danh sách đơn hàng"
          disabled={ordersLoading}
          className="ml-auto inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-[12px] font-bold text-slate-600 hover:text-primary transition disabled:opacity-60"
          onClick={() => void reloadOrders()}
        >
          <RefreshCcw size={13} className={ordersLoading ? "animate-spin text-primary" : ""} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>

      {/* Main Content Area */}
      {ordersLoading && !orders ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-border bg-white p-8">
          <span className="inline-flex items-center gap-2 text-sm text-muted font-bold">
            <LoaderCircle size={18} className="animate-spin text-primary" />
            Đang tải danh sách đơn hàng…
          </span>
        </div>
      ) : ordersError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center text-rose-700">
          <AlertCircle size={28} className="mx-auto mb-2 text-rose-600" />
          <p className="font-bold">{ordersError}</p>
          <button
            type="button"
            className="mt-3 inline-flex h-9 cursor-pointer items-center rounded-lg bg-primary px-4 text-xs font-bold text-white hover:bg-primary-strong transition"
            onClick={() => void reloadOrders()}
          >
            Thử lại
          </button>
        </div>
      ) : orders && orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-4 text-center">
          <div className="grid size-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3 shadow-xs">
            <PackageOpen size={32} />
          </div>
          <h3 className="text-[17px] font-black text-slate-900">Bạn chưa có đơn hàng nào</h3>
          <p className="mt-1 max-w-[380px] text-[13px] text-muted">
            Khám phá các gói tài khoản số cao cấp (ChatGPT, Canva, Youtube, Netflix...) với mức giá tốt nhất.
          </p>
          <Link
            href="/"
            className="focus-ring mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-[13px] font-extrabold text-white shadow-sm transition hover:bg-primary-strong"
          >
            <ShoppingBag size={15} />
            <span>Khám phá sản phẩm ngay</span>
          </Link>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-border bg-white py-12 px-4 text-center text-slate-500">
          <p className="text-[13px] font-bold">Không có đơn hàng nào ở trạng thái này.</p>
        </div>
      ) : (
        /* Orders Master-Detail View */
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* Left Column: Order List */}
          <div
            className={`space-y-3 lg:col-span-5 xl:col-span-4 ${
              mobileView === "detail" ? "hidden lg:block" : "block"
            }`}
          >
            {filteredOrders.map((order) => {
              const isSelected = order.code === effectiveSelectedCode;
              return (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  className={`w-full text-left rounded-xl border p-4 transition cursor-pointer ${
                    isSelected
                      ? "border-primary bg-emerald-50/25 ring-2 ring-primary/20 shadow-xs"
                      : "border-border bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-xs"
                  }`}
                  onClick={() => {
                    setSelectedCode(order.code);
                    setMobileView("detail");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setSelectedCode(order.code);
                      setMobileView("detail");
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-black text-[15px] text-slate-950">#{order.code}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 mb-2">
                    {order.items.map((it) => it.productName).join(", ")}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[12px] border-t border-slate-100 pt-2.5">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock size={12} />
                      {formatDateTime(order.createdAt)}
                    </span>
                    <span className="font-black text-[14px] text-slate-900">
                      {formatCurrency(order.total)}
                    </span>
                  </div>

                  {/* Prominent Quick Cancel on Card for Pending Payment Orders */}
                  {order.status === "pending_payment" ? (
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                        Chờ quét QR thanh toán
                      </span>
                      <button
                        type="button"
                        className="focus-ring inline-flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[11.5px] font-bold text-rose-600 transition hover:bg-rose-100 hover:border-rose-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          promptCancelOrder(order);
                        }}
                      >
                        <XCircle size={12} />
                        <span>Hủy đơn</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Right Column: Order Detail */}
          <div
            className={`lg:col-span-7 xl:col-span-8 ${
              mobileView === "list" ? "hidden lg:block" : "block"
            }`}
          >
            {/* Mobile Back Button */}
            <div className="mb-3 lg:hidden">
              <button
                type="button"
                className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
                onClick={() => setMobileView("list")}
              >
                <ArrowLeft size={14} />
                <span>Quay lại danh sách đơn ({filteredOrders.length})</span>
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-white p-5 sm:p-6 shadow-sm sticky top-20">
              {currentOrder ? (
                <div className="space-y-4">
                  {/* Status Banner with prominent Cancel Order button at the TOP */}
                  {currentOrder.status === "pending_payment" ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <LoaderCircle size={16} className="animate-spin text-amber-600 shrink-0" />
                          <span className="text-[12.5px] font-bold text-amber-900">
                            Đang chờ bạn quét mã QR thanh toán…
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            className="focus-ring inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11.5px] font-bold text-slate-700 hover:bg-slate-50 transition"
                            onClick={() => reloadDetail(currentOrder.code)}
                            title="Kiểm tra lại giao dịch"
                          >
                            <RefreshCcw size={12} />
                            <span>Kiểm tra lại</span>
                          </button>
                          <button
                            type="button"
                            className="focus-ring inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 text-[12px] font-bold text-rose-600 shadow-xs transition hover:bg-rose-50 hover:border-rose-400"
                            onClick={() => promptCancelOrder(currentOrder)}
                          >
                            <XCircle size={13} />
                            <span>Hủy đơn hàng</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  <OrderSummary order={currentOrder} />

                  {/* Cancel Button at bottom as well for convenience */}
                  {currentOrder.status === "pending_payment" ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-[12px]">
                      <span className="text-slate-500">Đổi ý hoặc không muốn tiếp tục thanh toán?</span>
                      <button
                        type="button"
                        className="focus-ring inline-flex h-8.5 cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3.5 font-bold text-rose-600 transition hover:bg-rose-50 hover:border-rose-300"
                        onClick={() => promptCancelOrder(currentOrder)}
                      >
                        <XCircle size={13} />
                        <span>Hủy đơn hàng này</span>
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex min-h-[240px] items-center justify-center text-center text-sm text-muted">
                  Chọn một đơn hàng từ danh sách bên trái để xem chi tiết.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order UI Popup Modal */}
      <CancelOrderModal
        order={cancelingOrder}
        open={cancelModalOpen}
        loading={cancelLoading}
        error={cancelError}
        onClose={() => {
          if (!cancelLoading) setCancelModalOpen(false);
        }}
        onConfirm={handleConfirmCancel}
      />

      {/* Floating Success Toast */}
      {toastMessage ? (
        <div className="fixed top-5 right-5 z-100 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-[13px] font-bold text-white shadow-2xl animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
