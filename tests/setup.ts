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

// Mock Supabase client - lightweight mock that returns MSW-intercepted fetch results
// We don't need a real Supabase client - just an object that implements the builder pattern
const createMockSupabaseClient = () => {
  const mockBuilder = {
    select: vi.fn(() => mockBuilder),
    insert: vi.fn(() => mockBuilder),
    update: vi.fn(() => mockBuilder),
    delete: vi.fn(() => mockBuilder),
    eq: vi.fn(() => mockBuilder),
    gt: vi.fn(() => mockBuilder),
    lt: vi.fn(() => mockBuilder),
    order: vi.fn(() => mockBuilder),
    limit: vi.fn(() => mockBuilder),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn((resolve) => resolve({ data: [], error: null })),
  };

  return {
    from: vi.fn(() => mockBuilder),
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
