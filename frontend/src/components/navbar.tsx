"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, PlusCircle, ShieldCheck, User, MessageSquare, CreditCard, FileText } from "lucide-react";
import { AuthModal } from "./auth/AuthModal";

export function Navbar() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 font-black tracking-tight text-lg shadow-sm transition-transform group-hover:scale-105">
                S
              </div>
              <div className="flex flex-col">
                <span className="text-base font-bold tracking-tight text-zinc-100 group-hover:text-white transition">
                  Shopi
                </span>
                <span className="text-[10px] font-mono tracking-widest text-zinc-400 uppercase -mt-1">
                  C2C Marketplace
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-400">
              <Link
                href="/"
                className="text-zinc-200 hover:text-white transition"
              >
                Khám phá
              </Link>
              <Link
                href="/categories"
                className="hover:text-zinc-200 transition"
              >
                Danh mục
              </Link>
              <Link
                href="/seller/orders"
                className="flex items-center gap-1 hover:text-zinc-200 transition"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Đơn & Hóa đơn</span>
              </Link>
              <Link
                href="/seller/messages"
                className="flex items-center gap-1 hover:text-zinc-200 transition"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Tin nhắn</span>
              </Link>
              <Link
                href="/seller/settings/sepay"
                className="flex items-center gap-1 hover:text-zinc-200 transition"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Cài đặt SePay</span>
              </Link>
              <div className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
                <ShieldCheck className="h-3 w-3" />
                <span>Bảo chứng Escrow</span>
              </div>
            </nav>
          </div>

          {/* Global Search Bar */}
          <div className="hidden lg:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Tìm kiếm MacBook, máy ảnh Sony, ghế Ergonomic..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/60 py-2 pl-10 pr-4 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-700 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                readOnly
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 font-mono text-[10px] text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-zinc-700/50">
                ⌘K
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/sell"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:border-zinc-600 transition"
            >
              <PlusCircle className="h-3.5 w-3.5 text-zinc-400" />
              <span>Đăng tin bán</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/90 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-800 hover:text-white transition"
              aria-label="Tài khoản / Đăng nhập"
            >
              <User className="h-4 w-4 text-zinc-400" />
              <span className="hidden sm:inline">Đăng nhập / Đăng ký</span>
            </button>
          </div>
        </div>
      </header>

      {/* Auth Modal with Google OAuth 2.0 */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </>
  );
}
