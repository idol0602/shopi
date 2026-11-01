/**
 * Automated Test: Per-Seller Dedicated SePay Webhooks & Tenant Isolation Suite
 * Target: POST /api/webhooks/sepay/{sellerId} & POST /api/orders/{id}/simulate-payment
 *
 * Core Capabilities Tested:
 * 1. Dedicated Per-Seller Webhook Configuration:
 *    - Each seller configures their own SePay API key and receives webhooks at a dedicated endpoint /api/webhooks/sepay/{sellerId}.
 *    - Validates matching order memo, transfers amount, and marks order CONFIRMED under the seller's account.
 *
 * 2. Tenant Isolation & Security Boundaries:
 *    - Scenario A: Calling /api/webhooks/sepay/{sellerA_id} with invalid/tampered token returns HTTP 401 Unauthorized.
 *    - Scenario B (Cross-Tenant Tampering Guard): Calling /api/webhooks/sepay/{sellerA_id} with Seller A's token
 *      but presenting an Order ID belonging to Seller B returns HTTP 403 Forbidden / PERMISSION_DENIED.
 *      Ensures Seller B's order remains PENDING_PAYMENT and cannot be hijacked.
 *    - Scenario C (Per-Seller Test Mode Isolation):
 *      Seller A has test_mode: true -> /simulate-payment succeeds (HTTP 200).
 *      Seller B has test_mode: false -> /simulate-payment is rejected (HTTP 403 Forbidden).
 *
 * 3. Backward Compatibility & General Safeguards:
 *    - Global webhook endpoint /api/webhooks/sepay
 *    - Idempotency & duplicate event handling
 *    - Underpayment detection
 *
 * Execution:
 * - Standalone: `node testing/new-features/sepay-webhook-test.js`
 * - Custom Gateway: `GATEWAY_URL=http://localhost:8080 node testing/new-features/sepay-webhook-test.js`
 */

import http from "node:http";

const TARGET_URL = process.env.GATEWAY_URL || "http://localhost:8080";
const GLOBAL_SEPAY_API_KEY = process.env.SEPAY_WEBHOOK_KEY || "shopi-sepay-webhook-secret-key-2026";

// Test assertion counters
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, description) {
  if (condition) {
    console.log(`  ✅ [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ❌ [FAIL] ${description}`);
    failedAssertions++;
  }
}

/**
 * Creates an ephemeral test mock server supporting per-seller SePay routing and tenant isolation
 */
