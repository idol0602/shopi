"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Truck,
  XCircle,
  Eye,
  Printer,
  CreditCard,
  Building2,
  X,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Package,
} from "lucide-react";
import { formatVND } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface SellerOrder {
  id: string;
  createdAt: number;
  productId: string;
  productTitle: string;
  productImage: string;
  productPrice: number;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  paymentMethod: "VietQR / SePay Auto" | "VietQR Chuyển khoản";
  transactionCode?: string;
  status: "PENDING_PAYMENT" | "CONFIRMED" | "SHIPPED" | "CANCELLED";
  sepayVerifiedAt?: number;
}

const INITIAL_SELLER_ORDERS: SellerOrder[] = [
  {
    id: "ORD-88291",
    createdAt: Date.now() - 1000 * 60 * 35,
    productId: "prod-macbook-pro-16-m1-max",
    productTitle: "MacBook Pro 16 inch M1 Max 32GB 1TB Space Gray (Fullbox 99%)",
    productImage:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    productPrice: 43500000,
    buyerName: "Lê Tuấn Khang",
    buyerPhone: "0912.345.678",
    buyerAddress: "Số 45 Lê Duẩn, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
    paymentMethod: "VietQR / SePay Auto",
    transactionCode: "MBVCB98231244",
    status: "CONFIRMED",
    sepayVerifiedAt: Date.now() - 1000 * 60 * 20,
  },
  {
    id: "ORD-88292",
    createdAt: Date.now() - 1000 * 60 * 8,
    productId: "prod-sony-a7-iv",
    productTitle: "Sony Alpha 7 IV (ILCE-7M4) Body chính hãng Sony VN hết BH",
    productImage:
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=600&q=80",
    productPrice: 41000000,
    buyerName: "Trần Đức Nam",
    buyerPhone: "0988.112.233",
    buyerAddress: "Tòa Keangnam Landmark 72, Mễ Trì, Nam Từ Liêm, Hà Nội",
    paymentMethod: "VietQR / SePay Auto",
    status: "PENDING_PAYMENT",
  },
  {
    id: "ORD-88280",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    productId: "prod-keychron-q1-pro-wireless",
    productTitle: "Bàn phím cơ Custom Keychron Q1 Pro Bluetooth/Type-C",
    productImage:
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80",
    productPrice: 3800000,
    buyerName: "Phan Anh Vũ",
    buyerPhone: "0903.998.877",
    buyerAddress: "128 Nguyễn Thị Minh Khai, Quận 3, TP. Hồ Chí Minh",
    paymentMethod: "VietQR Chuyển khoản",
    transactionCode: "FT26301982711",
    status: "SHIPPED",
    sepayVerifiedAt: Date.now() - 1000 * 60 * 60 * 22,
  },
  {
    id: "ORD-88275",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    productId: "prod-ipad-pro-11-m2-128gb",
    productTitle: "iPad Pro 11 inch M2 WiFi 128GB Space Gray + Apple Pencil 2",
    productImage:
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=600&q=80",
    productPrice: 18200000,
    buyerName: "Nguyễn Hải Đăng",
    buyerPhone: "0977.665.544",
    buyerAddress: "Số 15 ngõ 92 Hoàng Quốc Việt, Cầu Giấy, Hà Nội",
    paymentMethod: "VietQR Chuyển khoản",
    status: "CANCELLED",
  },
];

