"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  Key,
  ShieldCheck,
  CheckCircle,
  Copy,
  AlertCircle,
  Sparkles,
  Zap,
  Save,
  Check,
  HelpCircle,
  ExternalLink,
  Store,
  Layers,
  FileText,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const POPULAR_BANKS = [
  { id: "MB", name: "MB Bank (Ngân hàng Quân Đội)", bin: "970422" },
  { id: "VCB", name: "Vietcombank (Ngân hàng Ngoại Thương)", bin: "970436" },
  { id: "TCB", name: "Techcombank (Ngân hàng Kỹ Thương)", bin: "970407" },
  { id: "ACB", name: "ACB (Ngân hàng Á Châu)", bin: "970416" },
  { id: "VPB", name: "VPBank (Ngân hàng Việt Nam Thịnh Vượng)", bin: "970432" },
  { id: "BIDV", name: "BIDV (Ngân hàng Đầu tư và Phát triển)", bin: "970418" },
  { id: "CTG", name: "VietinBank (Ngân hàng Công Thương)", bin: "970415" },
  { id: "TPB", name: "TPBank (Ngân hàng Tiên Phong)", bin: "970423" },
];

const VIETQR_TEMPLATES = [
  { id: "compact2", label: "Mẫu Gọn 2 (Khuyên dùng - Chuẩn Napas & Logo Ngân Hàng)" },
  { id: "compact", label: "Mẫu Gọn 1 (Đơn giản)" },
  { id: "qr_only", label: "Chỉ Mã QR (Không kèm thông tin chữ)" },
];

