/**
 * Route tests: POST /api/officer/set
 *
 * Per TEST_STRATEGY §4.2, tests:
 *   1. Happy path — valid officerId + tenant → sets cookie, returns officer data
 *   2. Auth failure — officer from wrong tenant → 403 (prevents tenant leakage)
 *   3. Bad input — missing/malformed officerId → 400
 *
 * This route is a critical trust boundary: it validates that an officer belongs
 * to the current tenant before setting the jana_demo_officer cookie. A bug here
 * could allow cross-tenant access.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/officer/set/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  TEST_TENANT_ID,
  TEST_OFFICER_ID,
  TENANT_COOKIE_NAME,
  OFFICER_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup"; // Activates MSW
import { server } from "../helpers/msw-setup";
import { http, HttpResponse } from "msw";

describe("POST /api/officer/set", () => {
  describe("Happy path", () => {
    it("sets cookie and returns officer data when officer belongs to tenant", async () => {
      const request = createMockRequest(
        "/api/officer/set",
        {
          method: "POST",
          body: { officerId: TEST_OFFICER_ID },
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID },
        },
      );

      const response = await POST(request);
      const json = await expectJsonSuccess(response, 200);

      // Assert response shape
      expect(json).toHaveProperty("ok", true);
      expect(json).toHaveProperty("officer");
      expect(json.officer).toHaveProperty("id", TEST_OFFICER_ID);
      expect(json.officer).toHaveProperty("name");
      expect(json.officer).toHaveProperty("role");

      // Assert cookie was set (NextResponse.cookies API)
      const setCookieHeader = response.headers.get("set-cookie");
      expect(setCookieHeader).toBeTruthy();
      expect(setCookieHeader).toContain(OFFICER_COOKIE_NAME);
      expect(setCookieHeader).toContain(TEST_OFFICER_ID);
      expect(setCookieHeader).toContain("HttpOnly");
      expect(setCookieHeader).toContain("SameSite=Strict");
    });
  });

  describe("Auth failure (cross-tenant protection)", () => {
    it("returns 403 when officer does not belong to current tenant", async () => {
      // Mock: officer lookup returns empty (no officer with this ID for this tenant)
      server.use(
        http.get("https://test.supabase.co/rest/v1/bfi_officers", () => {
          return HttpResponse.json([]);
        }),
      );

      const request = createMockRequest(
        "/api/officer/set",
        {
          method: "POST",
          body: { officerId: "officer-from-different-bank" },
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID },
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 403, "does not belong to the current tenant");
    });
  });

  describe("Bad input", () => {
    it("returns 400 when body is not JSON", async () => {
      // Create request with invalid JSON body
      const url = "https://test.jana.earth/api/officer/set";
      const request = new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{",
      }) as any; // Cast to bypass TypeScript - tests runtime behavior

      // Manually set cookies since we're using raw Request
      const nextRequest = new (await import("next/server")).NextRequest(request);
      nextRequest.cookies.set(TENANT_COOKIE_NAME, TEST_TENANT_ID);

      const response = await POST(nextRequest);
      await expectJsonError(response, 400, "Body must be JSON");
    });

    it("returns 400 when officerId is missing", async () => {
      const request = createMockRequest(
        "/api/officer/set",
        {
          method: "POST",
          body: {}, // Missing officerId
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID },
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "officerId is required");
    });

    it("returns 400 when officerId is empty string", async () => {
      const request = createMockRequest(
        "/api/officer/set",
        {
          method: "POST",
          body: { officerId: "   " }, // Whitespace only
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID },
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "officerId is required");
    });

    it("returns 400 when officerId is not a string", async () => {
      const request = createMockRequest(
        "/api/officer/set",
        {
          method: "POST",
          body: { officerId: 123 }, // Number, not string
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID },
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "officerId is required");
    });
  });
});
