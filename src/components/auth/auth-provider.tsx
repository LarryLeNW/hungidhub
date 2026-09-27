"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  authApi,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
} from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getTokens, setTokens, subscribeToTokenChanges } from "@/lib/api/token-store";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

type AuthContextValue = {
  user: AuthUser | null;
  status: AuthStatus;
  isAdmin: boolean;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-fetches the profile with the stored session (e.g. after a profile update). */
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const refreshUser = useCallback(async () => {
    if (!getTokens()) {
      setUser(null);
      setStatus("anonymous");
      return null;
    }

    try {
      const profile = await authApi.me();
      setUser(profile);
      setStatus("authenticated");
      return profile;
    } catch (error) {
      // A rejected session is already cleared by apiFetch; only keep tokens when offline.
      if (error instanceof ApiError && !error.isNetworkError) {
        setTokens(null);
      }
      setUser(null);
      setStatus("anonymous");
      return null;
    }
  }, []);

  useEffect(() => {
    // Defer so hydration renders the same "loading" state on server and client.
    const timer = window.setTimeout(() => void refreshUser(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshUser]);

  useEffect(
    () =>
      subscribeToTokenChanges((source) => {
        if (!getTokens()) {
          setUser(null);
          setStatus("anonymous");
        } else if (source === "other-tab") {
          void refreshUser();
        }
      }),
    [refreshUser],
  );

  const login = useCallback(async (input: LoginInput) => {
    const result = await authApi.login(input);
    setTokens({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const result = await authApi.register(input);
    setTokens({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    });
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Revoking server-side is best effort; the local session is cleared regardless.
    }
    setTokens(null);
    setUser(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAdmin: user?.role === "admin",
      login,
      register,
      logout,
      refreshUser,
    }),
    [user, status, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
