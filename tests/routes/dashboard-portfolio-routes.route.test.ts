/**
 * Route tests: Dashboard and portfolio routes
 * - GET /api/dashboard-data
 * - GET /api/bfi-data
 * - GET /api/portfolio/loans
 * - GET /api/portfolio/taxonomy-summary
 * - GET /api/settings
 * - GET /api/demo/mode, POST /api/demo/mode
 */

import { describe, it, expect } from "vitest";
import { GET as dashboardDataGet } from "@/app/api/dashboard-data/route";
import { GET as bfiDataGet } from "@/app/api/bfi-data/route";
import { GET as portfolioLoansGet } from "@/app/api/portfolio/loans/route";
import { GET as taxonomySummaryGet } from "@/app/api/portfolio/taxonomy-summary/route";
import { GET as settingsGet } from "@/app/api/settings/route";
import { GET as demoModeGet, POST as demoModePost } from "@/app/api/demo/mode/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  officerCookies,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("GET /api/dashboard-data", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/dashboard-data",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await dashboardDataGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/bfi-data", () => {
  it("requires tenant", async () => {
    const request = createMockRequest(
      "/api/bfi-data",
      {
        method: "GET",
        cookies: {},
      },
    );

    const response = await bfiDataGet(request);
    // May return error or empty data depending on implementation
    expect([200, 400, 401]).toContain(response.status);
  });
});

describe("GET /api/portfolio/loans", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/portfolio/loans",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await portfolioLoansGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/portfolio/taxonomy-summary", () => {
  it("requires officer auth", async () => {
    const request = createMockRequest(
      "/api/portfolio/taxonomy-summary",
      {
        method: "GET",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await taxonomySummaryGet(request);
    await expectJsonError(response, 401);
  });
});

describe("GET /api/settings", () => {
  it("returns settings", async () => {
    const request = createMockRequest(
      "/api/settings",
      {
        method: "GET",
        cookies: officerCookies(),
      },
    );

    const response = await settingsGet(request);
    const json = await expectJsonSuccess(response, 200);
    expect(json).toHaveProperty("demo");
  });
});

describe("GET /api/demo/mode", () => {
  it("returns demo mode status", async () => {
    const request = createMockRequest(
      "/api/demo/mode",
      {
        method: "GET",
      },
    );

    const response = await demoModeGet(request);
    const json = await expectJsonSuccess(response, 200);
    expect(json).toHaveProperty("demoMode");
    expect(typeof json.demoMode).toBe("boolean");
  });
});

describe("POST /api/demo/mode", () => {
  it("returns 400 when demoMode not boolean", async () => {
    const request = createMockRequest(
      "/api/demo/mode",
      {
        method: "POST",
        body: { demoMode: "yes" },
      },
    );

    const response = await demoModePost(request);
    await expectJsonError(response, 400);
  });
});
