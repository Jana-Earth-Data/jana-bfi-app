/**
 * Vitest setup file — runs before all test files.
 *
 * This file contains vi.mock() calls that must be hoisted before any imports.
 * The MSW server lifecycle (beforeAll/afterEach/afterAll) stays in msw-setup.ts
 * which test files import directly.
 */
import { vi } from "vitest";

// Mock Next.js headers module to avoid "called outside request scope" errors
// Default: NO cookies (tests can override by calling setTestCookies())
const testCookieStore: Record<string, string> = {};

export function setTestCookies(cookies: Record<string, string>) {
  Object.keys(testCookieStore).forEach(key => delete testCookieStore[key]);
  Object.assign(testCookieStore, cookies);
}

export function clearTestCookies() {
  Object.keys(testCookieStore).forEach(key => delete testCookieStore[key]);
}

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => ({
      value: testCookieStore[name]
    })),
    set: vi.fn((name: string, value: string) => {
      testCookieStore[name] = value;
    }),
    delete: vi.fn((name: string) => {
      delete testCookieStore[name];
    }),
    has: vi.fn((name: string) => name in testCookieStore),
  })),
  headers: vi.fn(() => ({
    get: vi.fn(() => null),
    has: vi.fn(() => false),
  })),
}));

// Mock Supabase client - lightweight mock that makes fetch calls for MSW to intercept
const createMockSupabaseClient = () => {
  const SUPABASE_URL = "https://test.supabase.co";
  const REST_API = `${SUPABASE_URL}/rest/v1`;

  let currentTable = "";
  let currentMethod = "GET";
  let currentBody: unknown = null;
  let queryParams: Record<string, string> = {};
  let selectColumns = "*";
  let isSingle = false;

  const mockBuilder = {
    select: vi.fn((columns: string = "*") => {
      selectColumns = columns;
      return mockBuilder;
    }),
    insert: vi.fn((data: unknown) => {
      currentMethod = "POST";
      currentBody = Array.isArray(data) ? data : [data];
      return mockBuilder;
    }),
    update: vi.fn((data: unknown) => {
      currentMethod = "PATCH";
      currentBody = data;
      return mockBuilder;
    }),
    delete: vi.fn(() => {
      currentMethod = "DELETE";
      return mockBuilder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      queryParams[column] = `eq.${value}`;
      return mockBuilder;
    }),
    gt: vi.fn((column: string, value: unknown) => {
      queryParams[column] = `gt.${value}`;
      return mockBuilder;
    }),
    lt: vi.fn((column: string, value: unknown) => {
      queryParams[column] = `lt.${value}`;
      return mockBuilder;
    }),
    order: vi.fn(() => mockBuilder),
    limit: vi.fn(() => mockBuilder),
    single: vi.fn(() => {
      isSingle = true;
      return mockBuilder;
    }),
    maybeSingle: vi.fn(() => {
      isSingle = true;
      return mockBuilder;
    }),
    then: vi.fn(async (resolve) => {
      const url = new URL(`${REST_API}/${currentTable}`);
      Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));

      const options: RequestInit = {
        method: currentMethod,
        headers: {
          "Content-Type": "application/json",
          "apikey": "test-key",
          "Authorization": "Bearer test-key",
          ...(currentMethod === "POST" && selectColumns ? {"Prefer": "return=representation"} : {}),
        },
        ...(currentBody ? {body: JSON.stringify(currentBody)} : {}),
      };

      const response = await fetch(url.toString(), options);
      const data = await response.json();

      if (isSingle) {
        return resolve({ data: Array.isArray(data) && data.length > 0 ? data[0] : null, error: null });
      }
      return resolve({ data, error: null });
    }),
  };

  return {
    from: vi.fn((table: string) => {
      currentTable = table;
      currentMethod = "GET";
      currentBody = null;
      queryParams = {};
      selectColumns = "*";
      isSingle = false;
      return mockBuilder;
    }),
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    },
  };
};

vi.mock("@/lib/data/capture-client", () => ({
  getCaptureClient: vi.fn(() => Promise.resolve(createMockSupabaseClient())),
  currentOrigin: vi.fn(() => Promise.resolve("demo")),
  withOrigin: vi.fn((client) => client),
  CAPTURE_TABLES: [
    "bfi_loan_assignments",
    "bfi_taxonomy_assessments",
    "bfi_esdd_responses",
  ],
}));

// Mock demo mode to return true (officer roster is only populated in demo mode)
vi.mock("@/lib/demo/mode", () => ({
  isDemoMode: vi.fn(() => Promise.resolve(true)),
  DEMO_MODE_COOKIE: "jana_demo_mode",
}));
