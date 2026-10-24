"use client";

import { useCallback, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  History,
  LoaderCircle,
  Plus,
  RefreshCcw,
  Wallet,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { formatDateTime } from "@/lib/dates";
import { cn } from "@/lib/cn";
import {
  walletApi,
  type ApiWalletTransaction,
} from "@/lib/api/wallet";
import { useWallet } from "./wallet-provider";

export function WalletCard({ className }: { className?: string } = {}) {
  const { balance, isLoading, refreshBalance, openDepositModal } = useWallet();
  const [transactions, setTransactions] = useState<ApiWalletTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchTransactions = useCallback(async () => {
    setLoadingTx(true);
    try {
      const res = await walletApi.getTransactions({ limit: 10 });
      setTransactions(res.items);
    } catch {
      // transient network error
    } finally {
      setLoadingTx(false);
    }
  }, []);

  const handleToggleHistory = () => {
    const next = !showHistory;
    setShowHistory(next);
    if (next) {
      void fetchTransactions();
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-slate-50 p-3 sm:p-4.5 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="grid size-9.5 sm:size-11 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-md shadow-emerald-500/20">
            <Wallet size={18} className="sm:hidden" />
            <Wallet size={20} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-[12px] font-bold uppercase tracking-wider text-slate-500 truncate">
                Số dư ví AIHUB
              </span>
              <button
                type="button"
                title="Làm mới số dư"
                className="text-slate-400 hover:text-primary transition shrink-0"
                onClick={() => void refreshBalance()}
              >
                <RefreshCcw size={12} className={isLoading ? "animate-spin" : ""} />
              </button>
            </div>
            <p className="text-[19px] sm:text-[22px] font-black tracking-tight text-slate-900 leading-tight">
              {formatCurrency(balance)}
            </p>
          </div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
          <button
            type="button"
            className="focus-ring inline-flex h-8.5 sm:h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] font-bold text-slate-700 transition hover:bg-slate-50"
            onClick={handleToggleHistory}
          >
            <History size={13} className="shrink-0" />
            <span className="truncate">{showHistory ? "Đóng lịch sử" : "Lịch sử ví"}</span>
          </button>
          <button
            type="button"
            className="focus-ring inline-flex h-8.5 sm:h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 sm:px-3 text-[11.5px] sm:text-[12px] font-extrabold text-white shadow-xs transition hover:bg-primary-strong"
            onClick={openDepositModal}
          >
            <Plus size={13} className="shrink-0" />
            <span>Nạp tiền</span>
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="mt-4 border-t border-emerald-100/80 pt-3 animate-in fade-in duration-200">
          <p className="text-[12px] font-bold text-slate-600 mb-2">Giao dịch ví gần đây</p>
          {loadingTx ? (
            <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <LoaderCircle size={14} className="animate-spin text-primary" />
              <span>Đang tải biến động số dư...</span>
            </div>
          ) : transactions.length === 0 ? (
            <p className="py-3 text-center text-[12px] text-slate-400">Chưa có giao dịch nào</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg bg-white/80 border border-slate-100 overflow-hidden">
              {transactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <li key={tx.id} className="flex items-center justify-between p-2.5 text-[12px]">
                    <div className="flex items-center gap-2">
                      <div
                        className={`grid size-7 place-items-center rounded-full ${
                          isPositive ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                        }`}
                      >
                        {isPositive ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                      </div>
                      <div>
                        <p className="font-extrabold text-slate-900 leading-tight">
                          {tx.description || (isPositive ? "Nạp tiền vào ví" : "Thanh toán đơn hàng")}
                        </p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(tx.createdAt)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-black ${
                          isPositive ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {isPositive ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Dư: {formatCurrency(tx.balanceAfter)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
