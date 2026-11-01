"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import {
  X,
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  ShieldCheck,
  KeyRound,
  RotateCw,
} from "lucide-react";
import {
  sendOtp,
  verifyOtp,
  registerWithEmail,
  loginWithEmail,
} from "@/lib/api-client";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
}

export function AuthModal({
  isOpen,
  onClose,
  defaultTab = "login",
}: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<"login" | "register">(defaultTab);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register multi-step state
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1);
  const [registerEmail, setRegisterEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [fullName, setFullName] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [isRegisterLoading, setIsRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccessMsg, setRegisterSuccessMsg] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  if (!isOpen) return null;

  // Reset modal state on close
  const handleClose = () => {
    setLoginError(null);
    setRegisterError(null);
    setRegisterSuccessMsg(null);
    setRegisterStep(1);
    onClose();
  };

  // Switch tab
  const switchTab = (tab: "login" | "register") => {
    setActiveTab(tab);
    setLoginError(null);
    setRegisterError(null);
    setRegisterSuccessMsg(null);
    if (tab === "register") {
      setRegisterStep(1);
    }
  };

  // Google OAuth 1-Click
  const handleGoogleSignIn = async () => {
    setIsLoginLoading(true);
    try {
      await signIn("google", { callbackUrl: window.location.href });
    } catch {
      setIsLoginLoading(false);
    }
  };

  // Login with Email & Password
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    setIsLoginLoading(true);
    try {
      // 1. Direct login via API Client
      const loginRes = await loginWithEmail(loginEmail.trim(), loginPassword);

      // 2. Sync session with NextAuth
      await signIn("credentials", {
        redirect: false,
        accessToken: loginRes.accessToken,
        refreshToken: loginRes.refreshToken,
        userId: loginRes.userId,
        email: loginRes.email,
        fullName: loginRes.fullName,
        role: loginRes.role,
      });

      handleClose();
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng nhập không thành công";
      setLoginError(msg);
    } finally {
      setIsLoginLoading(false);
    }
  };

  // Register - Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const email = registerEmail.trim();
    if (!email || !email.includes("@")) {
      setRegisterError("Vui lòng nhập địa chỉ email hợp lệ.");
      return;
    }

    setIsRegisterLoading(true);
    try {
      const res = await sendOtp(email);
      setRegisterSuccessMsg(res.message || "Mã OTP đã được gửi đến email của bạn.");
      setRegisterStep(2);
      startResendTimer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Không thể gửi mã OTP. Vui lòng thử lại.";
      setRegisterError(msg);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  const startResendTimer = () => {
    setResendCooldown(60);
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Register - Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setRegisterError(null);
    setIsRegisterLoading(true);
    try {
      const res = await sendOtp(registerEmail.trim());
      setRegisterSuccessMsg(res.message || "Đã gửi lại mã OTP mới.");
      startResendTimer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gửi lại OTP thất bại.";
      setRegisterError(msg);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  // Register - Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    const cleanOtp = otpCode.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setRegisterError("Vui lòng nhập đủ 6 chữ số mã OTP.");
      return;
    }

    setIsRegisterLoading(true);
    try {
      const res = await verifyOtp(registerEmail.trim(), cleanOtp);
      setVerificationToken(res.verificationToken);
      setRegisterSuccessMsg("Xác thực OTP thành công! Vui lòng đặt mật khẩu tài khoản.");
      setRegisterStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Mã OTP không đúng hoặc đã hết hạn.";
      setRegisterError(msg);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  // Register - Step 3: Complete registration with Password
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!fullName.trim()) {
      setRegisterError("Vui lòng nhập họ và tên của bạn.");
      return;
    }
    if (registerPassword.length < 6) {
      setRegisterError("Mật khẩu phải chứa ít nhất 6 ký tự.");
      return;
    }
    if (registerPassword !== confirmPassword) {
      setRegisterError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsRegisterLoading(true);
    try {
      const res = await registerWithEmail(
        registerEmail.trim(),
        registerPassword,
        fullName.trim(),
        verificationToken
      );

      // Auto login via NextAuth
      await signIn("credentials", {
        redirect: false,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        userId: res.userId,
        email: res.email,
        fullName: res.fullName,
        role: res.role,
      });

      handleClose();
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đăng ký thất bại. Vui lòng thử lại.";
      setRegisterError(msg);
    } finally {
      setIsRegisterLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 font-black text-xl shadow-md">
            S
          </div>
          <h2 className="text-lg font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            {activeTab === "login" ? "Chào mừng trở lại với Shopi" : "Đăng ký tài khoản Shopi"}
            <Sparkles className="h-4 w-4 text-amber-400" />
          </h2>
          <p className="text-xs text-zinc-400">
            Sàn C2C mua bán đồ cũ bảo chứng bằng VietQR Escrow
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
          <button
            type="button"
            onClick={() => switchTab("login")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "login"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => switchTab("register")}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              activeTab === "register"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Đăng ký
          </button>
        </div>

        {/* ================= TAB 1: ĐĂNG NHẬP ================= */}
        {activeTab === "login" && (
          <div className="space-y-4">
            {/* Google OAuth Login Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoginLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-zinc-100 shadow-sm transition hover:bg-zinc-800 hover:border-zinc-600 disabled:opacity-60"
            >
              {isLoginLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
              )}
              <span>Đăng nhập nhanh với Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <span className="relative bg-zinc-950 px-3 text-[11px] text-zinc-500 uppercase tracking-wider">
                hoặc email và mật khẩu
              </span>
            </div>

            {loginError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Địa chỉ Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="ban@vidu.com"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  <input
                    type={showLoginPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-10 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                  >
                    {showLoginPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoginLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-950 shadow transition hover:bg-white disabled:opacity-60"
              >
                {isLoginLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span>Đăng nhập</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 2: ĐĂNG KÝ ================= */}
        {activeTab === "register" && (
          <div className="space-y-4">
            {/* Google Quick Registration - No Password Needed */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isRegisterLoading}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-xs font-semibold text-emerald-300 shadow-sm transition hover:bg-emerald-900/30 hover:border-emerald-500/50 disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </svg>
              <span>Đăng ký nhanh với Google (Không cần mật khẩu)</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800" />
              </div>
              <span className="relative bg-zinc-950 px-3 text-[11px] text-zinc-500 uppercase tracking-wider">
                hoặc đăng ký với Email + OTP
              </span>
            </div>

            {/* Step Indicators */}
            <div className="flex items-center justify-between text-[11px] text-zinc-400 px-1">
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-bold text-[10px] ${
                    registerStep >= 1
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  1
                </span>
                <span className={registerStep === 1 ? "text-zinc-200 font-semibold" : ""}>
                  Nhập Email
                </span>
              </div>
              <div className="h-[1px] flex-1 mx-2 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-bold text-[10px] ${
                    registerStep >= 2
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  2
                </span>
                <span className={registerStep === 2 ? "text-zinc-200 font-semibold" : ""}>
                  Xác nhận OTP
                </span>
              </div>
              <div className="h-[1px] flex-1 mx-2 bg-zinc-800" />
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full font-bold text-[10px] ${
                    registerStep >= 3
                      ? "bg-zinc-100 text-zinc-950"
                      : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  3
                </span>
                <span className={registerStep === 3 ? "text-zinc-200 font-semibold" : ""}>
                  Mật khẩu
                </span>
              </div>
            </div>

            {/* Error & Info Banners */}
            {registerError && (
              <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{registerError}</span>
              </div>
            )}

            {registerSuccessMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{registerSuccessMsg}</span>
              </div>
            )}

            {/* STEP 1: Enter Email */}
            {registerStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Nhập địa chỉ Email của bạn
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="email"
                      value={registerEmail}
                      onChange={(e) => setRegisterEmail(e.target.value)}
                      placeholder="ban@vidu.com"
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-950 shadow transition hover:bg-white disabled:opacity-60"
                >
                  {isRegisterLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Gửi mã xác thực OTP</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 2: Verify OTP */}
            {registerStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-medium text-zinc-400">
                      Nhập mã OTP 6 chữ số
                    </label>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {registerEmail}
                    </span>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      autoFocus
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-center tracking-[0.5em] font-mono text-base font-bold text-zinc-100 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setRegisterStep(1)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition text-[11px]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Đổi email</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || isRegisterLoading}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 disabled:opacity-50 transition"
                  >
                    <RotateCw className="h-3 w-3" />
                    <span>
                      {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : "Gửi lại OTP"}
                    </span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isRegisterLoading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-950 shadow transition hover:bg-white disabled:opacity-60"
                >
                  {isRegisterLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Xác nhận mã OTP</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* STEP 3: Complete Name & Password */}
            {registerStep === 3 && (
              <form onSubmit={handleCompleteRegistration} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Họ và tên hiển thị
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      required
                      autoFocus
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Đặt mật khẩu (tối thiểu 6 ký tự)
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      value={registerPassword}
                      onChange={(e) => setRegisterPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-10 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                    >
                      {showRegisterPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Xác nhận mật khẩu
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 py-2.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRegisterLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-xs font-bold text-zinc-950 shadow transition hover:bg-white disabled:opacity-60"
                >
                  {isRegisterLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Hoàn tất đăng ký & Đăng nhập</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Security badge footer */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-400 space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Bảo chứng tài khoản Shopi</span>
          </div>
          <p className="text-[10px] leading-relaxed text-zinc-500">
            Mã OTP và thông tin đăng nhập được bảo mật qua chuẩn mã hóa BCrypt & JWT rfc7519.
          </p>
        </div>
      </div>
    </div>
  );
}
