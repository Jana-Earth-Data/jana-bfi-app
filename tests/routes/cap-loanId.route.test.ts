/**
 * Route tests: GET /api/cap/[loanId], POST /api/cap/[loanId]
 *
 * Per TEST_STRATEGY §4.2, high-priority compliance route. Tests:
 *   1. Happy path — fetch/save CAP (Corrective Action Plan) data
 *   2. Auth failure — missing officer → 401
 *   3. Bad input — invalid status, missing fields → 400
 */

import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/cap/[loanId]/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TEST_LOAN_ID,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";
import { server } from "../helpers/msw-setup";
import { http, HttpResponse } from "msw";

describe("GET /api/cap/[loanId]", () => {
  describe("Happy path", () => {
    it("returns CAP items for loan", async () => {
      server.use(
        http.get("https://test.supabase.co/rest/v1/bfi_cap_items", () => {
          return HttpResponse.json([
            {
              id: "cap-123",
              loan_id: TEST_LOAN_ID,
              covenant_id: "cov-1",
              status: "not_started",
            },
          ]);
        }),
      );

      const request = createMockRequest(
        `/api/cap/${TEST_LOAN_ID}`,
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await GET(request, { params: { loanId: TEST_LOAN_ID } });
      const json = await expectJsonSuccess(response, 200);
      expect(Array.isArray(json)).toBe(true);
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer missing", async () => {
      const request = createMockRequest(
        `/api/cap/${TEST_LOAN_ID}`,
        {
          method: "GET",
          cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
        },
      );

      const response = await GET(request, { params: { loanId: TEST_LOAN_ID } });
      await expectJsonError(response, 401);
    });
  });
});

describe("POST /api/cap/[loanId]", () => {
  describe("Happy path", () => {
    it("updates CAP item", async () => {
      server.use(
        http.post("https://test.supabase.co/rest/v1/bfi_cap_items", () => {
          return HttpResponse.json({
            id: "cap-123",
            updated_at: "2024-01-15T12:00:00Z",
          });
        }),
      );

      const request = createMockRequest(
        `/api/cap/${TEST_LOAN_ID}`,
        {
          method: "POST",
          body: {
            capItemId: "cap-123",
            status: "in_progress",
            correctiveAction: "Test action",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request, { params: { loanId: TEST_LOAN_ID } });
      await expectJsonSuccess(response, 200);
    });
  });

  describe("Bad input", () => {
    it("returns 400 when status is invalid", async () => {
      const request = createMockRequest(
        `/api/cap/${TEST_LOAN_ID}`,
        {
          method: "POST",
          body: {
            capItemId: "cap-123",
            status: "invalid_status",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request, { params: { loanId: TEST_LOAN_ID } });
      await expectJsonError(response, 400);
    });
  });
});
