import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderLookup } from "./order-lookup";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = {
  title: "Đơn hàng của bạn",
  description: `Quản lý và theo dõi các đơn hàng đã đặt tại ${siteConfig.name}.`,
};

export default function OrderLookupPage() {
  return (
    <main className="min-h-[75vh] bg-[#f5f8fb]">
      <section className="container-page py-6 lg:py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">Đơn hàng của bạn</h1>
          <p className="mt-1.5 text-sm text-muted">
            Theo dõi tiến độ, quét mã thanh toán tự động và nhận thông tin tài khoản đã giao.
          </p>
        </div>
        <div>
          <Suspense
            fallback={
              <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-white p-8">
                <span className="text-sm text-muted">Đang tải dữ liệu đơn hàng...</span>
              </div>
            }
          >
            <OrderLookup />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
