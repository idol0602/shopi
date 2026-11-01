import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getProductBySlug,
  getAllProducts,
} from "@/lib/mock-data";
import { ProductGallery } from "@/components/products/ProductGallery";
import { BuyActionSection } from "@/components/products/BuyActionSection";
import { ChatWithSellerButton } from "@/components/chat/ChatWithSellerButton";
import { ProductStatusBadge } from "@/components/products/ProductStatusBadge";
import { formatVND, formatRelativeTime } from "@/lib/utils";
import {
  ShieldCheck,
  ChevronRight,
  MapPin,
  Star,
  Clock,
  PackageCheck,
  Truck,
  RotateCcw,
  CheckCircle,
} from "lucide-react";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

// SSG / ISR configuration
export const revalidate = 60; // Revalidate every 60 seconds

// Dynamic Static Params Generation
export async function generateStaticParams() {
  const products = await getAllProducts();
  return products.map((product) => ({
    slug: product.slug,
  }));
}

/**
 * Dynamic Metadata Generation for SEO, OpenGraph & Twitter Cards
 */
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Không tìm thấy sản phẩm | Shopi C2C",
      description: "Sản phẩm không tồn tại hoặc đã bị gỡ bỏ khỏi sàn.",
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn";
  const canonicalUrl = `${siteUrl}/products/${product.slug}`;
  const priceFormatted = formatVND(product.priceAmount);
  const primaryImage =
    product.imageUrls[0] ||
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80";

  const ogTitle = `${product.title} - ${priceFormatted} | Shopi`;
  const ogDescription = `${product.condition ? `[${product.condition}] ` : ""}${product.description.slice(0, 160)}... Giao dịch bảo chứng Escrow qua VietQR 24/7.`;

  return {
    title: ogTitle,
    description: ogDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      url: canonicalUrl,
      siteName: "Shopi C2C Marketplace",
      locale: "vi_VN",
      type: "website",
      images: [
        {
          url: primaryImage,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: ogDescription,
      images: [primaryImage],
    },
  };
}

/**
 * Server Component: Product Detail Page
 */
