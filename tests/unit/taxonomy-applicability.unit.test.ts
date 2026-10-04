/**
 * UNIT TESTS — Taxonomy applicability + ESRM-before-Taxonomy gate.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/taxonomy/applicability.ts — sector → activity suggestion,
 *     the hint table, and the isTaxonomyExpected / label helpers.
 *   • lib/regulatory/taxonomy/gate.ts          — NRB Green Finance Taxonomy
 *     2024 §3.2.2 "ESRM first, then taxonomy" gate (async, Supabase-backed).
 *
 * WHY
 * ---
 * applicability.ts decides whether a loan even gets a Taxonomy tab, so a wrong
 * hint silently hides (or wrongly shows) the classification wizard. gate.ts
 * encodes a hard regulatory ordering rule — the taxonomy MUST NOT be reachable
 * before ESRM Steps 1–2 are on file. P1.5 pins every branch of both, including
 * the three gate verdicts (no-supabase / no-screening / allowed) and the
 * risk-class `?? null` normalisation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isTaxonomyExpected,
  suggestActivitiesForSector,
  taxonomyApplicabilityLabel,
} from "@/lib/regulatory/taxonomy/applicability";

// ---------------------------------------------------------------------------
// applicability.ts — pure sector logic (no mocking needed).
// ---------------------------------------------------------------------------

describe("suggestActivitiesForSector", () => {
  it("resolves a hydro sector via the hint table", () => {
    const acts = suggestActivitiesForSector("Energy - Hydropower");
    expect(acts.some((a) => a.id === "hydro")).toBe(true);
  });

  it("resolves cement/brick/clinker to the transitional cement activity", () => {
    expect(suggestActivitiesForSector("Manufacturing - Cement").some((a) => a.id === "cement-whr")).toBe(true);
    expect(suggestActivitiesForSector("Manufacturing - Brick").some((a) => a.id === "cement-whr")).toBe(true);
  });

  it("resolves a retail/consumption sector to the two consumer activities", () => {
    const acts = suggestActivitiesForSector("Retail");
    const ids = acts.map((a) => a.id);
    expect(ids).toContain("ev-consumer");
    expect(ids).toContain("personal-home-loan");
  });

  it("de-duplicates when pattern + hint point at the same activity", () => {
    const acts = suggestActivitiesForSector("Manufacturing - Textiles");
    const textileHits = acts.filter((a) => a.id === "textile-garments");
    expect(textileHits).toHaveLength(1);
  });

  it("returns an empty list for a sector with no pattern and no hint", () => {
    expect(suggestActivitiesForSector("Nonexistent Made-Up Sector XYZ")).toEqual([]);
  });

  // INVARIANT backing the `TAXONOMY_ACTIVITIES.find(...)!` non-null assertion in
  // activitiesFromHints (P1.5 dead-branch removal): every SECTOR_HINTS activityId
  // must resolve to a real activity, so the former `a && …` null-guard was
  // unreachable. We assert it here through the public API — each hint-driven
  // sector must resolve to at least one *defined* activity. A future mistyped
  // hint id would make `find` return undefined, the `!` would push it, and the
  // `every(...defined)` check below would fail loudly instead of silently
  // dropping the activity.
  it("every SECTOR_HINTS activityId resolves to a real activity", () => {
    // One representative sector string per hint regex in the table.
    const hintSectors = [
      "Manufacturing - Cement",
      "Manufacturing - Steel",
      "Manufacturing - Textiles",
      "Manufacturing - FMCG",
      "Agriculture - Processing",
      "Energy - Hydro",
      "Energy - Solar",
      "Energy - Wind",
      "Utilities - Waste",
      "Hospitality - Tourism",
      "Transport & Storage",
      "Real Estate",
      "Construction",
      "Retail",
      "Finance",
    ];
    for (const sector of hintSectors) {
      const acts = suggestActivitiesForSector(sector);
      expect(acts.length).toBeGreaterThan(0);
      expect(acts.every((a) => a !== undefined && typeof a.id === "string")).toBe(true);
    }
  });

  it("collapses the retail hint's two ids without duplication (merge dedup)", () => {
    // Retail matches both the pattern matcher and the two-id hint; the merged
    // result must contain each consumer activity exactly once.
    const ids = suggestActivitiesForSector("Retail").map((a) => a.id);
    const counts = ids.reduce<Record<string, number>>((acc, id) => {
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});
    expect(Math.max(...Object.values(counts))).toBe(1);
  });
});

describe("isTaxonomyExpected", () => {
  it("is false for null / undefined / empty sector", () => {
    expect(isTaxonomyExpected(null)).toBe(false);
    expect(isTaxonomyExpected(undefined)).toBe(false);
    expect(isTaxonomyExpected("")).toBe(false);
  });

  it("is true for a sector that maps to at least one activity", () => {
    expect(isTaxonomyExpected("Energy - Hydropower")).toBe(true);
  });

  it("is false for a sector that maps to nothing", () => {
    expect(isTaxonomyExpected("Nonexistent Made-Up Sector XYZ")).toBe(false);
  });
});

describe("taxonomyApplicabilityLabel", () => {
  it("returns the applicable copy for an eligible sector", () => {
    expect(taxonomyApplicabilityLabel("Energy - Hydropower")).toBe("Taxonomy applicable");
  });

  it("returns the not-eligible copy for an ineligible / empty sector", () => {
    expect(taxonomyApplicabilityLabel("Nonexistent Made-Up Sector XYZ")).toBe("Not taxonomy-eligible");
    expect(taxonomyApplicabilityLabel(null)).toBe("Not taxonomy-eligible");
  });
});

// ---------------------------------------------------------------------------
// gate.ts — async ESRM gate. Mock the capture client.
// ---------------------------------------------------------------------------

const getCaptureClient = vi.fn();
vi.mock("@/lib/data/capture-client", () => ({
  getCaptureClient: () => getCaptureClient(),
}));

/**
 * Build a Supabase query-builder stub whose terminal `.limit()` resolves to
 * the given `{ data, error }`. The gate chains
 * .from().select().eq().eq().order().limit(), so every intermediate returns
 * `this` and only `.limit()` returns the promise.
 */
