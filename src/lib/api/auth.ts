import { apiFetch } from "./client";

export type AuthRole = "admin" | "customer";

/** Mirrors `User` from the backend (secret columns are never returned). */
export type AuthUser = {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: AuthRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresIn: string;
};

export type AuthResult = { user: AuthUser; tokens: AuthTokens };

export type LoginInput = { email: string; password: string };
export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
};
export type ChangePasswordInput = { currentPassword: string; newPassword: string };

export const roleLabels: Record<AuthRole, string> = {
  admin: "Quản trị viên",
  customer: "Khách hàng",
};

export const authApi = {
  register: (input: RegisterInput) =>
    apiFetch<AuthResult>("/auth/register", { method: "POST", body: input, auth: false }),

  login: (input: LoginInput) =>
    apiFetch<AuthResult>("/auth/login", { method: "POST", body: input, auth: false }),

  me: () => apiFetch<AuthUser>("/auth/me"),

  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),

  changePassword: (input: ChangePasswordInput) =>
    apiFetch<void>("/auth/password", { method: "PATCH", body: input }),
};