export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn";
  const productUrl = `${siteUrl}/products/${product.slug}`;

  // Map product status to Schema.org item availability
  const schemaAvailability =
    product.status === "AVAILABLE"
      ? "https://schema.org/InStock"
      : product.status === "RESERVED"
      ? "https://schema.org/PreOrder"
      : "https://schema.org/Discontinued";

  // Dynamic JSON-LD Structured Data: Product + BreadcrumbList
  const jsonLdStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        "@id": `${productUrl}#product`,
        name: product.title,
        description: product.description,
        image: product.imageUrls,
        category: product.category,
        itemCondition: "https://schema.org/UsedCondition",
        offers: {
          "@type": "Offer",
          price: product.priceAmount,
          priceCurrency: "VND",
          availability: schemaAvailability,
          url: productUrl,
          priceValidUntil: "2027-12-31",
          seller: {
            "@type": "Person",
            name: product.sellerName || "Người bán xác thực Shopi",
          },
        },
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: product.sellerRating || 4.9,
          reviewCount: 32,
          bestRating: 5,
          worstRating: 1,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${productUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Trang chủ",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Sản phẩm",
            item: `${siteUrl}/products`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: product.category,
            item: `${siteUrl}/categories/${encodeURIComponent(product.category)}`,
          },
          {
            "@type": "ListItem",
            position: 4,
            name: product.title,
            item: productUrl,
          },
        ],
      },
      {
        "@type": "Store",
        "@id": `${siteUrl}#store`,
        name: "Shopi C2C Used-Goods Marketplace",
        url: siteUrl,
        description: "Sàn thương mại điện tử C2C đồ cũ chính hãng với cơ chế bảo chứng VietQR Escrow",
        priceRange: "₫₫₫",
        paymentAccepted: "VietQR, Chuyển khoản ngân hàng 24/7, Escrow",
        currenciesAccepted: "VND",
        address: {
          "@type": "PostalAddress",
          addressLocality: product.sellerLocation || "Hà Nội",
          addressCountry: "VN",
        },
      },
    ],
  };

  return (
    <>
      {/* Dynamic JSON-LD Script Injection for Search Engine Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLdStructuredData),
        }}
      />

      <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="mb-6 flex items-center gap-2 text-xs text-zinc-400 overflow-x-auto whitespace-nowrap pb-1"
        >
          <Link href="/" className="hover:text-zinc-200 transition">
            Trang chủ
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <Link href="/products" className="hover:text-zinc-200 transition">
            Sản phẩm
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <span className="text-zinc-300">{product.category}</span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
          <span className="text-zinc-100 font-medium truncate max-w-[240px]">
            {product.title}
          </span>
        </nav>

        {/* Main Product Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Left Column: Image Gallery & Details */}
          <div className="lg:col-span-7 space-y-8">
            {/* Image Gallery */}
            <ProductGallery images={product.imageUrls} title={product.title} />

            {/* Seller Information Card */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-base font-bold text-zinc-100">
                    {(product.sellerName || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-semibold text-zinc-100">
                        {product.sellerName || "Người bán Shopi"}
                      </h4>
                      <CheckCircle className="h-4 w-4 text-emerald-400" />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                      <span className="flex items-center gap-1 text-amber-400">
                        <Star className="h-3.5 w-3.5 fill-amber-400" />
                        <span className="font-semibold">
                          {product.sellerRating || "5.0"}
                        </span>
                        <span className="text-zinc-500">(32 đánh giá)</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-zinc-500" />
                        <span>{product.sellerLocation || "Hà Nội"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex flex-col items-end text-xs text-zinc-400">
                  <span className="text-emerald-400 font-medium">
                    Phản hồi &lt; 15 phút
                  </span>
                  <span className="text-zinc-500 text-[11px] mt-0.5">
                    Đăng {formatRelativeTime(product.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
              <h3 className="text-base font-semibold text-zinc-100 border-b border-zinc-800/80 pb-3">
                Mô tả chi tiết sản phẩm
              </h3>
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line space-y-3">
                {product.description}
              </div>

              {/* Specs & Condition Pill Box */}
              {product.conditionDetail && (
                <div className="mt-4 rounded-lg border border-zinc-800/90 bg-zinc-950/60 p-4">
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Tình trạng thực tế được kiểm tra
                  </div>
                  <p className="text-xs text-zinc-200">
                    {product.conditionDetail}
                  </p>
                </div>
              )}
            </div>

            {/* Escrow Guarantee Service Information */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5 space-y-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <h4 className="text-sm font-semibold">
                  Chính sách bảo chứng Shopi Escrow
                </h4>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Tất cả các giao dịch trên Shopi đều được giữ tiền an toàn 100% trong vòng 3 ngày sau khi nhận hàng. Người bán chỉ nhận được thanh toán khi người mua xác nhận đã nhận hàng đúng như mô tả và hình ảnh.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <PackageCheck className="h-4 w-4 text-emerald-400" />
                  <span>Đồng kiểm khi nhận</span>
                </div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-emerald-400" />
                  <span>Hoàn tiền nếu sai hàng</span>
                </div>
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-400" />
                  <span>Giao hàng hỏa tốc</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Pricing & Action Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="sticky top-24 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-xl shadow-2xl space-y-6">
              {/* Category & Title */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                    {product.category}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono">
                    ID: {product.id.slice(0, 12)}
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-50 leading-snug">
                  {product.title}
                </h1>
              </div>

              {/* Price Tag */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="text-xs text-zinc-400">Giá bán công khai</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-mono text-3xl font-extrabold tracking-tight text-white">
                    {formatVND(product.priceAmount)}
                  </span>
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Bao phí Escrow
                  </span>
                </div>
              </div>

              {/* Interactive Buy / Reservation Section */}
              <BuyActionSection product={product} />

              {/* Chat with Seller Action Button */}
              <ChatWithSellerButton product={product} />

              {/* Trust Features Checklist */}
              <div className="border-t border-zinc-800/80 pt-5 space-y-2.5 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Trừ kho ngay lập tức khi đặt hàng, tự động hoàn trả nếu hủy</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Thanh toán chuyển khoản VietQR chuẩn Napas 247</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Được mở hộp kiểm tra ngoại hình và chức năng trước</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