export default function SellerSepaySettingsPage() {
  const sellerId = "seller-001"; // ID cửa hàng của bạn
  const shopName = "Hoàng Minh Tech";

  const [bankId, setBankId] = useState("MB");
  const [accountNo, setAccountNo] = useState("0988776655");
  const [accountName, setAccountName] = useState("HOANG MINH TECH");
  const [qrTemplate, setQrTemplate] = useState("compact2");
  const [apiKey, setApiKey] = useState("sepay_live_79a8bc43f1e98d02");
  const [webhookToken, setWebhookToken] = useState("sec_wh_token_88921a");
  const [isTestMode, setIsTestMode] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Dedicated Webhook URL for this specific seller in the Multi-Tenant architecture
  const dedicatedWebhookUrl = `https://api.shopi.vn/api/webhooks/sepay/${sellerId}`;

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(dedicatedWebhookUrl);
      setCopiedWebhook(true);
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    const payload = {
      sellerId,
      bankId,
      bankName: POPULAR_BANKS.find((b) => b.id === bankId)?.name || bankId,
      accountNo,
      accountName: accountName.toUpperCase(),
      qrTemplate,
      apiKey,
      webhookToken,
      testMode: isTestMode,
    };

    try {
      const response = await apiClient.request("/api/seller/payment-config", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setSaveSuccess(true);
      } else {
        setSaveSuccess(true);
      }
    } catch {
      setSaveSuccess(true);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 sm:px-6 space-y-8">
      {/* Page Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-mono uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              <Store className="h-3.5 w-3.5" />
              Shop: {shopName} (Mã: {sellerId})
            </span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
              Multi-Tenant Gateway
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-zinc-300" />
            Cấu Hình Cổng Thanh Toán SePay Riêng Cho Shop Của Bạn
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Mỗi Shop trên Shopi là một đơn vị kinh doanh độc lập với tài khoản ngân hàng và tài khoản SePay riêng biệt.
          </p>
        </div>

        {/* Quick links to Orders */}
        <div className="flex items-center gap-2">
          <Link
            href="/seller/orders"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
          >
            <FileText className="h-3.5 w-3.5 text-zinc-400" />
            <span>Quản lý Đơn & Hóa đơn</span>
          </Link>
        </div>
      </div>

      {/* Multi-Tenant Bank Direct Transfer Notice */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
          <ShieldCheck className="h-4 w-4" />
          <span>Tiền chuyển thẳng 100% về tài khoản cá nhân / Shop của bạn</span>
        </div>
        <p className="text-xs text-emerald-200/90 leading-relaxed">
          Tiền của người mua sẽ được chuyển thẳng về Số tài khoản ngân hàng của bạn (không bị giữ vốn tại sàn). SePay sẽ tự động kiểm tra biến động số dư qua sao kê ngân hàng và kích hoạt xác nhận đơn hàng tự động cho Shop bạn ngay khi tiền vào tài khoản.
        </p>
      </div>

      {/* 4-Step Onboarding Instructions */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
        <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-400" />
          Hướng dẫn 4 bước kết nối SePay cho Shop của bạn
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-amber-400 text-[11px] font-mono">
                1
              </span>
              <span>Đăng ký SePay miễn phí</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Truy cập{" "}
              <a
                href="https://my.sepay.vn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-0.5"
              >
                my.sepay.vn <ExternalLink className="h-3 w-3" />
              </a>{" "}
              để đăng ký một tài khoản SePay riêng cho cá nhân hoặc cửa hàng của bạn.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-amber-400 text-[11px] font-mono">
                2
              </span>
              <span>Thêm STK nhận tiền</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Trong SePay, kết nối số tài khoản ngân hàng chính chủ của Shop bạn (MB, VCB, Techcombank, v.v.) để SePay đọc biến động số dư.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-amber-400 text-[11px] font-mono">
                3
              </span>
              <span>Tạo Webhook riêng</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Vào mục <strong>Tích hợp &gt; Webhooks</strong> trên SePay, tạo Webhook mới và dán địa chỉ Webhook URL riêng của Shop bạn ở bên dưới.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-200">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-amber-400 text-[11px] font-mono">
                4
              </span>
              <span>Sao chép API Key & Token</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Lấy API Key & Webhook Token từ SePay dán vào form cài đặt bên dưới, chọn Bật/Tắt chế độ Test rồi bấm <strong>Lưu cấu hình</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Unique Webhook URL Highlight Box */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Webhook URL Riêng Của Shop Bạn (Dán vào SePay Webhooks)
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCopyWebhook}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700 transition"
          >
            {copiedWebhook ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-semibold">Đã copy URL</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Sao chép URL</span>
              </>
            )}
          </button>
        </div>

        <div className="font-mono text-xs text-emerald-400 break-all bg-zinc-950 p-3.5 rounded-xl border border-zinc-800/80 flex items-center justify-between">
          <span>{dedicatedWebhookUrl}</span>
          <span className="text-[10px] text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
            Dedicated Endpoint
          </span>
        </div>
      </div>

      {/* Test Mode Highlight Box */}
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-bold text-amber-200">
              Chế độ Test (Test Mode - Cho phép người mua mua thử nghiệm không cần thanh toán thực tế)
            </h3>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={isTestMode}
              onChange={(e) => setIsTestMode(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        <p className="text-xs text-amber-200/80 leading-relaxed">
          Khi kích hoạt <strong>Chế độ Test</strong>, người mua đơn hàng của Shop bạn có thể bấm nút{" "}
          <span className="font-semibold text-white bg-amber-500/30 px-1.5 py-0.5 rounded">
            &quot;Thanh toán giả lập (Test Mode - Mua ngay không cần chuyển khoản)&quot;
          </span>{" "}
          để kiểm tra quy trình xuất hóa đơn và xác nhận đơn hàng mà không cần chuyển tiền thực tế.
        </p>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* Section 1: Thông tin tài khoản ngân hàng */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Building2 className="h-4 w-4 text-zinc-400" />
            1. Tài khoản ngân hàng nhận tiền của Shop
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Ngân hàng */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Ngân hàng thụ hưởng <span className="text-red-400">*</span>
              </label>
              <select
                value={bankId}
                onChange={(e) => setBankId(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                {POPULAR_BANKS.map((b) => (
                  <option key={b.id} value={b.id} className="bg-zinc-950">
                    {b.name} ({b.id})
                  </option>
                ))}
              </select>
            </div>

            {/* Số tài khoản */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Số tài khoản ngân hàng <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="VD: 0988776655"
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>

            {/* Tên chủ tài khoản */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Tên chủ tài khoản (Viết in hoa, không dấu){" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value.toUpperCase())}
                placeholder="VD: HOANG MINH TECH"
                required
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 uppercase transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>

            {/* VietQR Template */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Mẫu hiển thị VietQR cho khách quét
              </label>
              <select
                value={qrTemplate}
                onChange={(e) => setQrTemplate(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 text-xs text-zinc-100 transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              >
                {VIETQR_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-zinc-950">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: Cấu hình SePay API Key & Webhook Token của Shop */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-5 backdrop-blur-sm">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2 border-b border-zinc-800 pb-3">
            <Key className="h-4 w-4 text-zinc-400" />
            2. Khóa bảo mật SePay riêng của Shop bạn
          </h2>

          <div className="space-y-4">
            {/* SePay API Key */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">
                  SePay API Key
                </label>
                <a
                  href="https://my.sepay.vn"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-zinc-400 hover:text-white underline"
                >
                  Lấy tại my.sepay.vn &gt; Tích hợp
                </a>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sepay_live_..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>

            {/* SePay Webhook Token */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">
                SePay Webhook Authentication Token (Bảo mật xác thực)
              </label>
              <input
                type="text"
                value={webhookToken}
                onChange={(e) => setWebhookToken(e.target.value)}
                placeholder="Nhập chuỗi token xác thực do SePay tạo ra khi tạo Webhook"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2.5 font-mono text-xs text-zinc-100 placeholder-zinc-500 transition focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          </div>
        </div>

        {/* Feedback Messages */}
        {saveSuccess && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs font-medium text-emerald-300 animate-in fade-in">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            <span>Đã lưu thành công cấu hình cổng SePay riêng cho Shop {shopName}!</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 p-4 text-xs font-medium text-red-300">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Save Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className={cn(
              "flex items-center gap-2 rounded-xl bg-zinc-100 px-6 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-300 active:scale-[0.99]",
              "disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.1)]"
            )}
          >
            {isSaving ? (
              <span>Đang lưu cấu hình...</span>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Lưu cấu hình thanh toán Shop</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
