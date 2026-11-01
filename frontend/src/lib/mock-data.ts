import { Product } from "@/types/marketplace";

export const MOCK_PRODUCTS: Product[] = [
  {
    id: "prod-macbook-pro-16-m1-max",
    title: "MacBook Pro 16 inch M1 Max 32GB 1TB Space Gray (Fullbox 99%)",
    slug: "macbook-pro-16-m1-max-32gb-1tb",
    description:
      "Máy chính chủ mua tại ShopDunk, ít mang đi lại chủ yếu cắm màn rời. Ngoại hình đẹp keng 99% không cấn móp, pin 96% sạc 48 lần. Fullbox đầy đủ củ sạc 140W MagSafe zin theo máy. Bao test 7 ngày hoàn tiền nếu có bất kỳ lỗi lầm nào.",
    priceAmount: 43500000,
    currency: "VND",
    category: "Laptop & Máy tính",
    imageUrls: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1541807084-5c52b6b3adef?auto=format&fit=crop&w=1200&q=80",
    ],
    status: "AVAILABLE",
    sellerId: "seller-user-001",
    sellerName: "Hoàng Minh Tech",
    sellerRating: 4.9,
    sellerLocation: "Quận 1, TP. Hồ Chí Minh",
    condition: "LIKE_NEW",
    conditionDetail: "99% như mới, pin 96%, fullbox phụ kiện zin",
    createdAt: Date.now() - 3600000 * 24 * 2,
    updatedAt: Date.now() - 3600000 * 2,
  },
  {
    id: "prod-sony-a7-iv",
    title: "Sony Alpha 7 IV (ILCE-7M4) Body chính hãng Sony VN hết BH",
    slug: "sony-alpha-7-iv-body-chinh-hang",
    description:
      "Cần pass lại Sony A7IV do ít dùng, chụp được khoảng 6.200 shot. Cảm biến sạch sẽ không bụi xước, màn hình dán cường lực từ ngày đầu. Kèm 2 pin zin, dock sạc đôi SmallRig và hộp đựng.",
    priceAmount: 41000000,
    currency: "VND",
    category: "Máy ảnh & Phụ kiện",
    imageUrls: [
      "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1200&q=80",
    ],
    status: "RESERVED",
    sellerId: "seller-user-002",
    sellerName: "Tuấn Studio",
    sellerRating: 5.0,
    sellerLocation: "Cầu Giấy, Hà Nội",
    reservedByUserId: "buyer-user-888",
    reservationDeadlineEpochMs: Date.now() + 12 * 60 * 1000, // 12 minutes remaining
    condition: "VERY_GOOD",
    conditionDetail: "6.200 shots, body đẹp 98%, kèm 2 pin",
    createdAt: Date.now() - 3600000 * 18,
    updatedAt: Date.now() - 60000 * 3,
  },
  {
    id: "prod-herman-miller-aeron-size-b",
    title: "Ghế công thái học Herman Miller Aeron Remastered Size B Mineral",
    slug: "herman-miller-aeron-size-b-mineral",
    description:
      "Ghế bản Mineral xám sáng sang trọng, full option: PostureFit SL, tay 3D da, ngả trước ngả sau lock góc. Hàng chính hãng D'Ergo phân phối còn bảo hành 9 năm. Lưới nguyên bản căng đét.",
    priceAmount: 26500000,
    currency: "VND",
    category: "Bàn ghế & Nội thất",
    imageUrls: [
      "https://images.unsplash.com/photo-1580481077195-c9994c97951a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1505797149-43b0069ec26b?auto=format&fit=crop&w=1200&q=80",
    ],
    status: "SOLD",
    sellerId: "seller-user-003",
    sellerName: "Đức Nguyễn",
    sellerRating: 4.8,
    sellerLocation: "Thủ Đức, TP. Hồ Chí Minh",
    condition: "LIKE_NEW",
    conditionDetail: "Còn BH chính hãng 9 năm, không trầy xước",
    createdAt: Date.now() - 3600000 * 48,
    updatedAt: Date.now() - 3600000 * 6,
  },
  {
    id: "prod-ipad-pro-11-m2-128gb",
    title: "iPad Pro 11 inch M2 WiFi 128GB Space Gray + Apple Pencil 2",
    slug: "ipad-pro-11-m2-wifi-128gb",
    description:
      "Combo iPad Pro M2 kèm Apple Pencil 2 ít dùng còn như mới. Máy sạc 25 lần, pin 100%, bảo hành Apple Care+ đến tháng 11/2026. Tặng kèm bao da nam châm ESR và dán màn hình Paperlike.",
    priceAmount: 18200000,
    currency: "VND",
    category: "Máy tính bảng",
    imageUrls: [
      "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1585790050230-5dd28404ccb9?auto=format&fit=crop&w=1200&q=80",
    ],
    status: "AVAILABLE",
    sellerId: "seller-user-004",
    sellerName: "Thanh Trúc",
    sellerRating: 4.9,
    sellerLocation: "Bình Thạnh, TP. Hồ Chí Minh",
    condition: "LIKE_NEW",
    conditionDetail: "Pin 100%, sạc 25 lần, tặng kèm Apple Pencil 2",
    createdAt: Date.now() - 3600000 * 12,
    updatedAt: Date.now() - 3600000 * 1,
  },
  {
    id: "prod-keychron-q1-pro-wireless",
    title: "Bàn phím cơ Custom Keychron Q1 Pro Bluetooth/Type-C (Gateron Jupiter Brown)",
    slug: "ban-phim-co-keychron-q1-pro",
    description:
      "Full nhôm CNC nguyên khối, đã mod tape mod, foam đáy silicon triệt âm ping. Gõ rất đầm và êm. Keycap KSA double-shot PBT không bóng dầu. Phụ kiện cáp zin, switch puller, keycap puller, hộp đầy đủ.",
    priceAmount: 3800000,
    currency: "VND",
    category: "Phụ kiện Gaming & Gear",
    imageUrls: [
      "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=1200&q=80",
    ],
    status: "AVAILABLE",
    sellerId: "seller-user-005",
    sellerName: "Phát Gear",
    sellerRating: 4.7,
    sellerLocation: "Đống Đa, Hà Nội",
    condition: "VERY_GOOD",
    conditionDetail: "Đã mod âm thanh êm ái, phím đẹp keng",
    createdAt: Date.now() - 3600000 * 72,
    updatedAt: Date.now() - 3600000 * 10,
  },
];

/**
 * Fetch a single product by slug (with gateway API check + fallback)
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  const gatewayUrl =
    process.env.API_GATEWAY_INTERNAL_URL || "http://api-gateway:8080";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${gatewayUrl}/api/products/${slug}`, {
      next: { revalidate: 60 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return data.product || data;
    }
  } catch {
    // API Gateway offline - gracefully use high fidelity mock data
  }

  const match = MOCK_PRODUCTS.find((p) => p.slug === slug);
  return match || null;
}

/**
 * Fetch all products for listings / sitemaps
 */
export async function getAllProducts(): Promise<Product[]> {
  const gatewayUrl =
    process.env.API_GATEWAY_INTERNAL_URL || "http://api-gateway:8080";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(`${gatewayUrl}/api/products`, {
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.products)) return data.products;
    }
  } catch {
    // API Gateway offline - return mock list
  }

  return MOCK_PRODUCTS;
}
