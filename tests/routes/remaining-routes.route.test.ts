/**
 * Route tests: Remaining routes
 * - GET /api/esrm/screenings
 * - GET /api/esdd/officer-queue
 * - GET /api/climate/borrower/[borrowerId]
 * - GET /api/pcaf/availability/[borrowerId], POST /api/pcaf/availability/[borrowerId]
 * - GET /api/pcaf/evidence/[loanId]
 * - POST /api/loans/[loanId]/claim
 * - POST /api/loans/[loanId]/category
 * - GET /api/followups
 */

import { describe, it, expect } from "vitest";
import { GET as esrmScreeningsGet } from "@/app/api/esrm/screenings/route";
import { GET as esddOfficerQueueGet } from "@/app/api/esdd/officer-queue/route";
import { GET as climateBorrowerGet } from "@/app/api/climate/borrower/[borrowerId]/route";
import { GET as pcafAvailGet, POST as pcafAvailPost } from "@/app/api/pcaf/availability/[borrowerId]/route";
import { GET as pcafEvidenceGet } from "@/app/api/pcaf/evidence/[loanId]/route";
import { POST as loanClaimPost } from "@/app/api/loans/[loanId]/claim/route";
import { PATCH as loanCategoryPatch } from "@/app/api/loans/[loanId]/category/route";
import { GET as followupsGet } from "@/app/api/followups/route";
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

describe("GET /api/esrm/screenings", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/esrm/screenings",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await esrmScreeningsGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/esdd/officer-queue", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/esdd/officer-queue",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await esddOfficerQueueGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/climate/borrower/[borrowerId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/climate/borrower/${TEST_BORROWER_ID}`,
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await climateBorrowerGet(request, { params: { borrowerId: TEST_BORROWER_ID } });
    await expectJsonError(response, 401);
  });
});

describe("GET /api/pcaf/availability/[borrowerId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/pcaf/availability/${TEST_BORROWER_ID}`,
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pcafAvailGet(request, { params: { borrowerId: TEST_BORROWER_ID } });
    await expectJsonError(response, 401);
  });
});

describe("POST /api/pcaf/availability/[borrowerId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/pcaf/availability/${TEST_BORROWER_ID}`,
      {
        method: "POST",
        body: {},
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pcafAvailPost(request, { params: { borrowerId: TEST_BORROWER_ID } });
    await expectJsonError(response, 401);
  });
});

describe("GET /api/pcaf/evidence/[loanId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/pcaf/evidence/${TEST_LOAN_ID}`,
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pcafEvidenceGet(request, { params: { loanId: TEST_LOAN_ID } });
    await expectJsonError(response, 401);
  });
});

describe("POST /api/loans/[loanId]/claim", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/loans/${TEST_LOAN_ID}/claim`,
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await loanClaimPost(request, { params: { loanId: TEST_LOAN_ID } });
    await expectJsonError(response, 401);
  });
});

describe("PATCH /api/loans/[loanId]/category", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/loans/${TEST_LOAN_ID}/category`,
      {
        method: "PATCH",
        body: { category: "business-loans" },
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await loanCategoryPatch(request, { params: Promise.resolve({ loanId: TEST_LOAN_ID }) });
    await expectJsonError(response, 401);
  });
});

describe("GET /api/followups", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/followups",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await followupsGet(request);
    await expectJsonError(response, 401);
  });
});
