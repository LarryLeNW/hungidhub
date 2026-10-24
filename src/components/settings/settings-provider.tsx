"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  DEFAULT_PUBLIC_SETTINGS,
  type PublicSettings,
  phoneHref,
  zaloLinkFrom,
} from "@/lib/api/settings";

const SettingsContext = createContext<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);

export function SettingsProvider({
  settings,
  children,
}: {
  settings?: PublicSettings | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ ...DEFAULT_PUBLIC_SETTINGS, ...(settings || {}) }),
    [settings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function usePublicSettings(): PublicSettings {
  return useContext(SettingsContext);
}

export { DEFAULT_PUBLIC_SETTINGS, phoneHref, zaloLinkFrom };
