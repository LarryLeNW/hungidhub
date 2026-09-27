import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderLookup } from "./order-lookup";

export const metadata: Metadata = {
  title: "Kiểm tra đơn hàng",
  description: "Tra cứu trạng thái đơn hàng Idhub bằng mã đơn và email đặt hàng.",
};

export default function OrderLookupPage() {
  return (
    <main className="bg-[#f5f8fb]">
      <section className="container-page py-8 lg:py-12">
        <p className="text-sm font-extrabold uppercase text-primary-strong">Đơn hàng</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-950">Kiểm tra đơn hàng</h1>
        <p className="mt-2 max-w-[640px] text-sm leading-6 text-muted">
          Xem trạng thái thanh toán, thông tin chuyển khoản và tài khoản đã được giao cho đơn của bạn.
        </p>
        <div className="mt-6">
          <Suspense fallback={null}>
            <OrderLookup />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
