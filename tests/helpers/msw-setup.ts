/**
 * MSW test setup — configures Mock Service Worker for route tests.
 *
 * This file is imported by route test files to set up request interception.
 * MSW intercepts fetch calls (including Supabase client requests) and returns
 * mock responses, so tests don't depend on a live Supabase instance.
 */

import { setupServer } from "msw/node";
import { handlers } from "./msw-handlers";
import { beforeAll, afterEach, afterAll } from "vitest";

// Create MSW server with default handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

// Reset handlers after each test (clears any test-specific overrides)
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});
