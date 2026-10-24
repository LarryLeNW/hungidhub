"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  LoaderCircle,
  QrCode,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { TingTingHelpers } from "@/helpers/TingTingHelpers";
import { formatCurrency } from "@/lib/format";
import {
  walletApi,
  type ApiFundRequest,
} from "@/lib/api/wallet";
import { getBankBin } from "@/components/orders/order-summary";

const QUICK_AMOUNTS = [50_000, 100_000, 200_000, 500_000, 1_000_000, 2_000_000];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="focus-ring inline-flex h-6 cursor-pointer items-center gap-1 rounded border border-border bg-white px-1.5 text-[10px] font-bold text-slate-600 hover:text-primary-strong"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          // clipboard unavailable
        }
      }}
    >
      {copied ? <CheckCircle2 size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? "Đã chép" : "Chép"}
    </button>
  );
}

export function DepositModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const [amount, setAmount] = useState<number>(100_000);
  const [customAmountStr, setCustomAmountStr] = useState<string>("100000");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fundRequest, setFundRequest] = useState<ApiFundRequest | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setAmount(100_000);
      setCustomAmountStr("100000");
      setError(null);
      setFundRequest(null);
      setIsCompleted(false);
    }
  }

  const handleQuickSelect = (val: number) => {
    setAmount(val);
    setCustomAmountStr(String(val));
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "");
    setCustomAmountStr(raw);
    const parsed = Number(raw) || 0;
    setAmount(parsed);
    setError(null);
  };

  const handleCreateDeposit = async () => {
    if (amount < 10_000) {
      setError("Số tiền nạp tối thiểu là 10.000đ");
      return;
    }
    if (amount > 500_000_000) {
      setError("Số tiền nạp tối đa là 500.000.000đ");
      return;
    }

    setPending(true);
    setError(null);
    try {
      const res = await walletApi.createDeposit(amount);
      setFundRequest(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo yêu cầu nạp tiền.");
    } finally {
      setPending(false);
    }
  };

  // Polling for completion
  const fundRequestId = fundRequest?.id;
  const fundRequestStatus = fundRequest?.status;

  useEffect(() => {
    if (!fundRequestId || fundRequestStatus !== "pending") return;

    const timer = window.setInterval(async () => {
      try {
        const updated = await walletApi.getFundRequest(fundRequestId);
        setFundRequest(updated);
        if (updated.status === "completed") {
          setIsCompleted(true);
          onSuccess?.();
        }
      } catch {
        // network retry
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [fundRequestId, fundRequestStatus, onSuccess]);

  const instructions = fundRequest?.paymentInstructions;

  const qrPayload = useMemo(() => {
    if (!instructions) return "";
    try {
      const bin = getBankBin(instructions.bankName);
      const accountNo = instructions.accountNumber.replace(/\s/g, "");
      return TingTingHelpers.generateQrCodeEMVCO(
        Math.round(instructions.amount),
        bin,
        accountNo,
        instructions.transferContent,
      );
    } catch (e) {
      console.error("EMVCo QR error:", e);
      return "";
    }
  }, [instructions]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full ${
          fundRequest ? "max-w-[530px]" : "max-w-[440px]"
        } max-h-[calc(100dvh-2rem)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-100 transition-all duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-white shadow-xs">
              <Wallet size={16} />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-slate-900 leading-tight">Nạp tiền vào ví AIHUB</h3>
              <p className="text-[11px] text-slate-500 font-medium">Tự động cộng tiền 24/7 qua VietQR</p>
            </div>
          </div>
          <button
            type="button"
            className="grid size-7 place-items-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto">
          {isCompleted ? (
            <div className="text-center py-4 space-y-3">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 animate-in zoom-in-75 duration-300">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h4 className="text-[17px] font-black text-slate-950">Nạp tiền thành công!</h4>
                <p className="mt-1 text-[13px] text-slate-600">
                  Đã cộng <strong>{formatCurrency(fundRequest?.amount ?? amount)}</strong> vào số dư ví của bạn.
                </p>
              </div>
              <button
                type="button"
                className="focus-ring mt-1 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary font-extrabold text-white transition hover:bg-primary-strong shadow-md shadow-emerald-500/20"
                onClick={onClose}
              >
                Hoàn tất
              </button>
            </div>
          ) : !fundRequest ? (
            <div className="space-y-3.5">
              {/* Quick Amount Options */}
              <div>
                <label className="block text-[12px] font-bold text-slate-700 mb-1.5">
                  Chọn số tiền nạp nhanh
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {QUICK_AMOUNTS.map((val) => {
                    const isSelected = amount === val;
                    return (
                      <button
                        key={val}
                        type="button"
                        className={`focus-ring h-8.5 rounded-lg border text-[12px] font-extrabold transition cursor-pointer ${
                          isSelected
                            ? "border-primary bg-emerald-50/80 text-primary-strong shadow-xs"
                            : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        onClick={() => handleQuickSelect(val)}
                      >
                        {formatCurrency(val)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom input */}
              <div>
                <label htmlFor="custom-amount-input" className="block text-[12px] font-bold text-slate-700 mb-1">
                  Hoặc nhập số tiền tùy chọn
                </label>
                <div className="relative">
                  <input
                    id="custom-amount-input"
                    type="text"
                    inputMode="numeric"
                    value={customAmountStr ? Number(customAmountStr).toLocaleString("vi-VN") : ""}
                    placeholder="Tối thiểu 10.000đ"
                    className="focus-ring h-9.5 w-full rounded-lg border border-slate-200 bg-white px-3 pr-11 text-[14px] font-black text-slate-900 outline-none transition focus:border-primary"
                    onChange={handleCustomChange}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] font-bold text-slate-400">
                    VND
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-[12px] text-rose-700 font-medium">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg bg-emerald-50/70 border border-emerald-100/90 px-3 py-2 text-[11px] leading-snug text-emerald-800">
                <Sparkles size={14} className="shrink-0 text-amber-500" />
                <span>Tự động cộng tiền 24/7 sau 2-5s • Nhận tài khoản tức thì • Hoàn tiền tự động nếu hủy.</span>
              </div>

              <button
                type="button"
                disabled={pending || amount < 10_000}
                className="focus-ring inline-flex h-9.5 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary font-extrabold text-[13px] text-white transition hover:bg-primary-strong disabled:opacity-60 shadow-xs"
                onClick={handleCreateDeposit}
              >
                {pending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <>
                    <span>Tạo mã QR nạp tiền</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* QR Code view */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-center sm:items-stretch gap-3">
                {/* Left: QR Code */}
                <div className="flex flex-col items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50/50 p-2.5 text-center shrink-0 w-full sm:w-[160px]">
                  {qrPayload ? (
                    <div className="rounded-lg bg-white p-2 shadow-xs border border-slate-200/80">
                      <QRCodeSVG
                        value={qrPayload}
                        size={130}
                        level="M"
                        includeMargin={false}
                      />
                    </div>
                  ) : (
                    <p className="text-xs text-rose-500">Không thể tạo mã VietQR</p>
                  )}
                  <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-800">
                    <QrCode size={13} />
                    <span>Quét mã VietQR</span>
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-slate-500">
                    <LoaderCircle size={10} className="animate-spin text-primary" />
                    <span>Chờ chuyển khoản...</span>
                  </div>
                </div>

                {/* Right: Bank Instructions */}
                {instructions && (
                  <dl className="flex-1 min-w-0 divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 text-[12px] flex flex-col justify-between w-full">
                    <div className="flex items-center justify-between pb-1">
                      <dt className="text-slate-500">Ngân hàng</dt>
                      <dd className="font-extrabold text-slate-900 truncate ml-2">{instructions.bankName}</dd>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <dt className="text-slate-500">Số tài khoản</dt>
                      <dd className="flex items-center gap-1.5 font-extrabold text-slate-900 ml-2">
                        <span>{instructions.accountNumber}</span>
                        <CopyButton value={instructions.accountNumber} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <dt className="text-slate-500">Chủ tài khoản</dt>
                      <dd className="font-extrabold text-slate-900 truncate ml-2">{instructions.accountName}</dd>
                    </div>
                    <div className="flex items-center justify-between py-1">
                      <dt className="text-slate-500">Số tiền nạp</dt>
                      <dd className="flex items-center gap-1.5 font-black text-emerald-600 ml-2">
                        <span>{formatCurrency(instructions.amount)}</span>
                        <CopyButton value={String(Math.round(instructions.amount))} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <dt className="text-slate-500">Nội dung CK</dt>
                      <dd className="flex items-center gap-1.5 font-black text-primary-strong ml-2">
                        <span className="rounded bg-white px-1.5 py-0.5 border border-primary/20 text-[11px]">
                          {instructions.transferContent}
                        </span>
                        <CopyButton value={instructions.transferContent} />
                      </dd>
                    </div>
                  </dl>
                )}
              </div>

              <p className="text-center text-[10.5px] text-slate-400">
                Lưu ý: Chuyển đúng nội dung để hệ thống tự động cộng tiền sau 2-5 giây.
              </p>

              <button
                type="button"
                className="w-full text-center text-[11.5px] font-bold text-slate-500 hover:text-slate-800 transition py-0.5"
                onClick={() => setFundRequest(null)}
              >
                ← Đổi số tiền nạp khác
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
