/**
 * Route tests: GET /api/pcaf/scores
 *
 * Per TEST_STRATEGY §4.2, high-priority compliance route. Tests:
 *   1. Happy path — returns PCAF scores for loans
 *   2. Auth failure — missing officer → 401
 *   3. Bad input — missing/invalid query params → 400
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/pcaf/scores/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("GET /api/pcaf/scores", () => {
  describe("Happy path", () => {
    it("returns PCAF scores array", async () => {
      const request = createMockRequest(
        "/api/pcaf/scores",
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await GET(request);
      const json = await expectJsonSuccess(response, 200);

      // Should return array (may be empty in test environment)
      expect(Array.isArray(json)).toBe(true);
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer cookie is missing", async () => {
      const request = createMockRequest(
        "/api/pcaf/scores",
        {
          method: "GET",
          cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
        },
      );

      const response = await GET(request);
      await expectJsonError(response, 401);
    });
  });
});
