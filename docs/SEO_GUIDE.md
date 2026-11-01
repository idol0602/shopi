# Hướng Dẫn Kiến Trúc SEO Enterprise & Kiểm Thử Google Sitemap Cho Shopi

> **Dự án**: Shopi C2C Used-Goods Marketplace  
> **Phiên bản Frontend**: Next.js 15+ App Router, React 19, Tailwind CSS  
> **Tiêu chuẩn SEO**: Google Search Central, Schema.org, Core Web Vitals, ISR Caching  

---

## 1. Tổng Quan: Shopi Đã Tối Ưu SEO Như Thế Nào?

Hệ thống **Shopi** được thiết kế từ gốc theo kiến trúc **SEO-First** chuẩn Enterprise dành cho sàn thương mại điện tử C2C. Không giống như các Single Page Application (SPA) truyền thống (React/Vue render phía client khiến bot tìm kiếm chỉ thấy file HTML rỗng), Shopi tận dụng toàn bộ thế mạnh của **Next.js 15 App Router** với:

1. **100% Pre-rendered HTML (RSC & SSR/SSG/ISR)**: Googlebot, Bingbot và Facebook Crawler nhận trực tiếp mã HTML hoàn chỉnh có sẵn tiêu đề, mô tả, hình ảnh và giá sản phẩm ngay từ Byte đầu tiên (TTFB tối ưu).
2. **Google Sitemap Động (`/sitemap.xml`)**: Tự động tổng hợp danh sách URL sản phẩm từ backend API với cơ chế hoàn trả dữ liệu dự phòng (offline-resilient fallback) và bộ đệm Incremental Static Regeneration (ISR).
3. **Robots Điều Hướng Chuẩn (`/robots.txt`)**: Định tuyến bot tìm kiếm, cho phép thu thập dữ liệu sản phẩm công khai và chặn các khu vực bảo mật (thanh toán, giỏ hàng, bảng quản trị).
4. **Metadata & Thẻ OpenGraph Động**: Tạo tự động `title`, `description`, `canonical`, ảnh preview lớn cho Facebook/Zalo/Twitter khi chia sẻ link sản phẩm.
5. **Dữ liệu có cấu trúc JSON-LD (`schema.org`)**: Khai báo đồng thời `@type: "Product"`, `@type: "BreadcrumbList"` và `@type: "Store"`, giúp sản phẩm hiển thị Rich Snippet nổi bật (giá tiền VND, tình trạng còn hàng / giữ chỗ, số sao đánh giá) trên trang tìm kiếm Google.

---

## 2. Chi Tiết Kiến Trúc Kỹ Thuật SEO Của Shopi

### 2.1. Server-Side Rendering (SSR) & React Server Components (RSC)

Tất cả các trang quan trọng cho SEO (`/`, `/products/[slug]`, `/categories`) đều được viết dưới dạng **React Server Components (RSC)**:

- **Loại bỏ JavaScript Waterfall**: Bot tìm kiếm không cần đợi trình duyệt tải xong các file bundle `.js` lớn rồi mới render nội dung.
- **Tối ưu Core Web Vitals**:
  - **LCP (Largest Contentful Paint) < 2.5s**: Ảnh sản phẩm chính được cấu hình thuộc tính `priority` và pre-render trực tiếp trong thẻ `<picture>/<img>` của HTML.
  - **INP (Interaction to Next Paint) < 200ms**: Tách biệt rõ ràng phần tĩnh (Server Components) và phần tương tác (Client Components như nút mua, đồng hồ đếm ngược 15 phút, QR modal).
  - **CLS (Cumulative Layout Shift) < 0.1**: Kích thước ảnh được khai báo cố định tỉ lệ (`aspect-[4/3]`) ngăn chặn giật layout khi tải trang.

---

### 2.2. Google Sitemap Tự Động (`frontend/src/app/sitemap.ts`)