export default function SellerOrdersPage() {
  const [orders, setOrders] = useState<SellerOrder[]>(INITIAL_SELLER_ORDERS);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<SellerOrder | null>(null);

  const shopName = "Hoàng Minh Tech";
  const sellerId = "seller-001";

  const handleManualConfirm = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: "CONFIRMED",
              transactionCode: o.transactionCode || `MANUAL-${Date.now().toString().slice(-6)}`,
              sepayVerifiedAt: Date.now(),
            }
          : o
      )
    );
  };

  const handleMarkShipped = (orderId: string) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: "SHIPPED" } : o))
    );
  };

  const filteredOrders = orders.filter((o) => {
    const matchesFilter = filterStatus === "ALL" || o.status === filterStatus;
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.productTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.transactionCode && o.transactionCode.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
      {/* Top Header */}
      <div className="border-b border-zinc-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              Cửa hàng: {shopName} (Mã: {sellerId})
            </span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-xs text-zinc-400">
              Quản lý Bán Hàng
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-zinc-300" />
            Hóa Đơn & Đơn Hàng Của Shop
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Theo dõi danh sách khách mua, đối soát biến động số dư SePay tự động và xuất hóa đơn bán hàng.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/seller/settings/sepay"
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 transition"
          >
            <CreditCard className="h-3.5 w-3.5 text-zinc-400" />
            <span>Cài đặt SePay riêng</span>
          </Link>
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="text-xs text-zinc-400">Tổng doanh thu Shop</div>
          <div className="mt-1 text-xl font-bold font-mono text-white">
            {formatVND(
              orders
                .filter((o) => o.status === "CONFIRMED" || o.status === "SHIPPED")
                .reduce((acc, curr) => acc + curr.productPrice, 0)
            )}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400">Tự động khớp qua SePay</div>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4">
          <div className="text-xs text-amber-300">Đơn chờ thanh toán (15m)</div>
          <div className="mt-1 text-xl font-bold font-mono text-amber-400">
            {orders.filter((o) => o.status === "PENDING_PAYMENT").length} đơn
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Đang giữ chỗ hàng</div>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4">
          <div className="text-xs text-emerald-300">Đã thanh toán (Cần ship)</div>
          <div className="mt-1 text-xl font-bold font-mono text-emerald-400">
            {orders.filter((o) => o.status === "CONFIRMED").length} đơn
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Sẵn sàng đóng gói gửi hàng</div>
        </div>

        <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4">
          <div className="text-xs text-blue-300">Đang giao hàng</div>
          <div className="mt-1 text-xl font-bold font-mono text-blue-400">
            {orders.filter((o) => o.status === "SHIPPED").length} đơn
          </div>
          <div className="mt-1 text-[11px] text-zinc-400">Đang vận chuyển đồng kiểm</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "PENDING_PAYMENT", label: "Chờ thanh toán" },
            { id: "CONFIRMED", label: "Đã thanh toán" },
            { id: "SHIPPED", label: "Đang giao" },
            { id: "CANCELLED", label: "Đã hủy" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterStatus(tab.id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition",
                filterStatus === tab.id
                  ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Mã đơn, Khách, Sản phẩm..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-9 pr-3 text-xs text-zinc-200 placeholder-zinc-500 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-900/80 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Mã đơn & Ngày tạo</th>
                <th className="py-3.5 px-4 font-semibold">Sản phẩm</th>
                <th className="py-3.5 px-4 font-semibold">Giá trị đơn</th>
                <th className="py-3.5 px-4 font-semibold">Người mua</th>
                <th className="py-3.5 px-4 font-semibold">Thanh toán & SePay</th>
                <th className="py-3.5 px-4 font-semibold">Trạng thái</th>
                <th className="py-3.5 px-4 font-semibold text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500">
                    Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-zinc-900/40 transition group"
                  >
                    {/* Order ID & Date */}
                    <td className="py-4 px-4 font-mono">
                      <div className="font-bold text-zinc-100 flex items-center gap-1">
                        {order.id}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </div>
                    </td>

                    {/* Product */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3 max-w-xs">
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                          <Image
                            src={order.productImage}
                            alt={order.productTitle}
                            fill
                            sizes="44px"
                            className="object-cover"
                          />
                        </div>
                        <div className="truncate font-medium text-zinc-200">
                          {order.productTitle}
                        </div>
                      </div>
                    </td>

                    {/* Price */}
                    <td className="py-4 px-4 font-mono font-bold text-white whitespace-nowrap">
                      {formatVND(order.productPrice)}
                    </td>

                    {/* Buyer */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="font-semibold text-zinc-200">
                        {order.buyerName}
                      </div>
                      <div className="text-[11px] text-zinc-500 font-mono">
                        {order.buyerPhone}
                      </div>
                    </td>

                    {/* Payment & SePay */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
                        <Building2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{order.paymentMethod}</span>
                      </div>
                      {order.transactionCode ? (
                        <div className="font-mono text-[10px] text-emerald-400 mt-0.5">
                          Mã GD: {order.transactionCode}
                        </div>
                      ) : (
                        <div className="text-[10px] text-zinc-500 mt-0.5 italic">
                          Chờ sao kê SePay...
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      {order.status === "PENDING_PAYMENT" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                          <Clock className="h-3 w-3 animate-pulse" />
                          Chờ thanh toán (15m)
                        </span>
                      )}
                      {order.status === "CONFIRMED" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Đã thanh toán (SePay)
                        </span>
                      )}
                      {order.status === "SHIPPED" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-400">
                          <Truck className="h-3 w-3" />
                          Đang giao hàng
                        </span>
                      )}
                      {order.status === "CANCELLED" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-500">
                          <XCircle className="h-3 w-3" />
                          Đã hủy
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {order.status === "PENDING_PAYMENT" && (
                          <button
                            type="button"
                            onClick={() => handleManualConfirm(order.id)}
                            className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 hover:bg-emerald-900/40 transition"
                            title="Xác nhận nhận tiền thủ công"
                          >
                            Xác nhận đã nhận tiền
                          </button>
                        )}

                        {order.status === "CONFIRMED" && (
                          <button
                            type="button"
                            onClick={() => handleMarkShipped(order.id)}
                            className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-950/20 px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:bg-blue-900/40 transition"
                            title="Xác nhận đã gửi hàng cho shipper"
                          >
                            <Truck className="h-3 w-3" />
                            <span>Đã gửi hàng</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceOrder(order)}
                          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 hover:text-white transition"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Chi tiết HĐ</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoiceOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-2xl space-y-6">
            <button
              type="button"
              onClick={() => setSelectedInvoiceOrder(null)}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-white transition"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Invoice Header */}
            <div className="border-b border-zinc-800 pb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950 font-black text-base">
                    S
                  </div>
                  <span className="text-base font-bold text-white">
                    Hóa Đơn Bán Hàng - {shopName}
                  </span>
                </div>
                <p className="mt-1 text-xs text-zinc-400 font-mono">
                  Mã hóa đơn: {selectedInvoiceOrder.id}
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono text-zinc-500">
                  Ngày lập:{" "}
                  {new Date(selectedInvoiceOrder.createdAt).toLocaleDateString("vi-VN")}
                </span>
                <div className="mt-1">
                  {selectedInvoiceOrder.status === "CONFIRMED" ||
                  selectedInvoiceOrder.status === "SHIPPED" ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      ĐÃ THANH TOÁN (SEPAY KHỚP LỆNH)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
                      CHỜ THANH TOÁN
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Buyer & Seller Info */}
            <div className="grid grid-cols-2 gap-6 text-xs">
              <div className="space-y-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
                <div className="text-[11px] font-semibold uppercase text-zinc-400">
                  Đơn vị bán hàng
                </div>
                <div className="font-bold text-zinc-100">{shopName}</div>
                <div className="text-zinc-400">Mã Shop: {sellerId}</div>
                <div className="text-zinc-400">Tài khoản nhận: SePay Gateway</div>
              </div>

              <div className="space-y-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3.5">
                <div className="text-[11px] font-semibold uppercase text-zinc-400">
                  Thông tin người mua
                </div>
                <div className="font-bold text-zinc-100">
                  {selectedInvoiceOrder.buyerName}
                </div>
                <div className="text-zinc-400">SĐT: {selectedInvoiceOrder.buyerPhone}</div>
                <div className="text-zinc-400 truncate">
                  Đ/C: {selectedInvoiceOrder.buyerAddress}
                </div>
              </div>
            </div>

            {/* Product Item Line */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 border-b border-zinc-800 pb-2">
                <span>Tên mặt hàng</span>
                <span>Thành tiền</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-zinc-700">
                    <Image
                      src={selectedInvoiceOrder.productImage}
                      alt={selectedInvoiceOrder.productTitle}
                      fill
                      sizes="40px"
                      className="object-cover"
                    />
                  </div>
                  <span className="font-medium text-zinc-200">
                    {selectedInvoiceOrder.productTitle}
                  </span>
                </div>
                <span className="font-mono font-bold text-white">
                  {formatVND(selectedInvoiceOrder.productPrice)}
                </span>
              </div>

              <div className="border-t border-zinc-800 pt-3 flex items-center justify-between text-sm font-bold">
                <span className="text-zinc-300">Tổng thanh toán:</span>
                <span className="font-mono text-emerald-400">
                  {formatVND(selectedInvoiceOrder.productPrice)}
                </span>
              </div>
            </div>

            {/* Transaction Ref Details */}
            {selectedInvoiceOrder.transactionCode && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 text-xs text-emerald-300 space-y-1 font-mono">
                <div>Mã đối soát giao dịch ngân hàng: {selectedInvoiceOrder.transactionCode}</div>
                <div className="text-[11px] text-emerald-400/80">
                  Phương thức: {selectedInvoiceOrder.paymentMethod}
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Bảo chứng giao dịch Shopi Escrow</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>In hóa đơn</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedInvoiceOrder(null)}
                  className="rounded-xl bg-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-zinc-300 transition"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
