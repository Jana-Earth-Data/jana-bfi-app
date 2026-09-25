/**
 * Route tests: GET /api/health
 *
 * Per TEST_STRATEGY §4.2, Tier 2 tests cover all 41 routes with:
 *   1. Happy path — valid request → correct shape
 *   2. Auth failure (where applicable) — missing token → 401/403
 *   3. Bad input (where applicable) — malformed request → 400
 *
 * The health endpoint is unauthenticated and has no input, so only (1) applies.
 * This is the simplest route test and serves as the template for others.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";
import { createMockRequest, expectJsonSuccess } from "../helpers/route-test-utils";

describe("GET /api/health", () => {
  it("returns 200 with status, timestamp, and demo flag", async () => {
    const request = createMockRequest("/api/health");
    const response = await GET();

    const json = await expectJsonSuccess(response, 200);

    // Assert response shape
    expect(json).toHaveProperty("status", "ok");
    expect(json).toHaveProperty("timestamp");
    expect(json).toHaveProperty("demo");

    // Timestamp should be a valid ISO8601 string
    expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);

    // Demo flag should be boolean
    expect(typeof json.demo).toBe("boolean");
  });

  it("returns fresh timestamp on each call (force-dynamic)", async () => {
    const request1 = createMockRequest("/api/health");
    const response1 = await GET();
    const json1 = await expectJsonSuccess(response1);

    // Wait 10ms to ensure timestamp differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const request2 = createMockRequest("/api/health");
    const response2 = await GET();
    const json2 = await expectJsonSuccess(response2);

    // Timestamps should differ (proves force-dynamic, not cached)
    expect(json1.timestamp).not.toBe(json2.timestamp);
  });
});
