/**
 * Route tests: Tenant and auth routes
 * - POST /api/tenant/set-code
 * - POST /api/tenant/clear
 * - POST /api/officer/clear
 * - POST /api/auth/device-code
 * - POST /api/auth/device-token
 */

import { describe, it, expect } from "vitest";
import { POST as setCodePost } from "@/app/api/tenant/set-code/route";
import { POST as clearTenantPost } from "@/app/api/tenant/clear/route";
import { POST as clearOfficerPost } from "@/app/api/officer/clear/route";
import { POST as deviceCodePost } from "@/app/api/auth/device-code/route";
import { POST as deviceTokenPost } from "@/app/api/auth/device-token/route";
import {
  createMockRequest,
  expectJsonSuccess,
  expectJsonError,
} from "../helpers/route-test-utils";
import "../helpers/msw-setup";

describe("POST /api/tenant/set-code", () => {
  it("returns 200 with default tenant when code missing", async () => {
    const request = createMockRequest(
      "/api/tenant/set-code",
      {
        method: "POST",
        body: {},
      },
    );

    const response = await setCodePost(request);
    const json = await expectJsonSuccess(response, 200);
    expect(json.ok).toBe(true);
    expect(json.matched).toBe(false);
  });

  it("returns 200 with default tenant when code is not string", async () => {
    const request = createMockRequest(
      "/api/tenant/set-code",
      {
        method: "POST",
        body: { code: 123 },
      },
    );

    const response = await setCodePost(request);
    const json = await expectJsonSuccess(response, 200);
    expect(json.ok).toBe(true);
    expect(json.matched).toBe(false);
  });

  it("returns 400 when body is malformed JSON", async () => {
    const url = "https://test.jana.earth/api/tenant/set-code";
    const request = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as unknown as Request;

    const nextRequest = new (await import("next/server")).NextRequest(request);
    const response = await setCodePost(nextRequest);

    await expectJsonError(response, 400);
  });
});

describe("POST /api/tenant/clear", () => {
  it("clears tenant cookie", async () => {
    const request = createMockRequest(
      "/api/tenant/clear",
      {
        method: "POST",
      },
    );

    const response = await clearTenantPost(request);
    await expectJsonSuccess(response, 200);
  });
});

describe("POST /api/officer/clear", () => {
  it("clears officer cookie", async () => {
    const request = createMockRequest(
      "/api/officer/clear",
      {
        method: "POST",
      },
    );

    const response = await clearOfficerPost(request);
    await expectJsonSuccess(response, 200);
  });
});

describe("POST /api/auth/device-code", () => {
  it("handles auth service errors gracefully", async () => {
    // This route forwards to AUTH_URL (set in .env.local to auth-dev.jana.earth).
    // Without an MSW handler, the fetch will fail with a network error or HTML response.
    // Testing that the route catches errors and returns a 500 with error message.
    const request = createMockRequest(
      "/api/auth/device-code",
      {
        method: "POST",
      },
    );

    const response = await deviceCodePost(request);
    // Unhandled fetch → catch block returns "Auth service error: ..."
    await expectJsonError(response, 500, "Auth service error");
  });
});

describe("POST /api/auth/device-token", () => {
  it("returns 400 when body malformed", async () => {
    const url = "https://test.jana.earth/api/auth/device-token";
    const request = new Request(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as unknown as Request;

    const nextRequest = new (await import("next/server")).NextRequest(request);
    const response = await deviceTokenPost(nextRequest);

    await expectJsonError(response, 400);
  });
});
