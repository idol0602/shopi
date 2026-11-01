import type { MetadataRoute } from "next";
import { getAllProducts } from "@/lib/mock-data";

// Incremental Static Regeneration (ISR) - revalidate every 1 hour (3600 seconds)
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

  // Fetch dynamic products from backend API (or fallback mock data)
  const products = await getAllProducts();

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((product) => product.status !== "HIDDEN")
    .map((product) => {
      const priority = product.status === "AVAILABLE" ? 0.9 : 0.6;
      const changeFrequency =
        product.status === "AVAILABLE"
          ? ("hourly" as const)
          : ("daily" as const);

      return {
        url: `${baseUrl}/products/${product.slug}`,
        lastModified: new Date(product.updatedAt || product.createdAt),
        changeFrequency,
        priority,
      };
    });

  return [...staticRoutes, ...productRoutes];
}