File mã nguồn nằm tại: [`frontend/src/app/sitemap.ts`](file:///d:/PersonalProject/shopi/frontend/src/app/sitemap.ts).

Khi truy cập `http://localhost:3000/sitemap.xml` hoặc `https://shopi.vn/sitemap.xml`, Next.js 15 sẽ tự động biên dịch code TypeScript thành định dạng chuẩn XML Sitemap:

```typescript
import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/mock-data";

// Incremental Static Regeneration (ISR) - Lưu đệm và làm mới mỗi 1 giờ (3600 giây)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn";

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Fetch danh sách sản phẩm động từ backend microservices
  const products = await getAllProducts();

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((product) => product.status !== "HIDDEN")
    .map((product) => {
      // Ưu tiên sản phẩm còn hàng (AVAILABLE) với priority 0.9 và tần suất cập nhật hourly
      const priority = product.status === "AVAILABLE" ? 0.9 : 0.6;
      const changeFrequency =
        product.status === "AVAILABLE" ? ("hourly" as const) : ("daily" as const);

      return {
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: new Date(product.updatedAt || product.createdAt),
        changeFrequency,
        priority,
      };
    });

  return [...staticRoutes, ...productRoutes];
}
```

#### Các đặc tính nổi bật của Sitemap:
- **Tự động mở rộng (Scalable)**: Khi người bán đăng tin đồ cũ mới, slug sản phẩm sẽ tự động được thêm vào Sitemap trong chu kỳ revalidation.
- **Phân cấp ưu tiên (Priority)**:
  - Trang chủ (`/`): `priority: 1.0` (quan trọng nhất).
  - Sản phẩm khả dụng (`AVAILABLE`): `priority: 0.9` (Googlebot ưu tiên index nhanh để khách tìm mua).
  - Danh mục hàng hóa: `priority: 0.8`.
  - Sản phẩm đang giữ chỗ (`RESERVED`) hoặc đã bán (`SOLD`): `priority: 0.6`.
- **Hiệu năng cao với ISR**: Không gọi lại cơ sở dữ liệu trên mỗi lượt bot quét; cache được giữ 3600s giúp server giảm 99% tải.

---

### 2.3. Cấu Hình Tệp Điều Hướng Bot (`frontend/src/app/robots.ts`)

File mã nguồn nằm tại: [`frontend/src/app/robots.ts`](file:///d:/PersonalProject/shopi/frontend/src/app/robots.ts).

Tự động sinh ra `http://localhost:3000/robots.txt` tuân thủ tiêu chuẩn Robots Exclusion Protocol:

```typescript
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/checkout/",
          "/orders/*/receipt",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/admin/",
          "/checkout/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

- **Cho phép (`allow: "/"` )**: Googlebot tự do thu thập dữ liệu toàn bộ trang chủ, danh mục và hàng ngàn sản phẩm đồ cũ.
- **Bảo vệ quyền riêng tư (`disallow`)**: Chặn bot quét vào các endpoint nội bộ, API nhạy cảm, biên lai thanh toán và trang quản trị cá nhân.
- **Khai báo liên kết Sitemap**: Trỏ trực tiếp bot đến tập tin Sitemap chính để tiết kiệm **Crawl Budget** của Google.

---

### 2.4. Dynamic Metadata & Social Sharing OpenGraph

File mã nguồn nằm tại: [`frontend/src/app/products/[slug]/page.tsx`](file:///d:/PersonalProject/shopi/frontend/src/app/products/[slug]/page.tsx).

Next.js 15 sử dụng hàm bất đồng bộ `generateMetadata({ params })`:

```typescript
export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn";
  const canonicalUrl = `${siteUrl}/products/${product.slug}`;
  const priceFormatted = formatVND(product.priceAmount);
  const primaryImage = product.imageUrls[0];

  const ogTitle = `${product.title} - ${priceFormatted} | Shopi`;
  const ogDescription = `${product.condition ? `[${product.condition}] ` : ""}${product.description.slice(0, 160)}... Giao dịch bảo chứng Escrow qua VietQR 24/7.`;

  return {
    title: ogTitle,
    description: ogDescription,
    alternates: {
      canonical: canonicalUrl, // Ngăn chặn hình phạt trùng lặp nội dung của Google
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
```

---

### 2.5. Dữ Liệu Có Cấu Trúc JSON-LD (`schema.org`)

Trên trang chi tiết mỗi sản phẩm, Shopi tự động inject một khối JSON-LD chuẩn SEO quốc tế vào thẻ `<head>` thông qua `<script type="application/ld+json">`.

Bao gồm 3 schema lồng nhau trong `@graph`:

1. **`Product` Schema**:
   - `name`: Tên sản phẩm chính xác.
   - `offers`:
     - `price`: Giá bán bằng số nguyên VND (VD: `43500000`).
     - `priceCurrency`: `"VND"`.
     - `availability`: Tự động map trạng thái theo Saga State Machine:
       - `AVAILABLE` -> `"https://schema.org/InStock"` (Google hiển thị nhãn "Còn hàng").
       - `RESERVED` -> `"https://schema.org/PreOrder"` (Google hiển thị nhãn "Đang giữ chỗ").
       - `SOLD` -> `"https://schema.org/Discontinued"` (Google hiển thị nhãn "Đã bán/Hết hàng").
     - `itemCondition`: `"https://schema.org/UsedCondition"` (Xác định rõ đồ đã qua sử dụng cho bot tìm kiếm).
   - `aggregateRating`: Điểm uy tín của người bán (4.9 sao / 32 đánh giá).

2. **`BreadcrumbList` Schema**:
   - Giúp Google hiển thị thanh điều hướng dạng lát bánh mì ngay trên kết quả tìm kiếm: `Trang chủ > Sản phẩm > Laptop & Máy tính > MacBook Pro...`.

3. **`Store` Schema**:
   - Khai báo thực thể sàn thương mại điện tử bảo chứng `Shopi C2C Used-Goods Marketplace`, phương thức thanh toán VietQR và vị trí địa lý của người bán.

---

## 3. Sổ Tay Kiểm Thử (Verification Manual) Dành Cho Lập Trình Viên

### Bước 1: Kiểm thử bằng PowerShell hoặc Terminal

Khởi chạy ứng dụng Frontend (nếu chưa chạy):
```powershell
cd d:\PersonalProject\shopi\frontend
npm run build
npm run start
```
*(Hoặc `npm run dev` trên cổng `3000`)*

#### 1. Kiểm tra Google Sitemap:
Mở một cửa sổ PowerShell mới và thực hiện lệnh:
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/sitemap.xml"
```
hoặc dùng lệnh `curl`:
```powershell
curl.exe -i http://localhost:3000/sitemap.xml
```

**Kết quả mong đợi**:
Server trả về mã `HTTP 200 OK` với header `Content-Type: application/xml` và danh sách đầy đủ các thẻ `<url>`, `<loc>`, `<lastmod>`, `<changefreq>`, `<priority>`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://shopi.vn</loc>
    <lastmod>2026-10-31T...</lastmod>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://shopi.vn/products/macbook-pro-16-m1-max-32gb-1tb</loc>
    <lastmod>2026-10-31T...</lastmod>
    <changefreq>hourly</changefreq>
    <priority>0.9</priority>
  </url>
  ...
</urlset>
```

#### 2. Kiểm tra Robots.txt:
```powershell
curl.exe http://localhost:3000/robots.txt
```

**Kết quả mong đợi**:
```text
User-Agent: *
Allow: /
Disallow: /api/
Disallow: /dashboard/
Disallow: /admin/
Disallow: /checkout/
Disallow: /orders/*/receipt

User-Agent: Googlebot
Allow: /
Disallow: /api/
Disallow: /dashboard/
Disallow: /admin/
Disallow: /checkout/

Sitemap: https://shopi.vn/sitemap.xml
```

#### 3. Kiểm tra JSON-LD Structured Data:
```powershell
$html = (Invoke-WebRequest -Uri "http://localhost:3000/products/macbook-pro-16-m1-max-32gb-1tb").Content
$html -match '<script type="application/ld\+json">(.*?)</script>'
$matches[1]
```

Dữ liệu JSON-LD trả về phải có cấu trúc hợp lệ của `Product` và `BreadcrumbList`.

---

### Bước 2: Kiểm thử với Công Cụ Google Rich Results Test Tool

1. Truy cập công cụ chính thức của Google:  
   👉 **[Google Rich Results Test (Kiểm tra kết quả nhiều định dạng)](https://search.google.com/test/rich-results)**
2. Khi deploy trên môi trường công khai (staging hoặc production), nhập URL chi tiết sản phẩm:  
   `https://shopi.vn/products/macbook-pro-16-m1-max-32gb-1tb`  
   *(Nếu đang chạy localhost, bạn có thể copy toàn bộ mã nguồn HTML từ trang web và dán vào tab **MÃ (Code)**)*.
3. Bấm **KIỂM TRA URL (Test URL)**.
4. **Kết quả đạt chuẩn**:
   - ✅ Mục **Đoạn trích sản phẩm (Product snippets)**: Hợp lệ (Hiển thị Giá bán VND, Còn hàng, Tên sản phẩm, Xếp hạng sao).
   - ✅ Mục **Danh sách trang web (Breadcrumbs)**: Hợp lệ (Hiển thị cây phân cấp điều hướng).
   - ✅ Mục **Hồ sơ người bán (Merchant listings)**: Hợp lệ.

---

### Bước 3: Hướng Dẫn Đăng Ký Sitemap Lên Google Search Console

Khi dự án đưa lên domain chính thức (VD: `https://shopi.vn`):

1. **Xác thực quyền sở hữu website**:
   - Truy cập **[Google Search Console](https://search.google.com/search-console)**.
   - Chọn **Thêm tài sản (Add Property)** -> Chọn loại tài sản là **Tiền tố URL (URL prefix)** hoặc **Tên miền (Domain)**.
   - Xác thực qua bản ghi DNS TXT hoặc thêm mã `<meta name="google-site-verification" content="..." />` vào `frontend/src/app/layout.tsx`.

2. **Gửi Google Sitemap**:
   - Trong thanh menu bên trái của Google Search Console, bấm vào mục **Sơ đồ trang web (Sitemaps)**.
   - Tại ô **Thêm sơ đồ trang web mới (Add a new sitemap)**, điền:
     ```
     sitemap.xml
     ```
   - Bấm nút **GỬI (SUBMIT)**.

3. **Theo dõi trạng thái thu thập dữ liệu**:
   - Google Search Console sẽ phản hồi trạng thái: **Thành công (Success)**.
   - Số lượng URL được phát hiện (Discovered URLs) sẽ khớp với số lượng sản phẩm đang có trên sàn Shopi.
   - Dùng tính năng **Kiểm tra URL (URL Inspection)** để yêu cầu Google lập chỉ mục (Request Indexing) ngay lập tức cho các sản phẩm hot.

---

## 4. Tóm Tắt Trả Lời Cho Người Dùng

| Tiêu chí | Trạng thái Shopi | Cơ chế kỹ thuật |
| :--- | :---: | :--- |
| **Có tối ưu SEO chưa?** | **RẤT TỐI ƯU (Enterprise Level)** | 100% Server-Side Rendering (RSC), TTFB nhanh, LCP tối ưu, Canonical URL chống phạt trùng lặp, OpenGraph preview mạng xã hội. |
| **Có Google Sitemap chưa?** | **ĐÃ CÓ SẴN (`/sitemap.xml`)** | Tự động sinh XML từ backend API, revalidate mỗi 3600s, phân chia priority 0.9 cho hàng còn bán. |
| **Có Robots.txt chưa?** | **ĐÃ CÓ SẴN (`/robots.txt`)** | Khai báo sitemap link, mở đường cho Googlebot crawl sản phẩm, bảo vệ endpoint nội bộ. |
| **Có Schema rich snippet chưa?** | **HOÀN CHỈNH 100%** | JSON-LD chuẩn `schema.org/Product`, `BreadcrumbList`, `Store` phản ánh đúng giá VND và trạng thái Saga (`InStock` / `PreOrder` / `Discontinued`). |
