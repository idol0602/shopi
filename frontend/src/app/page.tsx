import Link from "next/link";
import Image from "next/image";
import { getAllProducts } from "@/lib/mock-data";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { formatVND } from "@/lib/utils";
import {
  ShieldCheck,
  Zap,
  Lock,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
} from "lucide-react";

export const revalidate = 60; // 60s ISR

export default async function HomePage() {
  const products = await getAllProducts();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 space-y-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-b from-zinc-900/80 via-zinc-950 to-zinc-950 p-8 sm:p-14 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3.5 py-1 text-xs font-medium text-zinc-300 backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>Nền tảng thương mại C2C Đồ cũ thế hệ mới</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white leading-tight">
            Mua bán đồ cũ minh bạch.{" "}
            <span className="bg-gradient-to-r from-zinc-200 via-zinc-400 to-zinc-600 bg-clip-text text-transparent">
              Không lo lừa đảo.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-2xl">
            Cơ chế khóa giữ hàng Saga 15 phút độc quyền, ngăn chặn trùng đơn,
            kết hợp tài khoản bảo chứng <strong>Shopi Escrow</strong> qua VietQR 24/7.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/#featured"
              className="flex items-center gap-2 rounded-xl bg-zinc-100 px-6 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-300"
            >
              <span>Xem hàng đang bán</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="flex items-center gap-6 px-4 py-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-emerald-400" />
                Khóa giữ chỗ 15m
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-emerald-400" />
                VietQR Napas247
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Escrow 3 ngày
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Grid */}
      <section id="featured" className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
              Sản phẩm nổi bật trên sàn
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Được kiểm định ngoại hình và nguồn gốc rõ ràng
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Trạng thái:</span>
            <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-400 font-medium">
              Khả dụng
            </span>
            <span className="rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-400 font-medium">
              Đang giữ chỗ
            </span>
            <span className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-0.5 text-zinc-500">
              Đã bán
            </span>
          </div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const primaryImage =
              product.imageUrls[0] ||
              "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?auto=format&fit=crop&w=1200&q=80";

            return (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-900/40 backdrop-blur-sm transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/80 hover:shadow-2xl"
              >
                {/* Image Frame */}
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-950">
                  <Image
                    src={primaryImage}
                    alt={product.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-transparent to-transparent pointer-events-none" />

                  {/* Top Status Badge */}
                  <div className="absolute top-3 right-3">
                    <ProductStatusBadge status={product.status} size="sm" />
                  </div>

                  {/* Category Chip */}
                  <div className="absolute bottom-3 left-3">
                    <span className="rounded-md border border-zinc-700/80 bg-zinc-900/80 px-2 py-0.5 text-[11px] font-medium text-zinc-300 backdrop-blur-md">
                      {product.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-1 flex-col p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-100 group-hover:text-white transition line-clamp-2 leading-snug">
                    {product.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-2 flex-1">
                    {product.description}
                  </p>

                  <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-mono text-zinc-500">
                        Giá công khai
                      </div>
                      <div className="font-mono text-base font-bold text-zinc-50">
                        {formatVND(product.priceAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                      <MapPin className="h-3 w-3 text-zinc-500" />
                      <span>{product.sellerLocation?.split(",")[0] || "VN"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
