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
import { useAuth } from "@/components/auth/auth-provider";
import { walletApi, type ApiWallet } from "@/lib/api/wallet";
import { DepositModal } from "./deposit-modal";

type WalletContextValue = {
  wallet: ApiWallet | null;
  balance: number;
  isLoading: boolean;
  refreshBalance: () => Promise<void>;
  isDepositModalOpen: boolean;
  openDepositModal: () => void;
  closeDepositModal: () => void;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const [wallet, setWallet] = useState<ApiWallet | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

  const refreshBalance = useCallback(async () => {
    if (status !== "authenticated" || !user) {
      setWallet(null);
      return;
    }
    try {
      setIsLoading(true);
      const data = await walletApi.getMe();
      setWallet(data);
    } catch {
      // transient network or offline
    } finally {
      setIsLoading(false);
    }
  }, [status, user]);

  useEffect(() => {
    let active = true;
    if (status === "authenticated" && user) {
      walletApi
        .getMe()
        .then((data) => {
          if (active) {
            setWallet(data);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [status, user]);

  const openDepositModal = useCallback(() => {
    setIsDepositModalOpen(true);
  }, []);

  const closeDepositModal = useCallback(() => {
    setIsDepositModalOpen(false);
  }, []);

  const handleDepositSuccess = useCallback(() => {
    void refreshBalance();
  }, [refreshBalance]);

  const activeWallet = status === "authenticated" && user ? wallet : null;

  const value = useMemo<WalletContextValue>(
    () => ({
      wallet: activeWallet,
      balance: activeWallet?.balance ?? 0,
      isLoading,
      refreshBalance,
      isDepositModalOpen,
      openDepositModal,
      closeDepositModal,
    }),
    [
      activeWallet,
      isLoading,
      refreshBalance,
      isDepositModalOpen,
      openDepositModal,
      closeDepositModal,
    ],
  );

  return (
    <WalletContext.Provider value={value}>
      {children}
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={closeDepositModal}
        onSuccess={handleDepositSuccess}
      />
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}
