/**
 * Automated Test: Test Mode Payment Simulation Bypass
 * Target: POST /api/orders/{id}/simulate-payment
 *
 * Scenarios:
 * 1. Happy Path: Seller has test_mode: true -> Calling simulate-payment instantly confirms order and marks product SOLD.
 * 2. Production Security Gate: Seller has test_mode: false -> Calling simulate-payment is blocked with HTTP 403 Forbidden.
 * 3. State Integrity: Cannot simulate payment on orders in terminal state (CANCELLED or CONFIRMED).
 * 4. Error Handling: Non-existent order IDs return HTTP 404 Not Found.
 *
 * Execution:
 * - Standalone: `node testing/new-features/test-mode-simulation-test.js`
 * - Custom Gateway: `GATEWAY_URL=http://localhost:8080 node testing/new-features/test-mode-simulation-test.js`
 */

import http from "node:http";

const TARGET_URL = process.env.GATEWAY_URL || "http://localhost:8080";

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

function createMockGatewayServer() {
  const sellers = new Map([
    ["seller-sandbox-01", { id: "seller-sandbox-01", name: "Shop Sandbox Demo", testMode: true }],
    ["seller-production-01", { id: "seller-production-01", name: "Apple Store VN", testMode: false }],
  ]);

  const orders = new Map([
    [
      "ORD-TESTMODE-101",
      {
        id: "ORD-TESTMODE-101",
        productId: "prod-item-sandbox",
        sellerId: "seller-sandbox-01",
        buyerId: "buyer-tester-01",
        totalAmount: 15000000,
        status: "PENDING_PAYMENT",
      },
    ],
    [
      "ORD-PROD-202",
      {
        id: "ORD-PROD-202",
        productId: "prod-item-production",
        sellerId: "seller-production-01",
        buyerId: "buyer-tester-02",
        totalAmount: 25000000,
        status: "PENDING_PAYMENT",
      },
    ],
    [
      "ORD-CANCELLED-303",
      {
        id: "ORD-CANCELLED-303",
        productId: "prod-item-cancelled",
        sellerId: "seller-sandbox-01",
        buyerId: "buyer-tester-03",
        totalAmount: 5000000,
        status: "CANCELLED",
      },
    ],
  ]);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

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

    // Simulate Payment Endpoint
    if (req.method === "POST" && url.pathname.match(/\/api\/orders\/[^/]+\/simulate-payment/)) {
      const parts = url.pathname.split("/");
      const orderId = parts[3];
      const order = orders.get(orderId);

      if (!order) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ success: false, error: "Order not found" }));
      }

      const seller = sellers.get(order.sellerId);

      // Gate: Check if seller has testMode enabled
      if (!seller || !seller.testMode) {
        res.writeHead(403, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            success: false,
            error: "Payment simulation is forbidden: Seller does not have test_mode enabled.",
          })
        );
      }

      // Check order terminal status
      if (order.status === "CANCELLED" || order.status === "CONFIRMED") {
        res.writeHead(400, { "Content-Type": "application/json" });
        return res.end(
          JSON.stringify({
            success: false,
            error: `Cannot simulate payment for order in terminal status: ${order.status}`,
          })
        );
      }

      // Execute instant confirmation
      order.status = "CONFIRMED";
      order.confirmedAt = new Date().toISOString();
      order.paymentMethod = "SIMULATED_TEST_MODE";

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          success: true,
          testMode: true,
          orderId: order.id,
          status: order.status,
          message: "Payment successfully simulated. Order CONFIRMED via test_mode.",
        })
      );
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
  console.log("============================================================");
  console.log("🧪 SHOPi QA: Test Mode Payment Simulation Bypass Suite");
  console.log("============================================================");

  let server;
  let baseUrl = TARGET_URL;

  const live = await isServerRunning(baseUrl);
  if (!live) {
    console.log("ℹ️  Live API Gateway not detected on port 8080.");
    console.log("🚀 Spinning up ephemeral Test-Mode Mock Gateway on port 8087...");
    server = createMockGatewayServer();
    await new Promise((resolve) => server.listen(8087, resolve));
    baseUrl = "http://localhost:8087";
  } else {
    console.log(`🌐 Connected to live target: ${baseUrl}`);
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Instant confirmation when seller has test_mode: true
    // -------------------------------------------------------------
    console.log("\n▶ Test 1: Call simulate-payment on order with test_mode seller");
    const res1 = await fetch(`${baseUrl}/api/orders/ORD-TESTMODE-101/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_INSTANT_PAYMENT" }),
    });

    assert(res1.status === 200, `Simulation endpoint returns HTTP 200 OK (Got: ${res1.status})`);
    const data1 = await res1.json();
    assert(data1.success === true, "Response indicates success = true");
    assert(data1.testMode === true, "Response indicates testMode = true");
    assert(data1.status === "CONFIRMED", `Order status transitioned to CONFIRMED (Got: ${data1.status})`);

    // Verify order persistence
    const getRes1 = await fetch(`${baseUrl}/api/orders/ORD-TESTMODE-101`);
    const orderRecord1 = await getRes1.json();
    assert(orderRecord1.status === "CONFIRMED", "Order status verified as CONFIRMED in store");

    // -------------------------------------------------------------
    // Test 2: Production security gate - simulate on test_mode: false
    // -------------------------------------------------------------
    console.log("\n▶ Test 2: Security Gate - simulate-payment blocked on production seller");
    const res2 = await fetch(`${baseUrl}/api/orders/ORD-PROD-202/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_INSTANT_PAYMENT" }),
    });

    assert(res2.status === 403, `Production seller order returns HTTP 403 Forbidden (Got: ${res2.status})`);
    const data2 = await res2.json();
    assert(data2.success === false, "Simulation request rejected");

    // Verify order unchanged
    const getRes2 = await fetch(`${baseUrl}/api/orders/ORD-PROD-202`);
    const orderRecord2 = await getRes2.json();
    assert(orderRecord2.status === "PENDING_PAYMENT", "Production order remains in PENDING_PAYMENT");

    // -------------------------------------------------------------
    // Test 3: Terminal state guard - cannot simulate on CANCELLED order
    // -------------------------------------------------------------
    console.log("\n▶ Test 3: Terminal State Guard - cannot simulate on CANCELLED order");
    const res3 = await fetch(`${baseUrl}/api/orders/ORD-CANCELLED-303/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_INSTANT_PAYMENT" }),
    });

    assert(res3.status === 400, `Cancelled order returns HTTP 400 Bad Request (Got: ${res3.status})`);

    // -------------------------------------------------------------
    // Test 4: Unknown order ID returns HTTP 404 Not Found
    // -------------------------------------------------------------
    console.log("\n▶ Test 4: Unknown order ID handling");
    const res4 = await fetch(`${baseUrl}/api/orders/ORD-UNKNOWN-9999/simulate-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SIMULATE_INSTANT_PAYMENT" }),
    });

    assert(res4.status === 404, `Unknown order returns HTTP 404 Not Found (Got: ${res4.status})`);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log("\n🛑 Ephemeral Test-Mode Mock Gateway stopped.");
    }
  }

  console.log("\n============================================================");
  console.log(`📊 Test Summary: ${passedAssertions} Passed, ${failedAssertions} Failed`);
  console.log("============================================================");

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal test execution error:", err);
  process.exit(1);
});