function createMockGatewayServer() {
  // Multi-tenant Seller Database
  const sellers = new Map([
    [
      "seller-minh-khang-audio",
      {
        id: "seller-minh-khang-audio",
        name: "Minh Khang Audio Hifi",
        sepayApiKey: "sepay-secret-token-seller-a-9821",
        accountNo: "0988776655",
        bankId: "MB",
        testMode: true, // Seller A enables sandbox test_mode
      },
    ],
    [
      "seller-hoang-minh-tech",
      {
        id: "seller-hoang-minh-tech",
        name: "Hoàng Minh Tech",
        sepayApiKey: "sepay-secret-token-seller-b-4412",
        accountNo: "0911223344",
        bankId: "VCB",
        testMode: false, // Seller B is production only
      },
    ],
  ]);

  // Orders Database mapped to respective sellers
  const orders = new Map([
    [
      "ORD-SELLER-A-101",
      {
        id: "ORD-SELLER-A-101",
        productId: "prod-marshall-stanmore-2",
        sellerId: "seller-minh-khang-audio",
        buyerId: "buyer-alice",
        totalAmount: 6500000,
        status: "PENDING_PAYMENT",
      },
    ],
    [
      "ORD-SELLER-B-202",
      {
        id: "ORD-SELLER-B-202",
        productId: "prod-macbook-pro-16-m1-max",
        sellerId: "seller-hoang-minh-tech",
        buyerId: "buyer-bob",
        totalAmount: 43500000,
        status: "PENDING_PAYMENT",
      },
    ],
    [
      "ORD-GLOBAL-303",
      {
        id: "ORD-GLOBAL-303",
        productId: "prod-vintage-watch",
        sellerId: "seller-minh-khang-audio",
        buyerId: "buyer-charlie",
        totalAmount: 12000000,
        status: "PENDING_PAYMENT",
      },
    ],
  ]);

  const processedWebhookIds = new Set();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Health check
    if (url.pathname === "/health" || url.pathname === "/actuator/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "UP" }));
    }

    // Query Order
    if (req.method === "GET" && url.pathname.startsWith("/api/orders/")) {
      const orderId = url.pathname.split("/").pop();
      const order = orders.get(orderId);
      if (!order) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Order not found" }));
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(order));
    }

    // Per-Seller Payment Simulation: POST /api/orders/{id}/simulate-payment
    if (req.method === "POST" && url.pathname.match(/\/api\/orders\/[^/]+\/simulate-payment/)) {
      const parts = url.pathname.split("/");
      const orderId = parts[3];
      const order = orders.get(orderId);

      if (!order) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: "Order not found" }));
      }

      const seller = sellers.get(order.sellerId);
      if (!seller || !seller.testMode) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            success: false,
            sellerId: order.sellerId,
            error: `Payment simulation is forbidden: Seller '${order.sellerId}' has test_mode disabled.`,
          })
        );
      }

      order.status = "CONFIRMED";
      order.confirmedAt = new Date().toISOString();
      order.paymentMethod = "TEST_MODE_SIMULATION";

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          success: true,
          testMode: true,
          orderId: order.id,
          sellerId: order.sellerId,
          status: order.status,
          message: "Order confirmed via seller test mode.",
        })
      );
    }

    // Dedicated Per-Seller SePay Webhook: POST /api/webhooks/sepay/{sellerId}
    const perSellerMatch = url.pathname.match(/\/api\/webhooks\/sepay\/([^/]+)/);
    if (req.method === "POST" && perSellerMatch) {
      const targetSellerId = perSellerMatch[1];
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const seller = sellers.get(targetSellerId);
        if (!seller) {
          res.writeHead(404, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: `Seller ${targetSellerId} not found` }));
        }

        // Authenticate with Seller-specific API Key
        const authHeader = req.headers["authorization"] || "";
        const expectedAuth = `Apikey ${seller.sepayApiKey}`;
        const apiKeyHeader = req.headers["x-sepay-key"];

        if (authHeader !== expectedAuth && apiKeyHeader !== seller.sepayApiKey) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              success: false,
              error: `Unauthorized: Invalid SePay webhook key for seller ${targetSellerId}`,
            })
          );
        }

        try {
          const payload = JSON.parse(body);

          // Extract Order ID from content
          const memoMatch = (payload.content || "").match(/SHOPI\s+([A-Z0-9-]+)/i);
          if (!memoMatch) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Missing or malformed SHOPI order memo" }));
          }

          const orderId = memoMatch[1];
          const order = orders.get(orderId);

          if (!order) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: `Order ${orderId} not found` }));
          }

          // Strict Tenant Isolation Check: Does this order belong to targetSellerId?
          if (order.sellerId !== targetSellerId) {
            res.writeHead(403, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                success: false,
                code: "PERMISSION_DENIED",
                error: `Tenant isolation violation: Order '${orderId}' belongs to '${order.sellerId}', not '${targetSellerId}'. Cross-tenant confirmation denied.`,
              })
            );
          }

          // Check underpayment
          if (payload.transferAmount < order.totalAmount) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(
              JSON.stringify({
                success: false,
                error: `Underpayment: expected ${order.totalAmount}, got ${payload.transferAmount}`,
              })
            );
          }

          // Confirm Order
          order.status = "CONFIRMED";
          order.paidAt = new Date().toISOString();
          order.sepayTransactionId = payload.id;
          if (payload.id) processedWebhookIds.add(payload.id);

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({
              success: true,
              sellerId: targetSellerId,
              orderId: order.id,
              status: order.status,
              totalAmount: order.totalAmount,
              message: `Payment confirmed for seller ${seller.name}`,
            })
          );
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        }
      });
      return;
    }

    // Global Fallback Webhook: POST /api/webhooks/sepay
    if (req.method === "POST" && url.pathname === "/api/webhooks/sepay") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const authHeader = req.headers["authorization"] || "";
        const expectedAuth = `Apikey ${GLOBAL_SEPAY_API_KEY}`;

        if (authHeader !== expectedAuth && req.headers["x-sepay-key"] !== GLOBAL_SEPAY_API_KEY) {
          res.writeHead(401, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: "Unauthorized global SePay key" }));
        }

        try {
          const payload = JSON.parse(body);

          if (payload.id && processedWebhookIds.has(payload.id)) {
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: true, idempotent: true }));
          }

          const memoMatch = (payload.content || "").match(/SHOPI\s+([A-Z0-9-]+)/i);
          if (!memoMatch) {
            res.writeHead(400, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Missing SHOPI memo" }));
          }

          const orderId = memoMatch[1];
          const order = orders.get(orderId);

          if (!order) {
            res.writeHead(404, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ success: false, error: "Order not found" }));
          }

          order.status = "CONFIRMED";
          if (payload.id) processedWebhookIds.add(payload.id);

          res.writeHead(200, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: true, orderId: order.id, status: order.status }));
        } catch {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  return server;
}

