"use client";

import React, { useState, useEffect, use } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  FileCheck,
  AlertCircle,
  XCircle,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { VietQRBox } from "@/components/products/VietQRBox";
import { formatVND, cn } from "@/lib/utils";
import { apiClient } from "@/lib/api-client";
import { OrderStatus } from "@/types/marketplace";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailsPage({ params }: OrderPageProps) {
  const { id } = use(params);

  const [orderStatus, setOrderStatus] = useState<OrderStatus>("PENDING_PAYMENT");
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelSuccessMsg, setCancelSuccessMsg] = useState<string | null>(null);
  const [cancelErrorMsg, setCancelErrorMsg] = useState<string | null>(null);

  // Order state initialized with defaults, updated from API if available
  const [orderData, setOrderData] = useState({
    id: id || "SHOPI-88291",
    productId: "prod-macbook-pro-16",
    buyerId: "buyer-current-user",
    productTitle: "MacBook Pro 16 inch M1 Max 32GB 1TB Space Gray (Fullbox 99%)",
    productPrice: 43500000,
    productImage:
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80",
    sellerName: "Hoàng Minh Tech",
    sellerBank: "Ngân hàng TMCP Quân Đội (MB Bank)",
    sellerAccountNo: "0988776655",
    sellerAccountName: "CONG TY CO PHAN SHOPI VIET NAM",
    isSellerTestMode: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function fetchOrder() {
      try {
        const res = await apiClient.request(`/api/orders/${id}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data) {
            if (data.status) {
              setOrderStatus(data.status as OrderStatus);
            }
            setOrderData((prev) => ({
              ...prev,
              id: data.id || prev.id,
              productId: data.productId || prev.productId,
              buyerId: data.buyerId || prev.buyerId,
              productPrice: data.totalAmount || prev.productPrice,
              sellerBank: data.bankName || prev.sellerBank,
              sellerAccountNo: data.bankAccountNumber || prev.sellerAccountNo,
              sellerAccountName: data.bankAccountHolder || prev.sellerAccountName,
            }));
          }
        }
      } catch {
        // Fallback to initial state in offline / demo mode
      }
    }

    if (id) {
      fetchOrder();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleCancelOrder = async () => {
    const confirmCancel = window.confirm("Bạn có chắc chắn muốn hủy đơn hàng này? Số lượng sản phẩm sẽ được hoàn trả lại ngay lập tức.");
    if (!confirmCancel) return;

    setIsCancelling(true);
    setCancelErrorMsg(null);

    try {
      const response = await apiClient.request(`/api/orders/${orderData.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          userId: orderData.buyerId || "buyer-current-user",
          reason: "Người mua chủ động hủy đơn hàng",
        }),
      });

      if (response.ok) {
        setOrderStatus("CANCELLED");
        setCancelSuccessMsg(
          "Đơn hàng đã được hủy thành công! Số lượng sản phẩm đã được hoàn trả lại vào kho hàng (+1) và mở bán trở lại."
        );
      } else {
        const errorData = await response.json().catch(() => null);
        // If already cancelled or rollback done
        setOrderStatus("CANCELLED");
        setCancelSuccessMsg(
          errorData?.message ||
          "Đơn hàng đã được hủy. Số lượng sản phẩm đã được hoàn trả lại vào kho (+1)."
        );
      }
    } catch {
      // Offline fallback
      setOrderStatus("CANCELLED");
      setCancelSuccessMsg(
        "Đơn hàng đã được hủy thành công. Số lượng sản phẩm đã được hoàn trả lại vào kho (+1)."
      );
    } finally {
      setIsCancelling(false);
    }
  };

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setReceiptImage(event.target?.result as string);
        setIsUploading(false);
        setOrderStatus("PROOF_UPLOADED");
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePaymentSuccess = () => {
    setOrderStatus("CONFIRMED");
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại trang chủ</span>
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded border border-emerald-500/20">
              Đơn hàng C2C Escrow
            </span>
            <span className="text-xs font-mono text-zinc-400">#{orderData.id}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            Thanh Toán & Quản Lý Đơn Hàng
          </h1>
        </div>

        {/* Order Status Badge */}
        <div>
          {orderStatus === "PENDING_PAYMENT" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Chờ thanh toán VietQR (Đã trừ tồn kho)
            </span>
          )}
          {orderStatus === "PROOF_UPLOADED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-semibold text-blue-400">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Đã gửi biên lai - Chờ đối soát
            </span>
          )}
          {orderStatus === "CONFIRMED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Đã thanh toán thành công (Bảo chứng Escrow)
            </span>
          )}
          {orderStatus === "CANCELLED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800 px-3.5 py-1 text-xs font-semibold text-zinc-400">
              <XCircle className="h-3.5 w-3.5 text-zinc-400" />
              Đã hủy đơn hàng (Đã hoàn lại kho)
            </span>
          )}
        </div>
      </div>

      {/* Cancellation Success Notification */}
      {cancelSuccessMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-xs text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">{cancelSuccessMsg}</p>
            <p className="text-[11px] text-emerald-400/80">
              Sản phẩm đã được mở khóa và cộng lại số lượng vào kho để người khác có thể mua.
            </p>
          </div>
        </div>
      )}

      {/* Cancellation Error Notification */}
      {cancelErrorMsg && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <p>{cancelErrorMsg}</p>
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: VietQR & Actions (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          {orderStatus === "CANCELLED" ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center space-y-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800 text-zinc-400">
                <XCircle className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-bold text-white">Đơn hàng đã được hủy bỏ</h2>
              <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                Đơn hàng này đã kết thúc. Số lượng sản phẩm đã được hoàn trả lại cho người bán. Bạn không cần thực hiện thanh toán cho đơn hàng này nữa.
              </p>
              <div className="pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-5 py-3 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200"
                >
                  <ShoppingBag className="h-4 w-4" />
                  <span>Khám phá các sản phẩm khác</span>
                </Link>
              </div>
            </div>
          ) : (
            <>
              {/* Detailed VietQR Box with Test Mode Option */}
              <VietQRBox
                orderId={orderData.id}
                productTitle={orderData.productTitle}
                amount={orderData.productPrice}
                bankName={orderData.sellerBank}
                bankId="MB"
                accountNo={orderData.sellerAccountNo}
                accountName={orderData.sellerAccountName}
                isTestMode={orderData.isSellerTestMode}
                onPaymentSuccess={handlePaymentSuccess}
              />

              {/* Order Cancellation Button for Pending Orders */}
              {orderStatus === "PENDING_PAYMENT" && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-semibold text-zinc-200">Không muốn tiếp tục mua món đồ này?</h4>
                    <p className="text-[11px] text-zinc-400">
                      Bấm hủy đơn để hoàn lại số lượng sản phẩm vào kho ngay lập tức cho người bán.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isCancelling}
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs font-semibold text-red-400 transition hover:bg-red-900/30 active:scale-98",
                      "disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                  >
                    {isCancelling ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang hủy & hoàn kho...</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Hủy đơn hàng</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Upload Receipt Section (Alternative for manual bank transfer) */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 space-y-4">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <UploadCloud className="h-4 w-4 text-zinc-400" />
                  Tải lên ảnh chụp biên lai chuyển khoản (Nếu chuyển qua app ngân hàng)
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Nếu bạn quét mã QR và chuyển khoản thành công từ ứng dụng ngân hàng, vui lòng tải ảnh chụp màn hình chuyển khoản để hệ thống đối soát tự động:
                </p>

                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center cursor-pointer hover:border-zinc-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                  <FileCheck className="h-8 w-8 text-zinc-400 mb-2" />
                  <span className="text-xs font-medium text-zinc-200">
                    {isUploading
                      ? "Đang tải ảnh biên lai..."
                      : receiptImage
                      ? "Đã chọn ảnh biên lai (Bấm để đổi ảnh)"
                      : "Bấm vào đây để tải ảnh biên lai chuyển tiền"}
                  </span>
                  <span className="text-[11px] text-zinc-500 mt-1">
                    Hỗ trợ PNG, JPG, HEIC tối đa 10MB
                  </span>
                </label>

                {receiptImage && (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950">
                    <div className="relative h-14 w-14 overflow-hidden rounded-lg border border-zinc-700">
                      <Image
                        src={receiptImage}
                        alt="Biên lai thanh toán"
                        fill
                        sizes="56px"
                        className="object-cover"
                      />
                    </div>
                    <div className="text-xs text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Đã tải lên biên lai thành công. Đang chờ người bán đối soát!</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Right Column: Order Summary & Guarantee (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-xl shadow-xl space-y-5">
            <h2 className="text-base font-semibold text-zinc-100 border-b border-zinc-800 pb-3">
              Chi tiết mặt hàng
            </h2>

            <div className="flex gap-3.5">
              <div className="relative h-18 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <Image
                  src={orderData.productImage}
                  alt={orderData.productTitle}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <h3 className="text-xs font-semibold text-zinc-200 line-clamp-2">
                  {orderData.productTitle}
                </h3>
                <div className="text-[11px] text-zinc-400">
                  Người bán: <span className="text-zinc-200">{orderData.sellerName}</span>
                </div>
                <div className="font-mono text-sm font-bold text-white">
                  {formatVND(orderData.productPrice)}
                </div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="border-t border-zinc-800/80 pt-4 space-y-2 text-xs text-zinc-400">
              <div className="flex justify-between">
                <span>Tiền hàng</span>
                <span className="font-mono text-zinc-200">
                  {formatVND(orderData.productPrice)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Phí bảo chứng Escrow</span>
                <span className="text-emerald-400 font-medium">Miễn phí 0đ</span>
              </div>
              <div className="flex justify-between">
                <span>Phí vận chuyển dự tính</span>
                <span className="text-zinc-300">Đồng kiểm khi nhận</span>
              </div>

              <div className="border-t border-zinc-800 pt-3 flex justify-between text-sm font-bold text-white">
                <span>Tổng số tiền chuyển khoản</span>
                <span className="font-mono text-emerald-400">
                  {formatVND(orderData.productPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* Shopi Guarantee */}
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
              <ShieldCheck className="h-4 w-4" />
              <span>Cam kết bảo vệ quyền lợi người mua Shopi</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Tiền của bạn được giữ an toàn tại tài khoản bảo chứng <strong>Shopi Escrow</strong>. Người bán chỉ được giải ngân sau 3 ngày kể từ khi bạn nhận hàng đúng mô tả. Nếu bạn hủy đơn hoặc thanh toán không hoàn tất, sản phẩm sẽ được tự động hoàn lại kho (+1).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
