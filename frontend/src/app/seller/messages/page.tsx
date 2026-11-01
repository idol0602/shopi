"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search,
  Send,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { ChatConversation, ChatMessage } from "@/types/chat";
import { formatVND } from "@/lib/utils";
import { cn } from "@/lib/utils";

const INITIAL_CONVERSATIONS: ChatConversation[] = [
  {
    id: "conv-1",
    productId: "prod-macbook-pro-16-m1-max",
    productTitle: "MacBook Pro 16 inch M1 Max 32GB 1TB Space Gray (Fullbox 99%)",
    productPrice: 43500000,
    productImage:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    otherUserId: "buyer-001",
    otherUserName: "Lê Tuấn Khang",
    otherUserAvatar: "K",
    lastMessage: "Anh ơi MacBook Pro 16 M1 Max này pin còn tốt không anh? Có bớt chút xăng xe được không?",
    lastMessageTime: Date.now() - 1000 * 60 * 12,
    unreadCount: 1,
    messages: [
      {
        id: "m-101",
        senderId: "buyer-001",
        senderRole: "BUYER",
        senderName: "Lê Tuấn Khang",
        text: "Chào shop! Em đang quan tâm con MacBook Pro 16 M1 Max này.",
        timestamp: Date.now() - 1000 * 60 * 45,
        isRead: true,
      },
      {
        id: "m-102",
        senderId: "seller-user-001",
        senderRole: "SELLER",
        senderName: "Bạn (Người bán)",
        text: "Dạ chào bạn Khang! Máy chính chủ mình dùng cắm màn hình rời là chủ yếu, ngoại hình 99% keng xà beng nhé.",
        timestamp: Date.now() - 1000 * 60 * 30,
        isRead: true,
      },
      {
        id: "m-103",
        senderId: "buyer-001",
        senderRole: "BUYER",
        senderName: "Lê Tuấn Khang",
        text: "Anh ơi MacBook Pro 16 M1 Max này pin còn tốt không anh? Có bớt chút xăng xe được không?",
        timestamp: Date.now() - 1000 * 60 * 12,
        isRead: false,
      },
    ],
  },
  {
    id: "conv-2",
    productId: "prod-sony-a7-iv",
    productTitle: "Sony Alpha 7 IV (ILCE-7M4) Body chính hãng Sony VN hết BH",
    productPrice: 41000000,
    productImage:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
    otherUserId: "buyer-002",
    otherUserName: "Trần Đức Nam",
    otherUserAvatar: "N",
    lastMessage: "Em đã chuyển khoản đặt giữ chỗ 15 phút qua VietQR rồi nhé shop!",
    lastMessageTime: Date.now() - 1000 * 60 * 55,
    unreadCount: 0,
    messages: [
      {
        id: "m-201",
        senderId: "buyer-002",
        senderRole: "BUYER",
        senderName: "Trần Đức Nam",
        text: "Shop ơi máy chụp bao nhiêu shot rồi?",
        timestamp: Date.now() - 1000 * 60 * 120,
        isRead: true,
      },
      {
        id: "m-202",
        senderId: "seller-user-001",
        senderRole: "SELLER",
        senderName: "Bạn (Người bán)",
        text: "Dạ khoảng 6.200 shot thôi ạ, sensor sạch bóng không một hạt bụi.",
        timestamp: Date.now() - 1000 * 60 * 80,
        isRead: true,
      },
      {
        id: "m-203",
        senderId: "buyer-002",
        senderRole: "BUYER",
        senderName: "Trần Đức Nam",
        text: "Em đã chuyển khoản đặt giữ chỗ 15 phút qua VietQR rồi nhé shop!",
        imageUrl:
          "https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80",
        timestamp: Date.now() - 1000 * 60 * 55,
        isRead: true,
      },
    ],
  },
  {
    id: "conv-3",
    productId: "prod-ipad-pro-11-m2-128gb",
    productTitle: "iPad Pro 11 inch M2 WiFi 128GB Space Gray + Apple Pencil 2",
    productPrice: 18200000,
    productImage:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
    otherUserId: "buyer-003",
    otherUserName: "Hoàng Minh Trí",
    otherUserAvatar: "T",
    lastMessage: "Pencil 2 có kèm đầu ngòi thay thế không ạ?",
    lastMessageTime: Date.now() - 1000 * 60 * 60 * 4,
    unreadCount: 0,
    messages: [
      {
        id: "m-301",
        senderId: "buyer-003",
        senderRole: "BUYER",
        senderName: "Hoàng Minh Trí",
        text: "Pencil 2 có kèm đầu ngòi thay thế không ạ?",
        timestamp: Date.now() - 1000 * 60 * 60 * 4,
        isRead: true,
      },
    ],
  },
];

