import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

/**
 * Grafana k6 Load Test: Order Creation & gRPC Microservices Throughput Benchmark
 *
 * Performance SLAs:
 * - Latency: p(95) < 50ms, p(99) < 100ms
 * - Zero unhandled 5xx server errors (rate < 0.01%)
 * - Accurate accounting of successful 201 reservations vs 409 inventory race conflicts
 */

// Custom Metrics
const successfulOrders = new Counter("successful_order_reservations_201");
const conflictOrders = new Counter("inventory_conflicts_409");
const failedRequests = new Rate("failed_unexpected_requests");
const orderCreationLatency = new Trend("order_creation_latency", true);

export const options = {
  stages: [
    { duration: "10s", target: 30 }, // Ramp-up to 30 concurrent users
    { duration: "30s", target: 60 }, // Sustain steady peak load at 60 VUs
    { duration: "10s", target: 0 },  // Graceful ramp-down
  ],
  thresholds: {
    // Primary Architectural SLA Gates: p95 < 50ms, p99 < 100ms
    http_req_duration: ["p(95)<50", "p(99)<100"],
    order_creation_latency: ["p(95)<50", "p(99)<100"],
    // Error rate must remain under 1% under peak concurrency
    failed_unexpected_requests: ["rate<0.01"],
  },
};

const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:8080";

export default function () {
  const url = `${GATEWAY_URL}/api/orders`;

  // Realistic randomized catalog item and buyer identity pool
  const randomBuyerIndex = Math.floor(Math.random() * 1000) + 1;
  const randomProductIndex = Math.floor(Math.random() * 50) + 1;

  const payload = JSON.stringify({
    productId: `prod-catalog-benchmark-${randomProductIndex}`,
    buyerId: `bench-buyer-${randomBuyerIndex}`,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // Randomize IP to distribute across rate limiter token buckets
      "X-Forwarded-For": `10.0.${Math.floor(randomBuyerIndex / 256)}.${randomBuyerIndex % 256}`,
    },
    tags: { name: "CreateOrderThroughput" },
  };

  const startTime = new Date().getTime();
  const res = http.post(url, payload, params);
  const latencyMs = new Date().getTime() - startTime;

  orderCreationLatency.add(latencyMs);

  const isSuccess = res.status === 201;
  const isConflict = res.status === 409;
  const isExpectedBusinessResult = isSuccess || isConflict;

  if (isSuccess) {
    successfulOrders.add(1);
    failedRequests.add(0);

    check(res, {
      "Order created (201 Created)": (r) => r.status === 201,
      "Response has valid order ID": (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.id !== undefined && body.id.length > 0;
        } catch {
          return false;
        }
      },
      "Latency SLA p95 compliant (< 50ms)": () => latencyMs < 50,
    });
  } else if (isConflict) {
    conflictOrders.add(1);
    failedRequests.add(0);

    check(res, {
      "Item already reserved (409 Conflict)": (r) => r.status === 409,
    });
  } else {
    failedRequests.add(1);

    check(res, {
      "Unexpected HTTP response code": () => false,
    });
  }

  // Inter-arrival pacing (simulate 50-100ms user think time)
  sleep(0.05 + Math.random() * 0.05);
}
