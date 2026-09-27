"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Search } from "lucide-react";
import { OrderSummary } from "@/components/orders/order-summary";
import { ordersApi, type ApiOrder } from "@/lib/api/orders";

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50";

export function OrderLookup() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const lookup = useCallback(async (nextCode: string, nextEmail: string) => {
    setError(null);
    setPending(true);
    try {
      setOrder(await ordersApi.lookup(nextCode.trim(), nextEmail.trim()));
    } catch (caught) {
      setOrder(null);
      setError(caught instanceof Error ? caught.message : "Không tra cứu được đơn hàng.");
    } finally {
      setPending(false);
    }
  }, []);

  // Deep links from the checkout drawer / account panel carry both values.
  useEffect(() => {
    const initialCode = searchParams.get("code");
    const initialEmail = searchParams.get("email");
    if (!initialCode || !initialEmail) return;
    const timer = window.setTimeout(() => void lookup(initialCode, initialEmail), 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, lookup]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookup(code, email);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form className="space-y-4 rounded-[10px] border border-border bg-white p-5 shadow-sm" onSubmit={submit}>
        <label className="block text-sm font-bold text-slate-800" htmlFor="lookup-code">
          Mã đơn hàng
          <input
            id="lookup-code"
            className={inputClass}
            placeholder="AH10001"
            value={code}
            required
            disabled={pending}
            onChange={(event) => setCode(event.currentTarget.value)}
          />
        </label>
        <label className="block text-sm font-bold text-slate-800" htmlFor="lookup-email">
          Email đặt hàng
          <input
            id="lookup-email"
            className={inputClass}
            type="email"
            placeholder="ban@example.com"
            value={email}
            required
            disabled={pending}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="focus-ring inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-primary font-extrabold text-white transition hover:bg-primary-strong disabled:opacity-60"
          disabled={pending}
        >
          {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
          Tra cứu
        </button>
        <p className="text-[12px] leading-5 text-muted">
          Mã đơn và hướng dẫn thanh toán được hiển thị ngay sau khi đặt hàng và gửi tới email của bạn.
        </p>
      </form>

      <div className="rounded-[10px] border border-border bg-white p-5 shadow-sm">
        {order ? (
          <OrderSummary order={order} />
        ) : (
          <div className="grid min-h-[240px] place-items-center text-center text-[14px] text-muted">
            Nhập mã đơn và email để xem trạng thái, hướng dẫn thanh toán và tài khoản đã giao.
          </div>
        )}
      </div>
    </div>
  );
}
