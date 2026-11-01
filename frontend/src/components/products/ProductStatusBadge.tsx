import React from "react";
import { ProductStatus } from "@/types/marketplace";
import { cn } from "@/lib/utils";

interface ProductStatusBadgeProps {
  status: ProductStatus;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function ProductStatusBadge({
  status,
  className,
  size = "md",
}: ProductStatusBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-medium",
    md: "px-2.5 py-1 text-xs font-semibold tracking-wide",
    lg: "px-3.5 py-1.5 text-sm font-semibold tracking-wide",
  };

  if (status === "AVAILABLE") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
          sizeClasses[size],
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        Khả dụng (Còn hàng)
      </span>
    );
  }

  if (status === "RESERVED") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
          sizeClasses[size],
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        Đang giữ chỗ (Reserved)
      </span>
    );
  }

  if (status === "OUT_OF_STOCK") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 text-red-400",
          sizeClasses[size],
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
        Hết hàng (Out of Stock)
      </span>
    );
  }

  if (status === "SOLD") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 text-zinc-400",
          sizeClasses[size],
          className
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        Đã bán (Sold Out)
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 text-zinc-500 text-xs px-2.5 py-1",
        className
      )}
    >
      Ẩn
    </span>
  );
}
