/**
 * Route tests: Manager, PF screening, and Hydro routes
 * - GET /api/manager/queue
 * - GET /api/manager/assignments
 * - POST /api/pf-screening/submit
 * - GET /api/pf-screening/responses
 * - GET /api/pf-screening/loan/[loanId]
 * - GET /api/hydro/docs
 * - GET /api/hydro/docs/[loanId]
 */

import { describe, it, expect } from "vitest";
import { GET as managerQueueGet } from "@/app/api/manager/queue/route";
import { GET as managerAssignmentsGet } from "@/app/api/manager/assignments/route";
import { POST as pfScreeningSubmitPost } from "@/app/api/pf-screening/submit/route";
import { GET as pfScreeningResponsesGet } from "@/app/api/pf-screening/responses/route";
import { GET as pfScreeningLoanGet } from "@/app/api/pf-screening/loan/[loanId]/route";
import { POST as hydroDocsPost } from "@/app/api/hydro/docs/route";
import { GET as hydroDocsLoanGet } from "@/app/api/hydro/docs/[loanId]/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TEST_LOAN_ID,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("GET /api/manager/queue", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/manager/queue",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await managerQueueGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/manager/assignments", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/manager/assignments",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await managerAssignmentsGet(request);
    await expectJsonError(response, 401);
  });
});

describe("POST /api/pf-screening/submit", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/pf-screening/submit",
      {
        method: "POST",
        body: { loanId: TEST_LOAN_ID },
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pfScreeningSubmitPost(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/pf-screening/responses", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/pf-screening/responses",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pfScreeningResponsesGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/pf-screening/loan/[loanId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/pf-screening/loan/${TEST_LOAN_ID}`,
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await pfScreeningLoanGet(request, { params: { loanId: TEST_LOAN_ID } });
    await expectJsonError(response, 401);
  });
});

describe("POST /api/hydro/docs", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/hydro/docs",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await hydroDocsPost(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/hydro/docs/[loanId]", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      `/api/hydro/docs/${TEST_LOAN_ID}`,
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await hydroDocsLoanGet(request, { params: { loanId: TEST_LOAN_ID } });
    await expectJsonError(response, 401);
  });
});
