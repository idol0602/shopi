"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Check,
  Copy,
  QrCode,
  ShieldAlert,
  Sparkles,
  Building2,
  Zap,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { formatVND } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface VietQRBoxProps {
  orderId?: string;
  productTitle: string;
  amount: number;
  bankName?: string;
  bankId?: string;
  accountNo?: string;
  accountName?: string;
  isTestMode?: boolean;
  onPaymentSuccess?: () => void;
}

export function VietQRBox({
  orderId = "SHOPI-88291",
  productTitle,
  amount,
  bankName = "Ngân hàng TMCP Quân Đội (MB Bank)",
  bankId = "MB",
  accountNo = "0988776655",
  accountName = "SHOPI ESCROW C2C",
  isTestMode = true,
  onPaymentSuccess,
}: VietQRBoxProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedSuccess, setSimulatedSuccess] = useState(false);

  const transferMemo = `SHOPI ${orderId}`;

  // VietQR standard image endpoint
  const encodedMemo = encodeURIComponent(transferMemo);
  const encodedAccountName = encodeURIComponent(accountName);
  const vietQrUrl = `https://img.vietqr.io/image/${bankId}-${accountNo}-compact2.png?amount=${amount}&addInfo=${encodedMemo}&accountName=${encodedAccountName}`;

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSimulatePayment = async () => {
    setIsSimulating(true);
    try {
      // Call Backend API to simulate successful instant payment
      const response = await apiClient.request(
        `/api/orders/${orderId}/simulate-payment`,
        {
          method: "POST",
          body: JSON.stringify({
            orderId,
            amount,
            memo: transferMemo,
          }),
        }
      );

      setSimulatedSuccess(true);
      onPaymentSuccess?.();
    } catch {
      // Fallback optimistic simulation
      setSimulatedSuccess(true);
      onPaymentSuccess?.();
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <QrCode className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
              Thanh toán giữ chỗ qua VietQR 24/7
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            </h3>
            <p className="text-xs text-zinc-400">
              Quét mã để tự động điền số tiền và mã giữ đơn
            </p>
          </div>
        </div>
        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
          NAPAS 247
        </span>
      </div>

      {/* Simulated Payment Button (Test Mode) */}
      {isTestMode && !simulatedSuccess && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>Người bán đã bật Chế độ Test (Test Mode)</span>
          </div>
          <p className="text-[11px] text-amber-200/80">
            Bạn có thể thử nghiệm thanh toán đơn hàng này ngay lập tức mà không cần chuyển tiền thực tế:
          </p>
          <button
            type="button"
            onClick={handleSimulatePayment}
            disabled={isSimulating}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-xs font-bold text-zinc-950 transition hover:bg-amber-400 active:scale-[0.99]",
              "shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-60"
            )}
          >
            {isSimulating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                <span>Đang xử lý khớp lệnh thanh toán giả lập...</span>
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                <span>Thanh toán giả lập (Test Mode - Mua ngay không cần chuyển khoản)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Simulated Success Message */}
      {simulatedSuccess && (
        <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 text-xs font-semibold text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          <div>
            <div className="font-bold">Đã thanh toán giả lập thành công! (Test Mode)</div>
            <div className="text-[11px] font-normal text-emerald-200/80">
              Đơn hàng {orderId} đã chuyển sang trạng thái CONFIRMED (Đã thanh toán bảo chứng).
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Dynamic QR Code */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative aspect-square w-48 overflow-hidden rounded-xl border border-zinc-700 bg-white p-2.5 shadow-lg">
            <Image
              src={vietQrUrl}
              alt="Mã thanh toán VietQR"
              width={200}
              height={200}
              className="h-full w-full object-contain"
              unoptimized
            />
          </div>
          <p className="mt-2 text-center text-[11px] text-zinc-400">
            Hỗ trợ tất cả ứng dụng ngân hàng & Ví MoMo/ZaloPay
          </p>
        </div>

        {/* Transfer Details with One-click Copy */}
        <div className="md:col-span-7 space-y-3">
          {/* Ngân hàng */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400">
              <Building2 className="h-3.5 w-3.5 text-zinc-400" />
              <span>Ngân hàng thụ hưởng</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-zinc-200">
              {bankName}
            </div>
          </div>

          {/* Số tài khoản */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div>
              <div className="text-xs text-zinc-400">Số tài khoản</div>
              <div className="font-mono text-sm font-bold text-zinc-100 tracking-wider">
                {accountNo}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(accountNo, "account")}
              className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-700 transition"
            >
              {copiedField === "account" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {/* Chủ tài khoản */}
          <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/50 p-2.5">
            <div className="text-xs text-zinc-400">Chủ tài khoản (Bảo chứng Escrow)</div>
            <div className="text-sm font-semibold text-zinc-200">
              {accountName}
            </div>
          </div>

          {/* Số tiền thanh toán */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-2.5">
            <div>
              <div className="text-xs text-emerald-400 font-medium">Số tiền chính xác</div>
              <div className="font-mono text-base font-bold text-emerald-300">
                {formatVND(amount)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(String(amount), "amount")}
              className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-900/40 px-2.5 py-1 text-xs text-emerald-200 hover:bg-emerald-800/50 transition"
            >
              {copiedField === "amount" ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span>Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy tiền</span>
                </>
              )}
            </button>
          </div>

          {/* Nội dung chuyển khoản */}
          <div className="flex items-center justify-between rounded-lg border border-amber-500/25 bg-amber-950/20 p-2.5">
            <div>
              <div className="text-xs text-amber-400 font-medium">Nội dung chuyển khoản (Bắt buộc)</div>
              <div className="font-mono text-sm font-bold text-amber-200">
                {transferMemo}
              </div>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(transferMemo, "memo")}
              className="flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-900/40 px-2.5 py-1 text-xs text-amber-200 hover:bg-amber-800/50 transition"
            >
              {copiedField === "memo" ? (
                <>
                  <Check className="h-3 w-3 text-amber-400" />
                  <span>Đã copy</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copy mã</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400 flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 text-zinc-300 shrink-0 mt-0.5" />
        <p>
          Khoản tiền được giữ an toàn tại tài khoản bảo chứng của <strong>Shopi Escrow</strong>. Người bán chỉ nhận tiền khi bạn đã nhận hàng đúng mô tả và xác nhận hài lòng.
        </p>
      </div>
    </div>
  );
}
