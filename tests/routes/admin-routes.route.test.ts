/**
 * Route tests: Admin routes (seed, reset, seed-officers, seed-demo-data)
 *
 * Per TEST_STRATEGY §4.2, admin routes require admin token auth.
 */

import { describe, it, expect } from "vitest";
import { POST as seedPost } from "@/app/api/admin/seed/route";
import { POST as resetPost } from "@/app/api/admin/reset/route";
import { POST as seedOfficersPost } from "@/app/api/admin/seed-officers/route";
import { POST as seedDemoDataPost } from "@/app/api/admin/seed-demo-data/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
  adminCookies,
  TENANT_COOKIE_NAME,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("POST /api/admin/seed", () => {
  it("requires admin auth", async () => {
    const request = createMockRequest(
      "/api/admin/seed",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" }, // No admin token
      },
    );

    const response = await seedPost(request);
    await expectJsonError(response, 401);
  });
});

describe("POST /api/admin/reset", () => {
  it("requires admin auth", async () => {
    const request = createMockRequest(
      "/api/admin/reset",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await resetPost(request);
    await expectJsonError(response, 401);
  });
});

describe("POST /api/admin/seed-officers", () => {
  it("requires admin auth", async () => {
    const request = createMockRequest(
      "/api/admin/seed-officers",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await seedOfficersPost(request);
    await expectJsonError(response, 401);
  });
});

describe("POST /api/admin/seed-demo-data", () => {
  it("requires admin auth", async () => {
    const request = createMockRequest(
      "/api/admin/seed-demo-data",
      {
        method: "POST",
        cookies: { [TENANT_COOKIE_NAME]: "bank-test" },
      },
    );

    const response = await seedDemoDataPost(request);
    await expectJsonError(response, 401);
  });
});
