/**
 * MSW (Mock Service Worker) handlers for mocking Supabase requests in route tests.
 *
 * Per TEST_STRATEGY §4.2, Tier 2 tests mock Supabase via MSW and assert three
 * things for each route:
 *   1. Happy path — valid request → correct shape
 *   2. Auth failure — missing/invalid token → 401/403, no cross-tenant leak
 *   3. Bad input — malformed body → 400, not 500
 *
 * These handlers intercept fetch calls to NEXT_PUBLIC_SUPABASE_URL and return
 * canned responses, so tests don't need a live Supabase instance.
 */

import { http, HttpResponse } from "msw";

// Mock Supabase REST API base URL (must match NEXT_PUBLIC_SUPABASE_URL in tests)
const SUPABASE_URL = "https://test.supabase.co";
const REST_API = `${SUPABASE_URL}/rest/v1`;

/**
 * Default MSW handlers for common Supabase patterns.
 * Tests can override these per-case using `server.use()`.
 */
export const handlers = [
  // Mock officer lookup (used by requireOfficer, officerBelongsToCurrentTenant)
  http.get(`${REST_API}/bfi_officers`, () => {
    return HttpResponse.json([
      {
        id: "officer-123",
        bank_id: "bank-nepal-dev",
        name: "Test Officer",
        role: "analyst",
        created_at: "2024-01-01T00:00:00Z",
      },
    ]);
  }),

  // Mock loan assignments (used by assertOwnerOrRespond)
  http.get(`${REST_API}/bfi_loan_assignments`, () => {
    return HttpResponse.json([
      {
        loan_id: "loan-456",
        officer_id: "officer-123",
        bank_id: "bank-nepal-dev",
      },
    ]);
  }),

  // Mock ESDD responses insert
  http.post(`${REST_API}/bfi_esdd_responses`, () => {
    return HttpResponse.json({
      id: "response-789",
      captured_at: "2024-01-15T12:00:00Z",
    });
  }),

  // Mock ESDD responses fetch
  http.get(`${REST_API}/bfi_esdd_responses`, () => {
    return HttpResponse.json([
      {
        id: "response-789",
        loan_id: "loan-456",
        question_id: "annex5.1.1",
        answer: "a",
        remarks: null,
        captured_at: "2024-01-15T12:00:00Z",
      },
    ]);
  }),

  // Mock loan denorm table
  http.get(`${REST_API}/bfi_loans_denorm`, () => {
    return HttpResponse.json([
      {
        loan_id: "loan-456",
        borrower_id: "borrower-101",
        bank_id: "bank-nepal-dev",
        borrower_name: "Test Borrower Ltd",
        nrb_sector: "hydropower",
      },
    ]);
  }),
];

/**
 * Creates a mock Supabase error response.
 * Use in tests to simulate DB errors, constraint violations, etc.
 */
export function supabaseError(message: string, code = "23505") {
  return HttpResponse.json(
    {
      code,
      message,
      details: null,
      hint: null,
    },
    { status: 400 },
  );
}

/**
 * Mock empty result (no rows matched filter).
 */
export function emptyResult() {
  return HttpResponse.json([]);
}
