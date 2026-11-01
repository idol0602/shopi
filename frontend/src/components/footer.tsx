import React from "react";
import Link from "next/link";
import { Shield, Zap, RefreshCw, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-20 border-t border-zinc-900 bg-zinc-950 text-zinc-400">
      {/* Value Proposition Highlights */}
      <div className="border-b border-zinc-900">
        <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Khóa giữ chỗ độc quyền
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Hệ thống Saga khóa hàng 15 phút, chống tranh chấp và double-spending.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Zap className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Thanh toán VietQR 24/7
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Quét mã QR Napas247 tức thì, tự động khớp lệnh giữ đơn chính xác.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Ví bảo chứng Escrow
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Tiền chuyển về tài khoản trung gian, người bán chỉ nhận khi khách hài lòng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300">
                <RefreshCw className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-zinc-200">
                  Hoàn tiền tự động
                </h4>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Hàng không đúng mô tả hoặc hủy đơn? Hoàn tiền 100% trong 24 giờ làm việc.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-zinc-900 pt-6">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-zinc-300">Shopi Inc.</span>
            <span className="text-xs text-zinc-600">|</span>
            <span className="text-xs text-zinc-500">
              © {new Date().getFullYear()} Shopi C2C Marketplace. All rights reserved.
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs text-zinc-500">
            <Link href="/" className="hover:text-zinc-300 transition">
              Điều khoản dịch vụ
            </Link>
            <Link href="/" className="hover:text-zinc-300 transition">
              Chính sách bảo mật
            </Link>
            <Link href="/" className="hover:text-zinc-300 transition">
              Quy chế hoạt động sàn
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
