"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { OrderStatusBadge } from "@/components/orders/order-summary";
import { timeAgo } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import { ordersApi, type ApiOrder } from "@/lib/api/orders";

/** Latest orders of the signed-in user, shown in the account drawer or account page. */
export function RecentOrders({
  email,
  onNavigate,
  limit = 5,
  title = "Đơn hàng gần đây",
}: {
  email: string;
  onNavigate?: () => void;
  limit?: number;
  title?: string;
}) {
  const [orders, setOrders] = useState<ApiOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    ordersApi
      .listMine({ limit })
      .then((page) => {
        if (active) setOrders(page.items);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Không tải được đơn hàng.");
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return (
    <section className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-extrabold uppercase text-slate-700">{title}</h3>
        <Link
          href="/kiem-tra-don-hang"
          className="focus-ring text-[12px] font-bold text-primary-strong"
          onClick={onNavigate}
        >
          Tra cứu đơn
        </Link>
      </div>

      {orders === null && !error ? (
        <p className="inline-flex items-center gap-2 text-[13px] text-muted">
          <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
          Đang tải…
        </p>
      ) : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {orders && orders.length === 0 ? (
        <p className="text-[13px] text-muted">Bạn chưa có đơn hàng nào.</p>
      ) : null}

      {orders?.length ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/kiem-tra-don-hang?code=${encodeURIComponent(order.code)}&email=${encodeURIComponent(email)}`}
                className="focus-ring flex items-center gap-2 p-3 text-[13px] transition hover:bg-slate-50 sm:gap-3"
                onClick={onNavigate}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 sm:justify-start">
                    <div className="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                      <span className="max-w-full truncate font-extrabold text-slate-950">#{order.code}</span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <span className="shrink-0 whitespace-nowrap font-extrabold text-slate-900 sm:hidden">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-muted">
                    {order.items.map((item) => item.productName).join(", ")}
                  </p>
                  <p className="text-[11px] text-muted">{timeAgo(order.createdAt)}</p>
                </div>
                <span className="hidden shrink-0 whitespace-nowrap font-extrabold text-slate-900 sm:inline">
                  {formatCurrency(order.total)}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
