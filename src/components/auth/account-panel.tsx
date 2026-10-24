"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { LoginForm, RegisterForm } from "@/components/auth/auth-forms";
import { useAuth } from "@/components/auth/auth-provider";
import { RecentOrders } from "@/components/orders/recent-orders";
import { WalletCard } from "@/components/wallet/wallet-card";
import { roleLabels, type AuthUser } from "@/lib/api/auth";

type Tab = "login" | "register";
type AccountPanelVariant = "drawer" | "page";

/** Content of the "Tài khoản" drawer: login/register when signed out, profile when signed in. */
export function AccountPanel({
  onNavigate,
  variant = "drawer",
}: {
  onNavigate?: () => void;
  variant?: AccountPanelVariant;
}) {
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("login");
  const [signingOut, setSigningOut] = useState(false);

  // Admins go straight to the dashboard after signing in; everyone else stays on the profile view.
  function handleSignedIn(signedInUser: AuthUser) {
    if (signedInUser.role === "admin") {
      onNavigate?.();
      router.push("/admin");
    }
  }

  if (status === "loading") {
    return (
      <div className="grid flex-1 place-items-center p-6 text-sm text-muted">
        <span className="inline-flex items-center gap-2">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Đang kiểm tra phiên đăng nhập…
        </span>
      </div>
    );
  }

  if (status === "authenticated" && user) {
    const initials = user.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");

    return (
      <div className={variant === "page" ? "p-0" : "flex-1 overflow-auto p-3.5 sm:p-5"}>
        <div className="rounded-xl border border-slate-200/80 bg-surface-muted/60 p-3 sm:p-4.5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 sm:size-12 shrink-0 place-items-center rounded-full bg-primary text-[14px] sm:text-[15px] font-black text-white shadow-sm">
              {initials || "U"}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <p className="truncate text-[14px] sm:text-[15px] font-extrabold text-slate-950">{user.fullName}</p>
                {user.role === "admin" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[10px] sm:text-[11px] font-bold text-primary-strong shadow-xs">
                    <ShieldCheck size={11} aria-hidden="true" />
                    {roleLabels[user.role]}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[12px] sm:text-[13px] text-muted">{user.email}</p>
            </div>
          </div>

          {/* Số dư ví AIHUB đặt ngay dưới phần email người dùng */}
          <div className="mt-3">
            <WalletCard />
          </div>

          <dl
            className={
              variant === "page"
                ? "mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-200/80 pt-3 text-[12px]"
                : "mt-3 space-y-1.5 border-t border-slate-200/80 pt-2.5 text-[12px]"
            }
          >
            <div className={variant === "page" ? "" : "flex justify-between gap-3"}>
              <dt className="text-muted">Số điện thoại</dt>
              <dd className="font-bold text-slate-800">{user.phone ?? "—"}</dd>
            </div>
            <div className={variant === "page" ? "" : "flex justify-between gap-3"}>
              <dt className="text-muted">Đăng nhập gần nhất</dt>
              <dd className="font-bold text-slate-800">
                {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("vi-VN") : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <RecentOrders
          email={user.email}
          onNavigate={onNavigate}
          limit={variant === "page" ? 20 : 5}
          title={variant === "page" ? "Đơn hàng của bạn" : "Đơn hàng gần đây"}
        />

        <div className={variant === "page" ? "mt-6 flex flex-wrap gap-3" : "mt-5 grid gap-2"}>
          {user.role === "admin" ? (
            <Link
              href="/admin"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 font-extrabold text-white transition hover:bg-primary-strong"
              onClick={onNavigate}
            >
              Vào trang quản trị
            </Link>
          ) : null}
          <button
            type="button"
            className="focus-ring inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-5 font-extrabold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
            disabled={signingOut}
            onClick={async () => {
              setSigningOut(true);
              try {
                await logout();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            {signingOut ? (
              <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={18} aria-hidden="true" />
            )}
            Đăng xuất
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={variant === "page" ? "p-0" : "flex-1 overflow-auto p-3.5 sm:p-5"}>
      <div className="mb-5 grid grid-cols-2 rounded-md bg-slate-100 p-1 text-[13px] font-extrabold" role="tablist">
        {(
          [
            ["login", "Đăng nhập"],
            ["register", "Đăng ký"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            className={`focus-ring h-9 cursor-pointer rounded-[5px] transition ${
              tab === value ? "bg-white text-primary-strong shadow-sm" : "text-slate-600"
            }`}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "login" ? (
        <LoginForm idPrefix="drawer-login" onSuccess={handleSignedIn} />
      ) : (
        <RegisterForm idPrefix="drawer-register" onSuccess={handleSignedIn} />
      )}
    </div>
  );
}
