/**
 * Route tests: POST /api/taxonomy/assessments, GET /api/taxonomy/assessments
 *
 * Per TEST_STRATEGY §4.2, high-priority compliance route. Tests:
 *   1. Happy path — save/fetch taxonomy assessments
 *   2. Auth failure — missing officer → 401
 *   3. Bad input — invalid classification, missing fields → 400
 */

import { describe, it, expect } from "vitest";
import { POST, GET } from "@/app/api/taxonomy/assessments/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TEST_LOAN_ID,
  TEST_BORROWER_ID,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";
import { server } from "../helpers/msw-setup";
import { http, HttpResponse } from "msw";

describe("POST /api/taxonomy/assessments", () => {
  describe("Happy path", () => {
    it("inserts taxonomy assessment", async () => {
      server.use(
        http.post("https://test.supabase.co/rest/v1/bfi_taxonomy_assessments", () => {
          return HttpResponse.json({
            id: "assessment-123",
            created_at: "2024-01-15T12:00:00Z",
          });
        }),
      );

      const request = createMockRequest(
        "/api/taxonomy/assessments",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            activityId: "hydro",
            criterionAnswers: { capacity_mw: 5 },
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonSuccess(response, 200);
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer missing", async () => {
      const request = createMockRequest(
        "/api/taxonomy/assessments",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            activityId: "hydro",
            classification: "green",
          },
          cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 401);
    });
  });

  describe("Bad input", () => {
    it("returns 400 when activityId is unknown", async () => {
      const request = createMockRequest(
        "/api/taxonomy/assessments",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            activityId: "unknown-activity-id",
            criterionAnswers: {},
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "Unknown activityId");
    });

    it("returns 400 when loanId missing", async () => {
      const request = createMockRequest(
        "/api/taxonomy/assessments",
        {
          method: "POST",
          body: {
            borrowerId: TEST_BORROWER_ID,
            activityId: "hydro",
            criterionAnswers: {},
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400);
    });
  });
});

describe("GET /api/taxonomy/assessments", () => {
  describe("Happy path", () => {
    it("returns latest assessment", async () => {
      server.use(
        http.get("https://test.supabase.co/rest/v1/bfi_taxonomy_assessments", () => {
          return HttpResponse.json([
            {
              id: "assessment-123",
              loan_id: TEST_LOAN_ID,
              activity_id: "hydro",
              computed_color: "green",
              captured_at: "2024-01-15T12:00:00Z",
              officer_id: "officer-123",
            },
          ]);
        }),
        http.get("https://test.supabase.co/rest/v1/bfi_officers", () => {
          return HttpResponse.json([
            {
              id: "officer-123",
              name: "Test Officer",
            },
          ]);
        }),
      );

      const request = createMockRequest(
        `/api/taxonomy/assessments?loanId=${TEST_LOAN_ID}`,
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await GET(request);
      const json = await expectJsonSuccess(response, 200);
      expect(json.ok).toBe(true);
      expect(json.loanId).toBe(TEST_LOAN_ID);
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer missing", async () => {
      const request = createMockRequest(
        `/api/taxonomy/assessments?loanId=${TEST_LOAN_ID}`,
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
