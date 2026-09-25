/**
 * Shared utilities for API route testing.
 *
 * Per TEST_STRATEGY §4.2, every route test asserts:
 *   1. Happy path — valid request → correct shape
 *   2. Auth failure — missing/invalid officer/admin → 401/403
 *   3. Bad input — malformed body → 400
 *
 * These helpers reduce boilerplate across the 41 route tests.
 */

import { NextRequest } from "next/server";

/**
 * Creates a mock NextRequest for testing route handlers.
 *
 * @param path - The request path (e.g., "/api/esdd/responses")
 * @param options - Request init options (method, body, headers, cookies)
 * @returns NextRequest instance suitable for passing to route handlers
 */
export function createMockRequest(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
  } = {},
): NextRequest {
  const {
    method = "GET",
    body,
    headers = {},
    cookies = {},
  } = options;

  const url = `https://test.jana.earth${path}`;
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    init.body = JSON.stringify(body);
  }

  const request = new NextRequest(url, init);

  // Set cookies if provided (NextRequest cookies API)
  Object.entries(cookies).forEach(([name, value]) => {
    request.cookies.set(name, value);
  });

  return request;
}

/**
 * Standard test tenant ID used across route tests.
 * Matches the bank_id in msw-handlers mock data.
 */
export const TEST_TENANT_ID = "bank-nepal-dev";

/**
 * Standard test officer ID used across route tests.
 * Matches the officer_id in msw-handlers mock data.
 */
export const TEST_OFFICER_ID = "officer-123";

/**
 * Standard test loan ID used across route tests.
 */
export const TEST_LOAN_ID = "loan-456";

/**
 * Standard test borrower ID used across route tests.
 */
export const TEST_BORROWER_ID = "borrower-101";

/**
 * Cookie names (must match lib/officers/resolve.ts and lib/tenants/index.ts).
 */
export const TENANT_COOKIE_NAME = "jana_demo_tenant";
export const OFFICER_COOKIE_NAME = "jana_demo_officer";
export const ADMIN_TOKEN_COOKIE_NAME = "jana_demo_admin_token";

/**
 * Creates standard cookies for an authenticated officer request.
 */
export function officerCookies() {
  return {
    [TENANT_COOKIE_NAME]: TEST_TENANT_ID,
    [OFFICER_COOKIE_NAME]: TEST_OFFICER_ID,
  };
}

/**
 * Creates standard cookies for an admin request.
 * Admin token is a placeholder — routes check presence, not value in demo mode.
 */
export function adminCookies() {
  return {
    [TENANT_COOKIE_NAME]: TEST_TENANT_ID,
    [ADMIN_TOKEN_COOKIE_NAME]: "test-admin-token",
  };
}

/**
 * Asserts a response is a JSON error with expected status and message.
 */
export async function expectJsonError(
  response: Response,
  status: number,
  messageSubstring?: string,
) {
  expect(response.status).toBe(status);
  expect(response.headers.get("content-type")).toContain("application/json");

  const json = await response.json();
  expect(json).toHaveProperty("error");

  if (messageSubstring) {
    expect(json.error).toContain(messageSubstring);
  }

  return json;
}

/**
 * Asserts a response is successful JSON with expected shape.
 */
export async function expectJsonSuccess(
  response: Response,
  statusCode = 200,
) {
  expect(response.status).toBe(statusCode);
  expect(response.headers.get("content-type")).toContain("application/json");

  return await response.json();
}
