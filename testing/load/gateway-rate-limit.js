import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

/**
 * Grafana k6 Load Test: API Gateway Redis Token Bucket Rate Limiting Benchmark
 *
 * Mission:
 * - Flood Edge Gateway at 150 req/s against POST /api/orders
 * - Verify Token Bucket algorithm throttles burst traffic
 * - Assert rate-limited requests receive HTTP 429 within < 20ms response time
 */

// Custom Metrics
const rateLimitedCount = new Counter("rate_limited_requests_429");
const allowedRequestsCount = new Counter("allowed_requests_non_429");
const rateLimitLatency = new Trend("rate_limit_rejection_latency");
const errorRate = new Rate("unexpected_server_errors_5xx");

export const options = {
  scenarios: {
    gateway_rate_limit_burst: {
      executor: "constant-arrival-rate",
      rate: 150, // 150 requests per second
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 50,
      maxVUs: 150,
    },
  },
  thresholds: {
    // Edge rate limit rejection must be blazingly fast (< 20ms p95, < 30ms p99)
    "http_req_duration{status:429}": ["p(95)<20", "p(99)<30"],
    // Overall rate limit rejection latency
    rate_limit_rejection_latency: ["p(95)<20", "p(99)<30"],
    // Verify that rate limiter actually throttled excess traffic
    rate_limited_requests_429: ["count>0"],
    // Zero 500 internal server crashes under load
    unexpected_server_errors_5xx: ["rate<0.001"],
  },
};

const GATEWAY_URL = __ENV.GATEWAY_URL || "http://localhost:8080";

export default function () {
  const url = `${GATEWAY_URL}/api/orders`;

  // Simulate multiple buyer clients sending order requests
  const buyerId = `stress-buyer-${Math.floor(Math.random() * 20)}`;
  const productId = `prod-used-item-${Math.floor(Math.random() * 5)}`;

  const payload = JSON.stringify({
    productId: productId,
    buyerId: buyerId,
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
      // Distinct IP simulation for Gateway Rate Limiter client key
      "X-Forwarded-For": `192.168.1.${Math.floor(Math.random() * 5) + 1}`,
      Accept: "application/json",
    },
    tags: { name: "PostOrderRateLimit" },
  };

  const startTime = new Date().getTime();
  const res = http.post(url, payload, params);
  const duration = new Date().getTime() - startTime;

  if (res.status === 429) {
    rateLimitedCount.add(1);
    rateLimitLatency.add(duration);

    check(res, {
      "Rate Limit HTTP status is 429": (r) => r.status === 429,
      "Response time is under 20ms": () => duration < 20,
      "Response body indicates rate limit exceeded": (r) =>
        r.body.includes("Rate limit exceeded") || r.body.includes("429"),
    });
  } else if (res.status === 201 || res.status === 409 || res.status === 400) {
    allowedRequestsCount.add(1);

    check(res, {
      "Allowed request returned valid business response": (r) =>
        r.status === 201 || r.status === 409 || r.status === 400,
    });
  } else if (res.status >= 500) {
    errorRate.add(1);
  }
}
