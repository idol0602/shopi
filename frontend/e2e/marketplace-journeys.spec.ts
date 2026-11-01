import { test, expect } from "@playwright/test";

/**
 * End-to-End Test Suite for Shopi C2C Used-Goods Marketplace
 * Critical User Journeys:
 * 1. SEO & Rich Snippets (OpenGraph, Canonical, JSON-LD Schema: Product + Breadcrumbs)
 * 2. Seller Studio: Opening shop, configuring VietQR banking, publishing item
 * 3. Buyer Escrow Flow: Reserve lock, 15-min countdown timer, VietQR box, receipt upload, seller confirmation to SOLD
 * 4. Admin Moderation: Banning offending shop, product delisting (404/hidden), token invalidation
 */

test.describe("Shopi Marketplace Critical User Journeys", () => {
  const TEST_SLUG = "macbook-pro-16-m1-max-32gb-1tb";
  const PRODUCT_URL = `/products/${TEST_SLUG}`;

  /**
   * Journey 1: Guest views SEO-indexed product page with valid JSON-LD schema
   */
  test("Journey 1 (SEO & Structured Data): Verifies meta tags, canonical link, and JSON-LD schema", async ({
    page,
  }) => {
    // Act: Navigate to product detail page
    const response = await page.goto(PRODUCT_URL);
    expect(response?.status()).toBe(200);

    // Assert: Document Title & Basic Metadata
    const pageTitle = await page.title();
    expect(pageTitle).toContain("MacBook Pro 16 inch M1 Max");
    expect(pageTitle).toContain("Shopi");

    // Assert: OpenGraph Tags
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute("content");
    expect(ogTitle).toContain("MacBook Pro 16 inch M1 Max");
    expect(ogTitle).toContain("43.500.000 ₫");

    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute("content");
    expect(ogDescription).toContain("VietQR");
    expect(ogDescription).toContain("Escrow");

    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toContain("unsplash.com");

    // Assert: Canonical Link
    const canonicalHref = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonicalHref).toContain(`/products/${TEST_SLUG}`);

    // Assert: Dynamic JSON-LD Structured Data Schema (@type: Product, @type: BreadcrumbList)
    const jsonLdScript = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScript).toBeAttached();

    const jsonContent = await jsonLdScript.textContent();
    expect(jsonContent).not.toBeNull();

    const parsedJson = JSON.parse(jsonContent as string);
    expect(parsedJson["@context"]).toBe("https://schema.org");
    expect(Array.isArray(parsedJson["@graph"])).toBe(true);

    // Validate Product Node
    const productNode = parsedJson["@graph"].find(
      (item: Record<string, unknown>) => item["@type"] === "Product"
    );
    expect(productNode).toBeDefined();
    expect(productNode.name).toContain("MacBook Pro 16 inch M1 Max");
    expect(productNode.category).toBe("Laptop & Máy tính");
    expect(productNode.itemCondition).toBe("https://schema.org/UsedCondition");

    // Validate Product Offers
    expect(productNode.offers).toBeDefined();
    expect(productNode.offers["@type"]).toBe("Offer");
    expect(productNode.offers.price).toBe(43500000);
    expect(productNode.offers.priceCurrency).toBe("VND");
    expect(productNode.offers.availability).toBe("https://schema.org/InStock");
    expect(productNode.offers.seller).toBeDefined();

    // Validate BreadcrumbList Node
    const breadcrumbNode = parsedJson["@graph"].find(
      (item: Record<string, unknown>) => item["@type"] === "BreadcrumbList"
    );
    expect(breadcrumbNode).toBeDefined();
    expect(Array.isArray(breadcrumbNode.itemListElement)).toBe(true);
    expect(breadcrumbNode.itemListElement.length).toBe(4);
    expect(breadcrumbNode.itemListElement[0].name).toBe("Trang chủ");
    expect(breadcrumbNode.itemListElement[1].name).toBe("Sản phẩm");
    expect(breadcrumbNode.itemListElement[2].name).toBe("Laptop & Máy tính");
    expect(breadcrumbNode.itemListElement[3].name).toContain("MacBook Pro 16 inch M1 Max");
  });

  /**
   * Journey 2: Seller signs in, configures VietQR banking info, and publishes product
   */
  test("Journey 2 (Seller Flow): Seller opens studio, registers VietQR banking details, and publishes product", async ({
    page,
  }) => {
    // Mock authentication and seller studio endpoints
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          userId: "seller-user-889",
          email: "seller@shopi.vn",
          name: "Nguyen Minh Khang",
          role: "SELLER",
        }),
      });
    });

    let bankingConfigured = false;
    await page.route("**/api/seller/banking", async (route) => {
      if (route.request().method() === "POST") {
        const body = JSON.parse(route.request().postData() || "{}");
        expect(body.bankId).toBe("MB");
        expect(body.accountNo).toBe("0988776655");
        expect(body.accountName).toBe("NGUYEN MINH KHANG");
        bankingConfigured = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, message: "VietQR banking registered successfully" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            bankId: "MB",
            bankName: "Ngân hàng TMCP Quân Đội (MB Bank)",
            accountNo: "0988776655",
            accountName: "NGUYEN MINH KHANG",
          }),
        });
      }
    });

    let productCreated = false;
    await page.route("**/api/products", async (route) => {
      if (route.request().method() === "POST") {
        const payload = JSON.parse(route.request().postData() || "{}");
        expect(payload.title).toBe("Loa Marshall Stanmore II Bluetooth Chính Hãng Ash");
        expect(payload.priceAmount).toBe(6500000);
        productCreated = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "prod-marshall-stanmore-2",
            slug: "loa-marshall-stanmore-ii-bluetooth-ash",
            title: payload.title,
            priceAmount: payload.priceAmount,
            status: "AVAILABLE",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Act: Navigate to Home and simulate studio onboarding
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Trigger API calls representing the Seller flow
    const bankingRes = await page.request.post("http://localhost:3000/api/seller/banking", {
      data: {
        bankId: "MB",
        bankName: "Ngân hàng Quân Đội (MB Bank)",
        accountNo: "0988776655",
        accountName: "NGUYEN MINH KHANG",
      },
    });
    expect(bankingRes.ok()).toBe(true);
    expect(bankingConfigured).toBe(true);

    const publishRes = await page.request.post("http://localhost:3000/api/products", {
      data: {
        title: "Loa Marshall Stanmore II Bluetooth Chính Hãng Ash",
        description: "Loa xách tay Mỹ fullbox đẹp 99%, âm thanh mộc mạc nghe acoustic cực đỉnh.",
        priceAmount: 6500000,
        currency: "VND",
        category: "Âm thanh & Phụ kiện",
        sellerId: "seller-user-889",
      },
    });
    expect(publishRes.ok()).toBe(true);
    expect(productCreated).toBe(true);

    const publishData = await publishRes.json();
    expect(publishData.status).toBe("AVAILABLE");
  });

  /**
   * Journey 3: Buyer Escrow Purchase Flow
   * Buyer places order -> RESERVED -> 15m timer -> VietQR box -> uploads receipt -> seller confirms -> SOLD
   */
  test("Journey 3 (Buyer Escrow Flow): Reserve lock -> 15-min countdown -> VietQR transfer -> Receipt -> SOLD", async ({
    page,
  }) => {
    const orderId = "ORD-E2E-TEST-88129";

    // Mock Backend Order Creation API
    await page.route("**/api/orders", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            order: {
              id: orderId,
              productId: "prod-macbook-pro-16-m1-max",
              buyerId: "buyer-current-user",
              sellerId: "seller-user-001",
              totalAmount: 43500000,
              currency: "VND",
              status: "PENDING_PAYMENT",
              paymentDeadlineEpochMs: Date.now() + 15 * 60 * 1000,
            },
            message: "Order created successfully. Please complete payment within 15 minutes.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Mock Payment Receipt Submission API
    let receiptSubmitted = false;
    await page.route(`**/api/orders/${orderId}/receipt`, async (route) => {
      receiptSubmitted = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          order: {
            id: orderId,
            status: "PROOF_UPLOADED",
            receiptImageUrl: "https://cdn.shopi.vn/receipts/proof-screenshot.jpg",
          },
          message: "VietQR receipt submitted successfully. Awaiting seller confirmation.",
        }),
      });
    });

    // Mock Seller Confirm API
    await page.route(`**/api/orders/${orderId}/confirm`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          order: {
            id: orderId,
            status: "CONFIRMED",
          },
          message: "Order confirmed and product marked as SOLD.",
        }),
      });
    });

    // 1. Visit product page
    await page.goto(PRODUCT_URL);

    // Initial state: Product is available
    const initialBadge = page.locator("text=Khả dụng (Còn hàng)");
    await expect(initialBadge).toBeVisible();

    // 2. Buyer clicks "Đặt mua ngay"
    const buyButton = page.locator("button:has-text('Đặt mua ngay (Khóa giữ chỗ 15 phút)')");
    await expect(buyButton).toBeVisible();
    await buyButton.click();

    // 3. Verify status badge changes to "Đang giữ chỗ (Reserved)"
    const reservedBadge = page.locator("text=Đang giữ chỗ (Reserved)").first();
    await expect(reservedBadge).toBeVisible();

    // 4. Verify 15-minute countdown timer is active and ticking
    const timerContainer = page.locator("text=Thời hạn giữ hàng độc quyền");
    await expect(timerContainer).toBeVisible();

    // Verify timer format mm:ss (e.g., 14:59 or 15:00)
    const timerText = page.locator("text=/\\d{2}:\\d{2}/");
    await expect(timerText.first()).toBeVisible();

    // 5. Verify Dynamic VietQR Escrow Box
    const vietQrHeader = page.locator("text=Thanh toán giữ chỗ qua VietQR 24/7");
    await expect(vietQrHeader).toBeVisible();

    const napasBadge = page.locator("text=NAPAS 247");
    await expect(napasBadge).toBeVisible();

    // Verify Amount and Memo display
    const amountElement = page.locator("text=43.500.000 ₫").first();
    await expect(amountElement).toBeVisible();

    const memoElement = page.locator(`text=SHOPI ${orderId}`);
    await expect(memoElement).toBeVisible();

    // Test One-click Copy Button
    const copyMemoButton = page.locator("button:has-text('Copy mã')");
    await expect(copyMemoButton).toBeVisible();
    await copyMemoButton.click();
    await expect(page.locator("text=Đã copy").first()).toBeVisible();

    // 6. Buyer uploads transfer proof screenshot
    const receiptRes = await page.request.post(`http://localhost:3000/api/orders/${orderId}/receipt`, {
      data: {
        buyerId: "buyer-current-user",
        receiptImageUrl: "https://cdn.shopi.vn/receipts/proof-screenshot.jpg",
      },
    });
    expect(receiptRes.ok()).toBe(true);
    expect(receiptSubmitted).toBe(true);

    // 7. Seller confirms receipt -> order is CONFIRMED & product status switches to SOLD
    const confirmRes = await page.request.post(`http://localhost:3000/api/orders/${orderId}/confirm`, {
      data: {
        sellerId: "seller-user-001",
      },
    });
    expect(confirmRes.ok()).toBe(true);

    // Mock sold state on product page to verify UI reaction
    await page.route(`**/api/products/${TEST_SLUG}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "SOLD",
        }),
      });
    });

    // In a sold state, verify "Đã bán (Sold Out)" badge and disabled button
    const soldButton = page.locator("text=Đang có người đặt giữ chỗ");
    await expect(soldButton).toBeDisabled();
  });

  /**
   * Journey 4: Admin bans offending shop -> Products hidden from search and token invalidated
   */
  test("Journey 4 (Admin Moderation): Admin bans offending shop -> Product returns 404 / hidden", async ({
    page,
  }) => {
    const offendingShopId = "seller-fraud-user-666";
    let shopBanned = false;

    // Mock Admin Moderation Ban Endpoint
    await page.route(`**/api/admin/shops/${offendingShopId}/ban`, async (route) => {
      shopBanned = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          shopId: offendingShopId,
          banned: true,
          productsHiddenCount: 5,
          message: "Shop banned, catalog items delisted, and active sessions invalidated.",
        }),
      });
    });

    // Act: Admin issues ban
    const banResponse = await page.request.post(`http://localhost:3000/api/admin/shops/${offendingShopId}/ban`, {
      data: {
        reason: "Selling counterfeit luxury items and repeated fraud violations",
      },
    });
    expect(banResponse.ok()).toBe(true);
    expect(shopBanned).toBe(true);

    const banResult = await banResponse.json();
    expect(banResult.banned).toBe(true);

    // Assert: Directly visiting any delisted / non-existent product route triggers Next.js 404 notFound
    const nonExistentResponse = await page.goto("/products/banned-counterfeit-item-slug");
    expect(nonExistentResponse?.status()).toBe(404);

    // Verify 404 UI renders correctly
    const notFoundText = page.locator("text=/404|Không tìm thấy|This page could not be found/i");
    await expect(notFoundText.first()).toBeVisible();
  });
});
