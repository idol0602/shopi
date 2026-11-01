"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  X,
  Send,
  Image as ImageIcon,
  CheckCircle,
  Paperclip,
  Trash2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { Product } from "@/types/marketplace";
import { ChatMessage } from "@/types/chat";
import { formatVND } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface ProductChatModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

export function ProductChatModal({
  product,
  isOpen,
  onClose,
}: ProductChatModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      senderId: product.sellerId || "seller-001",
      senderRole: "SELLER",
      senderName: product.sellerName || "Người bán Shopi",
      text: `Xin chào! Tôi là người bán của món đồ "${product.title}". Bạn có thắc mắc gì về tình trạng máy hay bảo hành không ạ?`,
      timestamp: Date.now() - 60000 * 5,
      isRead: true,
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages, isTyping]);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: "buyer-current-user",
      senderRole: "BUYER",
      senderName: "Bạn (Người mua)",
      text: inputText.trim(),
      imageUrl: attachedImage || undefined,
      timestamp: Date.now(),
      isRead: true,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    setAttachedImage(null);

    // Simulate seller auto-reply
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-reply-${Date.now()}`,
          senderId: product.sellerId,
          senderRole: "SELLER",
          senderName: product.sellerName || "Người bán",
          text: "Dạ vâng! Máy em test rất kỹ, ngoại hình đúng như ảnh chụp. Nếu ưng ý bạn có thể bấm Đặt Mua giữ chỗ 15 phút trên sàn để được Shopi bảo chứng Escrow ạ!",
          timestamp: Date.now(),
          isRead: true,
        },
      ]);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative flex flex-col h-[85vh] max-h-[680px] w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-100">
              {(product.sellerName || "U").slice(0, 1).toUpperCase()}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-zinc-950" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {product.sellerName || "Người bán Shopi"}
                </h3>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <p className="text-[11px] text-emerald-400">Đang hoạt động</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            aria-label="Đóng chat"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Product Reference Card */}
        <div className="flex items-center gap-3 border-b border-zinc-800/80 bg-zinc-900/40 p-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
            <Image
              src={product.imageUrls[0]}
              alt={product.title}
              fill
              sizes="48px"
              className="object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-medium text-zinc-200 truncate">
              {product.title}
            </h4>
            <div className="font-mono text-xs font-bold text-emerald-400">
              {formatVND(product.priceAmount)}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-800/70 px-2 py-1 rounded">
            <ShieldCheck className="h-3 w-3 text-emerald-400" />
            <span>Escrow 3 ngày</span>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
          {messages.map((msg) => {
            const isMe = msg.senderRole === "BUYER";
            return (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col max-w-[80%]",
                  isMe ? "ml-auto items-end" : "mr-auto items-start"
                )}
              >
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-xs leading-relaxed space-y-2",
                    isMe
                      ? "bg-zinc-100 text-zinc-950 rounded-br-xs"
                      : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-xs"
                  )}
                >
                  {/* Image Attachment Preview */}
                  {msg.imageUrl && (
                    <div className="relative aspect-video w-48 overflow-hidden rounded-lg border border-zinc-800/50">
                      <Image
                        src={msg.imageUrl}
                        alt="Đính kèm"
                        fill
                        sizes="192px"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <p>{msg.text}</p>
                </div>
                <span className="text-[10px] text-zinc-500 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400 w-fit">
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse delay-150" />
              <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-pulse delay-300" />
              <span className="text-[11px] ml-1">Người bán đang gõ...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Image Attachment Preview Before Sending */}
        {attachedImage && (
          <div className="relative border-t border-zinc-800 bg-zinc-900/60 p-2 flex items-center gap-3">
            <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-700">
              <Image
                src={attachedImage}
                alt="Ảnh chuẩn bị gửi"
                fill
                sizes="56px"
                className="object-cover"
              />
            </div>
            <div className="text-xs text-zinc-300 flex-1 truncate">
              Đã đính kèm ảnh
            </div>
            <button
              type="button"
              onClick={() => setAttachedImage(null)}
              className="rounded-lg p-1.5 text-red-400 hover:bg-zinc-800 transition"
              title="Xóa ảnh"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSendMessage}
          className="border-t border-zinc-800 bg-zinc-950 p-3 flex items-center gap-2"
        >
          {/* File Input for Attachments */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Đính kèm ảnh"
          >
            <ImageIcon className="h-4 w-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Nhắn tin với người bán..."
            className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />

          <button
            type="submit"
            disabled={!inputText.trim() && !attachedImage}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-40"
            title="Gửi tin"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
