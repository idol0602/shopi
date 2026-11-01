"use client";

import React, { useEffect, useState } from "react";
import { Clock, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReservationTimerProps {
  initialDeadlineMs?: number;
  durationMinutes?: number;
  onExpire?: () => void;
  className?: string;
}

export function ReservationTimer({
  initialDeadlineMs,
  durationMinutes = 15,
  onExpire,
  className,
}: ReservationTimerProps) {
  // If no deadline provided, set target to durationMinutes from now
  const [targetTime] = useState<number>(() => {
    if (initialDeadlineMs && initialDeadlineMs > Date.now()) {
      return initialDeadlineMs;
    }
    return Date.now() + durationMinutes * 60 * 1000;
  });

  const [remainingSeconds, setRemainingSeconds] = useState<number>(() =>
    Math.max(0, Math.floor((targetTime - Date.now()) / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0) {
        clearInterval(interval);
        onExpire?.();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetTime, onExpire]);

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const isExpiringSoon = remainingSeconds <= 180 && remainingSeconds > 0; // <= 3 minutes
  const isExpired = remainingSeconds <= 0;

  // Total duration in seconds for progress calculation
  const totalSeconds = durationMinutes * 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, (remainingSeconds / totalSeconds) * 100)
  );

  return (
    <div
      className={cn(
        "rounded-xl border p-4 transition-all duration-300",
        isExpired
          ? "border-red-500/30 bg-red-950/20 text-red-300"
          : isExpiringSoon
          ? "border-amber-500/40 bg-amber-950/25 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.15)]"
          : "border-zinc-800 bg-zinc-900/60 text-zinc-200",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {isExpiringSoon ? (
            <AlertTriangle className="h-4 w-4 animate-bounce text-amber-400" />
          ) : (
            <Clock className="h-4 w-4 text-zinc-400" />
          )}
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {isExpired
              ? "Hết thời gian giữ chỗ"
              : isExpiringSoon
              ? "Sắp hết thời gian giữ chỗ!"
              : "Thời hạn giữ hàng độc quyền"}
          </span>
        </div>

        <div className="font-mono text-lg font-bold tracking-tight">
          {isExpired ? (
            <span className="text-red-400">00:00</span>
          ) : (
            <span
              className={cn(
                isExpiringSoon ? "text-amber-400 font-extrabold" : "text-zinc-100"
              )}
            >
              {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full transition-all duration-1000 ease-linear",
            isExpiringSoon ? "bg-amber-500" : isExpired ? "bg-red-500" : "bg-emerald-500"
          )}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
        <span>
          {isExpired
            ? "Mặt hàng đã tự động nhả kho và có thể được mua bởi người khác."
            : "Sản phẩm được khóa độc quyền cho bạn trong 15 phút để hoàn tất chuyển khoản VietQR."}
        </span>
      </div>
    </div>
  );
}
