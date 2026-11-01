"use client";

import React, { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Product } from "@/types/marketplace";
import { ProductChatModal } from "./ProductChatModal";

interface ChatWithSellerButtonProps {
  product: Product;
}

export function ChatWithSellerButton({ product }: ChatWithSellerButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/90 px-4 py-3 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800 hover:border-zinc-600 active:scale-[0.99]"
      >
        <MessageSquare className="h-4 w-4 text-zinc-400" />
        <span>Nhắn tin với người bán</span>
      </button>

      <ProductChatModal
        product={product}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
