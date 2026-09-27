"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoaderCircle, LogOut, ShieldCheck } from "lucide-react";
import { LoginForm, RegisterForm } from "@/components/auth/auth-forms";
import { useAuth } from "@/components/auth/auth-provider";
import { RecentOrders } from "@/components/orders/recent-orders";
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
      <div className={variant === "page" ? "p-0" : "flex-1 overflow-auto p-5"}>
        <div className="flex items-center gap-3 rounded-md bg-surface-muted p-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-[15px] font-black text-white">
            {initials || "U"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-slate-950">{user.fullName}</p>
            <p className="truncate text-[13px] text-muted">{user.email}</p>
            <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary-strong">
              <ShieldCheck size={12} aria-hidden="true" />
              {roleLabels[user.role]}
            </p>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-[13px]">
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Số điện thoại</dt>
            <dd className="font-bold text-slate-800">{user.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted">Đăng nhập gần nhất</dt>
            <dd className="font-bold text-slate-800">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("vi-VN") : "—"}
            </dd>
          </div>
        </dl>

        <RecentOrders
          email={user.email}
          onNavigate={onNavigate}
          limit={variant === "page" ? 20 : 5}
          title={variant === "page" ? "Đơn hàng của bạn" : "Đơn hàng gần đây"}
        />

        <div className="mt-5 grid gap-2">
          {user.role === "admin" ? (
            <Link
              href="/admin"
              className="focus-ring inline-flex h-11 items-center justify-center rounded-md bg-primary font-extrabold text-white transition hover:bg-primary-strong"
              onClick={onNavigate}
            >
              Vào trang quản trị
            </Link>
          ) : null}
          <button
            type="button"
            className="focus-ring inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-border font-extrabold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
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
    <div className={variant === "page" ? "p-0" : "flex-1 overflow-auto p-5"}>
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
