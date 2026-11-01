import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-sans",
});

export const viewport: Viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://shopi.vn"),
  title: {
    template: "%s | Shopi C2C Used-Goods Marketplace",
    default: "Shopi | Sàn Thương Mại Điện Tử C2C Đồ Cũ Chính Hãng",
  },
  description:
    "Sàn thương mại điện tử C2C mua bán đồ cũ công nghệ, đồ gia dụng cao cấp. Cơ chế khóa giữ chỗ 15 phút chống trùng đơn, thanh toán bảo chứng an toàn qua VietQR Escrow.",
  keywords: [
    "đồ cũ chính hãng",
    "mua bán đồ cũ",
    "c2c marketplace",
    "macbook cũ",
    "máy ảnh cũ",
    "vietqr",
    "shopi",
  ],
  authors: [{ name: "Shopi Engineering Team" }],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: "https://shopi.vn",
    siteName: "Shopi C2C Marketplace",
    title: "Shopi | Sàn Mua Bán Đồ Cũ C2C An Toàn & Minh Bạch",
    description:
      "Giao dịch đồ cũ an toàn với cơ chế khóa giữ chỗ Saga 15 phút và thanh toán VietQR Escrow.",
    images: [
      {
        url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&h=630&q=80",
        width: 1200,
        height: 630,
        alt: "Shopi C2C Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shopi C2C Used-Goods Marketplace",
    description:
      "Khóa giữ hàng 15 phút, thanh toán bảo chứng VietQR, phòng chống lừa đảo 100%.",
    images: [
      "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1200&h=630&q=80",
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className={`${inter.variable} min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased flex flex-col`}>
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