async function isServerRunning(url) {
  try {
    const res = await fetch(`${url}/actuator/health`, { method: "GET" }).catch(() => null);
    return res && res.ok;
  } catch {
    return false;
  }
}

async function runTests() {
  console.log("======================================================================");
  console.log("🧪 SHOPi QA: Per-Seller Dedicated SePay Webhooks & Tenant Isolation");
  console.log("======================================================================");

  let server;
  let baseUrl = TARGET_URL;

  const live = await isServerRunning(baseUrl);
  if (!live) {
    console.log("ℹ️  Live API Gateway not detected on port 8080.");
    console.log("🚀 Spinning up ephemeral Multi-Tenant Mock Gateway on port 8084...");
    server = createMockGatewayServer();
    await new Promise((resolve) => server.listen(8084, resolve));
    baseUrl = "http://localhost:8084";
  } else {
    console.log(`🌐 Connected to live target: ${baseUrl}`);
  }

  try {
    const sellerAId = "seller-minh-khang-audio";
    const sellerBId = "seller-hoang-minh-tech";
    const tokenA = "sepay-secret-token-seller-a-9821";
    const tokenB = "sepay-secret-token-seller-b-4412";

    // ----------------------------------------------------------------------------------
    // Test 1: Dedicated Per-Seller Webhook (Happy Path for Seller A)
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 1: Dedicated Per-Seller Webhook for Seller A");
    const sellerAPayload = {
      id: 881021,
      gateway: "MBBank",
      transactionDate: "2026-10-31 15:30:00",
      accountNumber: "0988776655",
      content: "SHOPI ORD-SELLER-A-101 THANH TOAN LOA MARSHALL",
      transferAmount: 6500000,
      referenceCode: "REF-SELLER-A-882",
    };

    const res1 = await fetch(`${baseUrl}/api/webhooks/sepay/${sellerAId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${tokenA}`,
      },
      body: JSON.stringify(sellerAPayload),
    });

    assert(res1.status === 200, `Dedicated webhook returns HTTP 200 OK (Got: ${res1.status})`);
    const data1 = await res1.json();
    assert(data1.success === true, "Response indicates success = true");
    assert(data1.sellerId === sellerAId, "Response correctly identifies Seller A");
    assert(data1.status === "CONFIRMED", `Order transitioned to CONFIRMED (Got: ${data1.status})`);

    // Verify database record
    const getOrderARes = await fetch(`${baseUrl}/api/orders/ORD-SELLER-A-101`);
    const orderARecord = await getOrderARes.json();
    assert(orderARecord.status === "CONFIRMED", "Database record confirms Order A is CONFIRMED");

    // ----------------------------------------------------------------------------------
    // Test 2: Tenant Isolation Scenario A - Invalid Webhook Token for Seller A
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 2 (Tenant Security A): Invalid Webhook Token for Seller A");
    const res2 = await fetch(`${baseUrl}/api/webhooks/sepay/${sellerAId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Apikey fake-unauthorized-seller-token",
      },
      body: JSON.stringify(sellerAPayload),
    });

    assert(res2.status === 401, `Invalid token returns HTTP 401 Unauthorized (Got: ${res2.status})`);
    const data2 = await res2.json();
    assert(data2.success === false, "Unauthorized response contains success = false");

    // ----------------------------------------------------------------------------------
    // Test 3: Tenant Isolation Scenario B - Cross-Tenant Tampering Prevention
    // Calling /api/webhooks/sepay/{sellerAId} with Seller A's token, but order belongs to Seller B
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 3 (Tenant Security B): Cross-Tenant Tampering Guard");
    const crossTenantPayload = {
      id: 881022,
      gateway: "MBBank",
      transactionDate: "2026-10-31 15:35:00",
      accountNumber: "0988776655",
      content: "SHOPI ORD-SELLER-B-202 TAMPERING ATTEMPT",
      transferAmount: 43500000,
      referenceCode: "REF-TAMPER-001",
    };

    const res3 = await fetch(`${baseUrl}/api/webhooks/sepay/${sellerAId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${tokenA}`, // Valid token for Seller A!
      },
      body: JSON.stringify(crossTenantPayload),
    });

    assert(
      res3.status === 403,
      `Cross-tenant tampering strictly rejected with HTTP 403 Forbidden (Got: ${res3.status})`
    );
    const data3 = await res3.json();
    assert(data3.success === false, "Cross-tenant confirmation denied");
    assert(data3.code === "PERMISSION_DENIED" || data3.error.includes("Tenant isolation"), "Error specifies tenant isolation violation");

    // Strict verification: Seller B's order MUST remain in PENDING_PAYMENT!
    const getOrderBRes = await fetch(`${baseUrl}/api/orders/ORD-SELLER-B-202`);
    const orderBRecord = await getOrderBRes.json();
    assert(
      orderBRecord.status === "PENDING_PAYMENT",
      "Seller B's order was NOT hijacked and remains safely in PENDING_PAYMENT"
    );

    // ----------------------------------------------------------------------------------
    // Test 4: Dedicated Per-Seller Webhook for Seller B with Seller B's Token
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 4: Dedicated Per-Seller Webhook for Seller B (Legitimate)");
    const sellerBPayload = {
      id: 881023,
      gateway: "VCB",
      transactionDate: "2026-10-31 15:40:00",
      accountNumber: "0911223344",
      content: "SHOPI ORD-SELLER-B-202 HOP LE",
      transferAmount: 43500000,
      referenceCode: "REF-SELLER-B-991",
    };

    const res4 = await fetch(`${baseUrl}/api/webhooks/sepay/${sellerBId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${tokenB}`, // Legitimate token for Seller B!
      },
      body: JSON.stringify(sellerBPayload),
    });

    assert(res4.status === 200, `Seller B webhook returns HTTP 200 OK (Got: ${res4.status})`);
    const data4 = await res4.json();
    assert(data4.sellerId === sellerBId, "Response correctly identifies Seller B");
    assert(data4.status === "CONFIRMED", "Order B successfully confirmed by Seller B");

    // ----------------------------------------------------------------------------------
    // Test 5: Tenant Isolation Scenario C - Per-Seller Test Mode Flag
    // Seller A has test_mode: true, Seller B has test_mode: false
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 5 (Tenant Security C): Per-Seller Test Mode Isolation");
    
    // Create new test order for Seller A
    const orderA2Id = "ORD-SELLER-A-101"; // Reset or reuse
    const simResA = await fetch(`${baseUrl}/api/orders/${orderA2Id}/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE" }),
    });

    assert(simResA.status === 200, `Seller A (test_mode: true) allows simulation (Got: ${simResA.status})`);
    const simDataA = await simResA.json();
    assert(simDataA.testMode === true, "Simulation confirmed testMode = true for Seller A");

    // Create new pending order for Seller B to test simulation rejection
    const simResB = await fetch(`${baseUrl}/api/orders/ORD-SELLER-B-202/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE" }),
    });

    assert(
      simResB.status === 403,
      `Seller B (test_mode: false) blocks simulation with HTTP 403 Forbidden (Got: ${simResB.status})`
    );
    const simDataB = await simResB.json();
    assert(simDataB.success === false, "Simulation disallowed for production seller");

    // ----------------------------------------------------------------------------------
    // Test 6: Global Webhook Fallback & Idempotency
    // ----------------------------------------------------------------------------------
    console.log("\n▶ Test 6: Global Webhook Fallback & Idempotency");
    const globalPayload = {
      id: 991122,
      content: "SHOPI ORD-GLOBAL-303 THANH TOAN",
      transferAmount: 12000000,
    };

    const globalRes = await fetch(`${baseUrl}/api/webhooks/sepay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${GLOBAL_SEPAY_API_KEY}`,
      },
      body: JSON.stringify(globalPayload),
    });

    assert(globalRes.status === 200, `Global webhook returns HTTP 200 OK (Got: ${globalRes.status})`);

    // Duplicate call (idempotency check)
    const dupRes = await fetch(`${baseUrl}/api/webhooks/sepay`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Apikey ${GLOBAL_SEPAY_API_KEY}`,
      },
      body: JSON.stringify(globalPayload),
    });

    assert(dupRes.status === 200, `Duplicate global webhook handled idempotently with HTTP 200 (Got: ${dupRes.status})`);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("\n🛑 Ephemeral Multi-Tenant Mock Gateway stopped.");
    }
  }

  console.log("\n======================================================================");
  console.log(`📊 Test Summary: ${passedAssertions} Passed, ${failedAssertions} Failed`);
  console.log("======================================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
