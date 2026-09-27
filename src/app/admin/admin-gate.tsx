"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { LoaderCircle, LogOut, ShieldAlert } from "lucide-react";
import { IdhubLogo } from "@/components/Idhub-logo";
import { LoginForm } from "@/components/auth/auth-forms";
import { useAuth } from "@/components/auth/auth-provider";
import { roleLabels } from "@/lib/api/auth";

/** Renders the admin UI only for an authenticated user with the `admin` role. */
export function AdminGate({ children }: { children: ReactNode }) {
  const { status, user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  if (status === "loading") {
    return (
      <GateFrame>
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-400">
          <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
          Đang kiểm tra phiên đăng nhập…
        </p>
      </GateFrame>
    );
  }

  if (status === "anonymous" || !user) {
    return (
      <GateFrame>
        <IdhubLogo admin href="/admin" />
        <h1 className="mt-7 text-[22px] font-extrabold text-white">Đăng nhập quản trị</h1>
        <p className="mt-1.5 text-[13px] leading-5 text-[#93a0b6]">
          Chỉ tài khoản có vai trò quản trị viên mới truy cập được khu vực này.
        </p>
        <div className="mt-7 text-left">
          <LoginForm idPrefix="admin-login" dark />
        </div>
        <Link
          href="/"
          className="focus-ring mt-6 inline-block text-[13px] font-bold text-[#22d3ee] transition hover:text-[#67e8f9]"
        >
          ← Về trang chủ
        </Link>
      </GateFrame>
    );
  }

  if (user.role !== "admin") {
    return (
      <GateFrame>
        <span className="mx-auto grid size-14 place-items-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-300">
          <ShieldAlert size={28} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-[20px] font-extrabold text-white">Không có quyền truy cập</h1>
        <p className="mt-2 text-[13px] leading-6 text-[#93a0b6]">
          Tài khoản <strong className="text-slate-200">{user.email}</strong> đang có vai trò{" "}
          <strong className="text-slate-200">{roleLabels[user.role]}</strong>. Hãy đăng nhập bằng tài
          khoản quản trị viên.
        </p>
        <div className="mt-6 grid gap-2.5">
          <button
            type="button"
            className="focus-ring inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#08b7d4] bg-gradient-to-br from-[#08b7d4] to-[#0694ae] font-extrabold text-[#031014] transition hover:brightness-110 disabled:opacity-60"
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
            <LogOut size={18} aria-hidden="true" />
            Đăng xuất và đăng nhập lại
          </button>
          <Link
            href="/"
            className="focus-ring inline-flex h-11 items-center justify-center rounded-md border border-[#2c3852] font-extrabold text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            Về trang chủ
          </Link>
        </div>
      </GateFrame>
    );
  }

  return <>{children}</>;
}

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="grid min-h-screen place-items-center px-4 py-10"
      style={{
        background:
          "radial-gradient(circle at 72% -12%, rgba(8,183,212,0.13), transparent 34rem), radial-gradient(circle at 8% 112%, rgba(34,197,94,0.09), transparent 30rem), #07090e",
      }}
    >
      <div className="w-full max-w-[400px] rounded-[16px] border border-[#26314a] bg-[#101724] p-8 text-center shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  );
}