function makeSupabaseStub(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.limit = vi.fn(() => Promise.resolve(result));
  return builder;
}

describe("checkEsrmBeforeTaxonomyGate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns no-supabase when the capture client is unavailable", async () => {
    getCaptureClient.mockResolvedValue(null);
    const { checkEsrmBeforeTaxonomyGate } = await import("@/lib/regulatory/taxonomy/gate");
    const verdict = await checkEsrmBeforeTaxonomyGate("bank-1", "loan-1");
    expect(verdict).toEqual({ allowed: false, reason: "no-supabase" });
  });

  it("returns no-screening on a query error", async () => {
    getCaptureClient.mockResolvedValue(makeSupabaseStub({ data: null, error: { message: "boom" } }));
    const { checkEsrmBeforeTaxonomyGate } = await import("@/lib/regulatory/taxonomy/gate");
    const verdict = await checkEsrmBeforeTaxonomyGate("bank-1", "loan-1");
    expect(verdict).toEqual({ allowed: false, reason: "no-screening" });
  });

  it("returns no-screening when no rows exist", async () => {
    getCaptureClient.mockResolvedValue(makeSupabaseStub({ data: [], error: null }));
    const { checkEsrmBeforeTaxonomyGate } = await import("@/lib/regulatory/taxonomy/gate");
    const verdict = await checkEsrmBeforeTaxonomyGate("bank-1", "loan-1");
    expect(verdict).toEqual({ allowed: false, reason: "no-screening" });
  });

  it("returns allowed with capturedAt + riskClass when a screening exists", async () => {
    getCaptureClient.mockResolvedValue(
      makeSupabaseStub({
        data: [{ captured_at: "2025-01-02T03:04:05Z", computed_risk_class: "high" }],
        error: null,
      }),
    );
    const { checkEsrmBeforeTaxonomyGate } = await import("@/lib/regulatory/taxonomy/gate");
    const verdict = await checkEsrmBeforeTaxonomyGate("bank-1", "loan-1");
    expect(verdict).toEqual({
      allowed: true,
      capturedAt: "2025-01-02T03:04:05Z",
      riskClass: "high",
    });
  });

  it("normalises a missing computed_risk_class to null (?? null branch)", async () => {
    getCaptureClient.mockResolvedValue(
      makeSupabaseStub({
        data: [{ captured_at: "2025-01-02T03:04:05Z", computed_risk_class: null }],
        error: null,
      }),
    );
    const { checkEsrmBeforeTaxonomyGate } = await import("@/lib/regulatory/taxonomy/gate");
    const verdict = await checkEsrmBeforeTaxonomyGate("bank-1", "loan-1");
    expect(verdict).toMatchObject({ allowed: true, riskClass: null });
  });
});
