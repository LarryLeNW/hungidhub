import type { Metadata } from "next";
import { AccountPanel } from "@/components/auth/account-panel";

export const metadata: Metadata = {
  title: "Tài khoản",
};

export default function AccountPage() {
  return (
    <main className="min-h-[70vh] bg-[#f5f8fb]">
      <div className="ktk-page-frame py-8 lg:py-10">
        <div className="mb-5">
          <h1 className="text-[28px] font-extrabold text-slate-950">Tài khoản</h1>
          <p className="mt-1 text-[14px] text-muted">
            Quản lý phiên đăng nhập và theo dõi các đơn hàng đã đặt.
          </p>
        </div>
        <div className="max-w-[920px] rounded-[8px] border border-border bg-white p-5 shadow-sm">
          <AccountPanel variant="page" />
        </div>
      </div>
    </main>
  );
}