export default function SellerMessagesPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>(INITIAL_CONVERSATIONS);
  const [activeConvId, setActiveConvId] = useState<string>("conv-1");
  const [searchQuery, setSearchQuery] = useState("");
  const [inputText, setInputText] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeConv =
    conversations.find((c) => c.id === activeConvId) || conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConv?.messages]);

  const handleSelectConversation = (id: string) => {
    setActiveConvId(id);
    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c))
    );
  };

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

  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend !== undefined ? textToSend : inputText;
    if (!text.trim() && !attachedImage) return;

    const newMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderId: "seller-user-001",
      senderRole: "SELLER",
      senderName: "Bạn (Người bán)",
      text: text.trim(),
      imageUrl: attachedImage || undefined,
      timestamp: Date.now(),
      isRead: true,
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === activeConvId) {
          return {
            ...c,
            lastMessage: text.trim() || "[Đã gửi một hình ảnh]",
            lastMessageTime: Date.now(),
            messages: [...c.messages, newMessage],
          };
        }
        return c;
      })
    );

    setInputText("");
    setAttachedImage(null);
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.otherUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.productTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const quickReplies = [
    "Dạ máy vẫn còn ạ!",
    "Bao test 7 ngày hoàn tiền 100% nếu có lỗi ạ.",
    "Bạn cứ bấm Đặt Mua giữ chỗ 15 phút trên sàn để được Shopi bảo chứng nhé!",
    "Mình có bớt chút lộc may mắn cho bạn qua lấy trực tiếp nha.",
  ];

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Top Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Hộp Thư Tin Nhắn Khách Hàng
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-xs font-mono font-normal text-zinc-400">
              Seller Studio
            </span>
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Trao đổi trực tiếp với người mua, hỗ trợ gửi ảnh tình trạng máy và chốt đơn an toàn.
          </p>
        </div>
      </div>

      {/* Main Inbox Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 h-[750px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Left Column: Conversation List (4 Cols) */}
        <div className="md:col-span-4 border-r border-zinc-800/80 flex flex-col bg-zinc-900/30">
          {/* Search Box */}
          <div className="p-3.5 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm khách hàng hoặc sản phẩm..."
                className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
              />
            </div>
          </div>

          {/* List Stream */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50 scrollbar-thin">
            {filteredConversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => handleSelectConversation(c.id)}
                  className={cn(
                    "w-full text-left p-4 transition flex items-start gap-3.5",
                    isActive
                      ? "bg-zinc-800/60 border-l-2 border-emerald-400"
                      : "hover:bg-zinc-900/40"
                  )}
                >
                  {/* User Avatar */}
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-200">
                    {c.otherUserAvatar || c.otherUserName.slice(0, 1)}
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-zinc-950">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>

                  {/* Conversation Preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-semibold text-zinc-100 truncate">
                        {c.otherUserName}
                      </h4>
                      <span className="text-[10px] text-zinc-500 shrink-0">
                        {new Date(c.lastMessageTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-zinc-400 truncate font-medium">
                      {c.productTitle}
                    </p>

                    <p
                      className={cn(
                        "mt-1 text-xs truncate",
                        c.unreadCount > 0 ? "text-zinc-100 font-semibold" : "text-zinc-500"
                      )}
                    >
                      {c.lastMessage}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Conversation (8 Cols) */}
        <div className="md:col-span-8 flex flex-col bg-zinc-950">
          {/* Active Chat Header with Product Details */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-sm font-bold text-zinc-100">
                {activeConv.otherUserAvatar || activeConv.otherUserName.slice(0, 1)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {activeConv.otherUserName}
                </h3>
                <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Đang trực tuyến</span>
                </div>
              </div>
            </div>

            {/* Linked Product Banner */}
            <div className="hidden sm:flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 p-2">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
                <Image
                  src={activeConv.productImage}
                  alt={activeConv.productTitle}
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </div>
              <div className="max-w-[180px]">
                <div className="text-xs text-zinc-200 truncate font-medium">
                  {activeConv.productTitle}
                </div>
                <div className="font-mono text-xs font-bold text-emerald-400">
                  {formatVND(activeConv.productPrice)}
                </div>
              </div>
            </div>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
            {activeConv.messages.map((msg) => {
              const isMe = msg.senderRole === "SELLER";
              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[75%]",
                    isMe ? "ml-auto items-end" : "mr-auto items-start"
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-xs leading-relaxed space-y-2.5",
                      isMe
                        ? "bg-zinc-100 text-zinc-950 rounded-br-xs"
                        : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-bl-xs"
                    )}
                  >
                    {/* Image Attachment Preview */}
                    {msg.imageUrl && (
                      <div className="relative aspect-video w-64 overflow-hidden rounded-xl border border-zinc-800/80 shadow-md">
                        <Image
                          src={msg.imageUrl}
                          alt="Ảnh đính kèm"
                          fill
                          sizes="256px"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>
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
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Reply Templates */}
          <div className="px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/30 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[11px] text-zinc-500 whitespace-nowrap">
              Trả lời nhanh:
            </span>
            {quickReplies.map((reply, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(reply)}
                className="whitespace-nowrap rounded-lg border border-zinc-800 bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800 transition"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Image Attachment Preview Before Sending */}
          {attachedImage && (
            <div className="border-t border-zinc-800 bg-zinc-900/80 p-2.5 flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-700">
                <Image
                  src={attachedImage}
                  alt="Ảnh chuẩn bị gửi"
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </div>
              <div className="text-xs text-zinc-200 flex-1 truncate">
                Đã đính kèm ảnh (Sẽ gửi cùng tin nhắn)
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

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="border-t border-zinc-800 bg-zinc-950 p-4 flex items-center gap-2.5"
          >
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
              title="Đính kèm ảnh thực tế"
            >
              <ImageIcon className="h-4 w-4" />
            </button>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nhập câu trả lời cho khách hàng..."
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
            />

            <button
              type="submit"
              disabled={!inputText.trim() && !attachedImage}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-950 transition hover:bg-zinc-300 disabled:opacity-40"
              title="Gửi"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
