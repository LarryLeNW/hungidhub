"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { AuthUser } from "@/lib/api/auth";

const inputClass =
  "mt-2 h-11 w-full rounded-md border border-border bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-primary disabled:bg-slate-50";
const labelClass = "block text-sm font-bold text-slate-800";
const inputDarkClass =
  "dark-input mt-2 h-11 w-full rounded-md border border-[#26314a] bg-[#0c1320] px-3 text-[14px] text-slate-100 outline-none transition focus:border-[rgba(8,183,212,0.65)] focus:shadow-[0_0_0_3px_rgba(8,183,212,0.14)] disabled:opacity-60";
const labelDarkClass = "block text-sm font-bold text-slate-300";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

export function FormError({ message, dark = false }: { message: string | null; dark?: boolean }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={`whitespace-pre-line rounded-md border px-3 py-2 text-[13px] font-semibold leading-5 ${
        dark ? "border-red-400/25 bg-red-500/10 text-red-300" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message}
    </p>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
  minLength,
  dark = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled?: boolean;
  minLength?: number;
  dark?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        className={`${dark ? inputDarkClass : inputClass} pr-11`}
        type={visible ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        disabled={disabled}
        minLength={minLength}
        required
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <button
        type="button"
        className={`focus-ring absolute right-2 top-1/2 mt-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full ${dark ? "text-slate-400 hover:text-[#22d3ee]" : "text-slate-500 hover:text-slate-800"}`}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        onClick={() => setVisible((current) => !current)}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function SubmitButton({ pending, dark = false, children }: { pending: boolean; dark?: boolean; children: string }) {
  return (
    <button
      className={`focus-ring inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-md font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        dark
          ? "border border-[#08b7d4] bg-gradient-to-br from-[#08b7d4] to-[#0694ae] text-[#031014] hover:brightness-110"
          : "bg-primary text-white hover:bg-primary-strong"
      }`}
      type="submit"
      disabled={pending}
    >
      {pending ? <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function LoginForm({
  onSuccess,
  idPrefix = "login",
  dark = false,
}: {
  onSuccess?: (user: AuthUser) => void;
  idPrefix?: string;
  dark?: boolean;
}) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await login({ email: email.trim(), password });
      onSuccess?.(user);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit} noValidate={false}>
      <label className={dark ? labelDarkClass : labelClass} htmlFor={`${idPrefix}-email`}>
        Email
        <input
          id={`${idPrefix}-email`}
          className={dark ? inputDarkClass : inputClass}
          type="email"
          value={email}
          autoComplete="email"
          inputMode="email"
          required
          disabled={pending}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </label>
      <label className={dark ? labelDarkClass : labelClass} htmlFor={`${idPrefix}-password`}>
        Mật khẩu
        <PasswordInput
          id={`${idPrefix}-password`}
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          disabled={pending}
          dark={dark}
        />
      </label>
      <FormError message={error} dark={dark} />
      <SubmitButton pending={pending} dark={dark}>Đăng nhập</SubmitButton>
    </form>
  );
}

export function RegisterForm({
  onSuccess,
  idPrefix = "register",
}: {
  onSuccess?: (user: AuthUser) => void;
  idPrefix?: string;
}) {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPending(true);
    try {
      const user = await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
      onSuccess?.(user);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className={labelClass} htmlFor={`${idPrefix}-name`}>
        Họ tên
        <input
          id={`${idPrefix}-name`}
          className={inputClass}
          type="text"
          value={fullName}
          autoComplete="name"
          minLength={2}
          required
          disabled={pending}
          onChange={(event) => setFullName(event.currentTarget.value)}
        />
      </label>
      <label className={labelClass} htmlFor={`${idPrefix}-email`}>
        Email
        <input
          id={`${idPrefix}-email`}
          className={inputClass}
          type="email"
          value={email}
          autoComplete="email"
          inputMode="email"
          required
          disabled={pending}
          onChange={(event) => setEmail(event.currentTarget.value)}
        />
      </label>
      <label className={labelClass} htmlFor={`${idPrefix}-phone`}>
        Số điện thoại
        <input
          id={`${idPrefix}-phone`}
          className={inputClass}
          type="tel"
          value={phone}
          autoComplete="tel"
          inputMode="tel"
          required
          disabled={pending}
          onChange={(event) => setPhone(event.currentTarget.value)}
        />
      </label>
      <label className={labelClass} htmlFor={`${idPrefix}-password`}>
        Mật khẩu <span className="font-medium text-muted">(tối thiểu 8 ký tự)</span>
        <PasswordInput
          id={`${idPrefix}-password`}
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          disabled={pending}
        />
      </label>
      <label className={labelClass} htmlFor={`${idPrefix}-password-confirm`}>
        Xác nhận mật khẩu
        <PasswordInput
          id={`${idPrefix}-password-confirm`}
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          autoComplete="new-password"
          minLength={8}
          disabled={pending}
        />
      </label>
      <FormError message={error} />
      <SubmitButton pending={pending}>Tạo tài khoản</SubmitButton>
    </form>
  );
}
