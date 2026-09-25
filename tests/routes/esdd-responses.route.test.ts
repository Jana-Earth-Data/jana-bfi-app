/**
 * Route tests: POST /api/esdd/responses, GET /api/esdd/responses
 *
 * Per TEST_STRATEGY §4.2, tests:
 *   1. Happy path — valid answer insert, fetch latest answers per question
 *   2. Auth failure — missing officer → 401, wrong tenant/owner → 403
 *   3. Bad input — invalid answer value, missing fields → 400
 *
 * This is a high-priority compliance route (TEST_STRATEGY §4.2): answers drive
 * regulatory risk ratings and CAP derivation. A bug here affects lending decisions.
 */

import { describe, it, expect } from "vitest";
import { POST, GET } from "@/app/api/esdd/responses/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  TEST_TENANT_ID,
  TEST_OFFICER_ID,
  TEST_LOAN_ID,
  TEST_BORROWER_ID,
  officerCookies,
  TENANT_COOKIE_NAME,
  OFFICER_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";
import { server } from "../helpers/msw-setup";
import { http, HttpResponse } from "msw";

describe("POST /api/esdd/responses", () => {
  describe("Happy path", () => {
    it("inserts answer and returns id + timestamp", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.1.1",
            answer: "a",
            remarks: "Test remark",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      const json = await expectJsonSuccess(response, 200);

      // Assert response contains insert confirmation
      expect(json).toHaveProperty("id");
      expect(json).toHaveProperty("captured_at");

      // Timestamp should be ISO8601
      expect(new Date(json.captured_at).toISOString()).toBe(json.captured_at);
    });

    it("accepts answer without remarks (optional field)", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.2.3",
            answer: "b",
            // remarks omitted
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonSuccess(response, 200);
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer cookie is missing", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.1.1",
            answer: "a",
          },
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID }, // Tenant but no officer
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 401, "officer");
    });

    it("returns 403 when officer is not the loan owner (P36 owner-only rule)", async () => {
      // Mock: loan is owned by a different officer
      server.use(
        http.get("https://test.supabase.co/rest/v1/bfi_loan_assignments", () => {
          return HttpResponse.json([
            {
              loan_id: TEST_LOAN_ID,
              officer_id: "different-officer-456",
              bank_id: TEST_TENANT_ID,
            },
          ]);
        }),
      );

      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.1.1",
            answer: "a",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 403, "not assigned");
    });
  });

  describe("Bad input", () => {
    it("returns 400 when answer is not a/b/c/d", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.1.1",
            answer: "x", // Invalid
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "answer must be one of 'a', 'b', 'c', 'd'");
    });

    it("returns 400 when loanId is missing", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            // loanId missing
            borrowerId: TEST_BORROWER_ID,
            questionId: "annex5.1.1",
            answer: "a",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "loanId");
    });

    it("returns 400 when questionId is missing", async () => {
      const request = createMockRequest(
        "/api/esdd/responses",
        {
          method: "POST",
          body: {
            loanId: TEST_LOAN_ID,
            borrowerId: TEST_BORROWER_ID,
            // questionId missing
            answer: "a",
          },
          cookies: officerCookies(),
        },
      );

      const response = await POST(request);
      await expectJsonError(response, 400, "questionId");
    });
  });
});

describe("GET /api/esdd/responses", () => {
  describe("Happy path", () => {
    it("returns latest answers for a loan", async () => {
      const request = createMockRequest(
        "/api/esdd/responses?loanId=" + TEST_LOAN_ID,
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await GET(request);
      const json = await expectJsonSuccess(response, 200);

      // Should return array of responses
      expect(Array.isArray(json)).toBe(true);
      if (json.length > 0) {
        const first = json[0];
        expect(first).toHaveProperty("id");
        expect(first).toHaveProperty("loan_id");
        expect(first).toHaveProperty("question_id");
        expect(first).toHaveProperty("answer");
        expect(first).toHaveProperty("captured_at");
        expect(["a", "b", "c", "d"]).toContain(first.answer);
      }
    });
  });

  describe("Auth failure", () => {
    it("returns 401 when officer cookie is missing", async () => {
      const request = createMockRequest(
        "/api/esdd/responses?loanId=" + TEST_LOAN_ID,
        {
          method: "GET",
          cookies: { [TENANT_COOKIE_NAME]: TEST_TENANT_ID }, // Tenant but no officer
        },
      );

      const response = await GET(request);
      await expectJsonError(response, 401, "officer");
    });
  });

  describe("Bad input", () => {
    it("returns 400 when loanId query param is missing", async () => {
      const request = createMockRequest(
        "/api/esdd/responses", // No ?loanId=
        {
          method: "GET",
          cookies: officerCookies(),
        },
      );

      const response = await GET(request);
      await expectJsonError(response, 400, "loanId");
    });
  });
});
