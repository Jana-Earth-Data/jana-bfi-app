/**
 * UNIT TESTS — climate risk + emissions-flag inference.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/climate/infer.ts  — the deterministic NGFS sector profile
 *     lookup, the count-based rating rollup, the 25k tCO2e threshold flag with
 *     its INJECTED reduction-target seam (N0.3), and the §4.4 portfolio rollup.
 *   • lib/regulatory/climate/types.ts  — the NGFS category const arrays + the
 *     25,000 tCO2e threshold constant (imported so their lines are executed).
 *
 * WHY
 * ---
 * These are the functions behind the ESRM climate panel and the NRB §4.4
 * portfolio report. Every branch matters for the 100% gate: the sector table's
 * default fallback (a borrower whose sector matches nothing), the four rollup
 * verdicts, the exceeds/below-threshold split, and — critically for N0.3 — the
 * seam that keeps a reduction target from being *fabricated* in lib/regulatory
 * (absent a seed the flag is false/null). The threshold arithmetic is pinned so
 * a silent constant edit fails loudly.
 */
import { describe, expect, it } from "vitest";
import {
  estimateAnnualTco2e,
  getBorrowerClimateBundle,
  inferClimateRisk,
  inferEmissionsFlag,
  rollupRating,
  summarisePortfolioClimate,
  type ReductionTargetSeedFn,
} from "@/lib/regulatory/climate/infer";
import {
  ALL_NGFS_PHYSICAL,
  ALL_NGFS_TRANSITION,
  NGFS_ACUTE_PHYSICAL,
  NGFS_CHRONIC_PHYSICAL,
  NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E,
} from "@/lib/regulatory/climate/types";
import type { Borrower, MatchedFacility } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Fixtures — minimal, only the fields the inference reads.
// ---------------------------------------------------------------------------

function makeFacility(overrides: Partial<MatchedFacility> = {}): MatchedFacility {
  return {
    assetId: "ct-1",
    facilityName: "Test Facility",
    sector: "manufacturing",
    lat: 27.7,
    lng: 85.3,
    annualCo2eTonnes: 30_000,
    emissionsYear: 2024,
    matchMethod: "manual",
    matchConfidence: 1,
    ...overrides,
  };
}

function makeBorrower(overrides: Partial<Borrower> = {}): Borrower {
  return {
    id: "b-1",
    name: "Test Borrower Pvt. Ltd.",
    kind: "corporate",
    nrbSector: "Manufacturing - Cement",
    enterpriseValueUsd: 10_000_000,
    evSource: "estimated",
    dataTier: "sector-benchmark",
    publiclyListed: false,
    facilities: [],
    totalCo2eTonnes: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// types.ts — const arrays + threshold (executed by importing + asserting).
// ---------------------------------------------------------------------------

describe("climate/types const surfaces", () => {
  it("assembles ALL_NGFS_PHYSICAL from acute + chronic", () => {
    expect(ALL_NGFS_PHYSICAL).toEqual([
      ...NGFS_ACUTE_PHYSICAL,
      ...NGFS_CHRONIC_PHYSICAL,
    ]);
    expect(ALL_NGFS_PHYSICAL).toContain("Floods");
    expect(ALL_NGFS_PHYSICAL).toContain("Water scarcity");
  });

  it("pins the four NGFS transition channels", () => {
    expect(ALL_NGFS_TRANSITION).toEqual([
      "Policy risk",
      "Technology risk",
      "Market risk",
      "Reputation risk",
    ]);
  });

  it("pins the NRB §4.3 reporting threshold at 25,000 tCO2e", () => {
    expect(NRB_ESRM_GHG_REPORTING_THRESHOLD_TCO2E).toBe(25_000);
  });
});

// ---------------------------------------------------------------------------
// estimateAnnualTco2e — facility sum → totalCo2e fallback → null.
// ---------------------------------------------------------------------------

describe("estimateAnnualTco2e", () => {
  it("prefers the facility-total sum (rounded) when facilities have emissions", () => {
    const b = makeBorrower({
      facilities: [
        makeFacility({ annualCo2eTonnes: 10_000.4 }),
        makeFacility({ assetId: "ct-2", annualCo2eTonnes: 5_000.4 }),
      ],
      totalCo2eTonnes: 999,
    });
    expect(estimateAnnualTco2e(b)).toBe(15_001);
  });

  it("ignores non-finite facility values in the sum", () => {
    const b = makeBorrower({
      facilities: [
        makeFacility({ annualCo2eTonnes: Number.NaN }),
        makeFacility({ assetId: "ct-2", annualCo2eTonnes: 8_000 }),
      ],
    });
    expect(estimateAnnualTco2e(b)).toBe(8_000);
  });

  it("falls back to borrower.totalCo2eTonnes when no facility emissions", () => {
    const b = makeBorrower({ facilities: [], totalCo2eTonnes: 4_200.6 });
    expect(estimateAnnualTco2e(b)).toBe(4_201);
  });

  it("returns null when neither signal is usable", () => {
    expect(estimateAnnualTco2e(makeBorrower({ facilities: [], totalCo2eTonnes: 0 }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// inferEmissionsFlag — threshold + INJECTED reduction-target seam (N0.3).
// ---------------------------------------------------------------------------

describe("inferEmissionsFlag", () => {
  it("does not exceed and carries no target below the threshold", () => {
    const b = makeBorrower({ totalCo2eTonnes: 1_000 });
    const flag = inferEmissionsFlag(b);
    expect(flag).toEqual({
      estimatedAnnualTco2e: 1_000,
      exceedsReportingThreshold: false,
      reductionTargetOnFile: false,
      targetDetails: null,
    });
  });

  it("normalises a null estimate to 0 (?? 0 branch)", () => {
    const flag = inferEmissionsFlag(makeBorrower({ facilities: [], totalCo2eTonnes: 0 }));
    expect(flag.estimatedAnnualTco2e).toBe(0);
    expect(flag.exceedsReportingThreshold).toBe(false);
  });

  it("exceeds exactly at the 25,000 boundary", () => {
    const flag = inferEmissionsFlag(makeBorrower({ totalCo2eTonnes: 25_000 }));
    expect(flag.exceedsReportingThreshold).toBe(true);
  });

  it("above threshold WITHOUT a seed asserts NO target (N0.3 live default)", () => {
    const flag = inferEmissionsFlag(makeBorrower({ totalCo2eTonnes: 40_000 }));
    expect(flag.exceedsReportingThreshold).toBe(true);
    expect(flag.reductionTargetOnFile).toBe(false);
    expect(flag.targetDetails).toBeNull();
  });

  it("above threshold WITH a seed injects the seeded target", () => {
    const seed: ReductionTargetSeedFn = (id) => ({
      onFile: true,
      details: `target for ${id}`,
    });
    const flag = inferEmissionsFlag(makeBorrower({ id: "b-9", totalCo2eTonnes: 40_000 }), seed);
    expect(flag.reductionTargetOnFile).toBe(true);
    expect(flag.targetDetails).toBe("target for b-9");
  });

  it("below threshold ignores the seed entirely (target only meaningful above)", () => {
    const seed: ReductionTargetSeedFn = () => ({ onFile: true, details: "x" });
    const flag = inferEmissionsFlag(makeBorrower({ totalCo2eTonnes: 100 }), seed);
    expect(flag.reductionTargetOnFile).toBe(false);
    expect(flag.targetDetails).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// inferClimateRisk — sector profile lookup + rollupRating verdicts.
// ---------------------------------------------------------------------------

describe("inferClimateRisk — sector profile + rating", () => {
  it("maps a hydropower sector to its profile and is deterministic", () => {
    const b = makeBorrower({ id: "hp-1", nrbSector: "Energy - Hydropower", totalCo2eTonnes: 0 });
    const r1 = inferClimateRisk(b);
    const r2 = inferClimateRisk(b);
    expect(r1.physicalRisks).toContain("Floods");
    expect(r1.transitionRisks).toContain("Policy risk");
    // Deterministic assessed-at — same borrower id → same timestamp.
    expect(r1.assessedAt.getTime()).toBe(r2.assessedAt.getTime());
    expect(r1.assessedBy).toContain("NRB ESRM 2022");
  });

  it("falls back to the DEFAULT_PROFILE for an unmatched sector", () => {
    const b = makeBorrower({ nrbSector: "Totally Unmapped Sector ZZZ", totalCo2eTonnes: 0 });
    const r = inferClimateRisk(b);
    expect(r.physicalRisks).toEqual(["Floods", "Temperature change"]);
    expect(r.transitionRisks).toEqual(["Policy risk"]);
  });

  it("treats a null nrbSector as empty → DEFAULT_PROFILE", () => {
    const b = makeBorrower({ nrbSector: null as unknown as string, totalCo2eTonnes: 0 });
    const r = inferClimateRisk(b);
    expect(r.physicalRisks).toEqual(["Floods", "Temperature change"]);
  });

  it("rating = high when emissions exceed the threshold (aboveThreshold branch)", () => {
    // Retail sector → 1 physical, 1 transition (would be 'medium'), but the
    // above-threshold emissions force 'high'.
    const b = makeBorrower({ nrbSector: "Wholesale & Retail", totalCo2eTonnes: 50_000 });
    expect(inferClimateRisk(b).overallRating).toBe("high");
  });

  it("rating = high on >=4 physical categories (agriculture) below threshold", () => {
    const b = makeBorrower({ nrbSector: "Agriculture & Agro", totalCo2eTonnes: 0 });
    // Agriculture profile has 4 physical categories.
    expect(inferClimateRisk(b).overallRating).toBe("high");
  });

  it("rating = high on >=3 physical + >=1 transition (cement) below threshold", () => {
    const b = makeBorrower({ nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 0 });
    // Cement: 3 physical + 3 transition.
    expect(inferClimateRisk(b).overallRating).toBe("high");
  });

  it("rating = medium on 2 physical / 1 transition (steel) below threshold", () => {
    const b = makeBorrower({ nrbSector: "Manufacturing - Steel", totalCo2eTonnes: 0 });
    // Steel: 2 physical + 2 transition → medium (not >=3 physical).
    expect(inferClimateRisk(b).overallRating).toBe("medium");
  });

  it("rating = medium on a single physical + a transition (retail)", () => {
    const b = makeBorrower({ nrbSector: "Wholesale & Retail", totalCo2eTonnes: 0 });
    // Retail: 1 physical + 1 transition → transitionCount>=1 → medium.
    expect(inferClimateRisk(b).overallRating).toBe("medium");
  });
});

// ---------------------------------------------------------------------------
// rollupRating — the documented count-based Low/Medium/High policy tested in
// isolation. inferClimateRisk only exercises the High/Medium arms (every
// SECTOR_PROFILE carries >=1 transition risk), so the `low` verdict — zero
// transition AND <2 physical — is only reachable by calling the exported policy
// directly. Pinning it here keeps the full NRB ESRM §4.1 table under the P1.5
// gate and documents the exact boundary the compliance team would adjust.
// ---------------------------------------------------------------------------

describe("rollupRating (NRB ESRM §4.1 policy)", () => {
  it("returns high whenever emissions are above threshold, regardless of counts", () => {
    expect(rollupRating(0, 0, true)).toBe("high");
    expect(rollupRating(1, 0, true)).toBe("high");
  });

  it("returns high on >=4 physical, or >=3 physical + a transition", () => {
    expect(rollupRating(4, 0, false)).toBe("high");
    expect(rollupRating(3, 1, false)).toBe("high");
  });

  it("returns medium on >=3 physical but no transition (not the >=3&&>=1 arm)", () => {
    // physicalCount 3, transitionCount 0 → falls through the high test to the
    // physicalCount>=2 medium arm.
    expect(rollupRating(3, 0, false)).toBe("medium");
  });

  it("returns medium on >=2 physical, or any transition", () => {
    expect(rollupRating(2, 0, false)).toBe("medium");
    expect(rollupRating(0, 1, false)).toBe("medium");
  });

  it("returns low on <2 physical AND zero transition (the profile-unreachable arm)", () => {
    expect(rollupRating(0, 0, false)).toBe("low");
    expect(rollupRating(1, 0, false)).toBe("low");
  });
});

// ---------------------------------------------------------------------------
// getBorrowerClimateBundle — threads the seed into the emissions flag.
// ---------------------------------------------------------------------------

describe("getBorrowerClimateBundle", () => {
  it("bundles borrowerId + climateRisk + emissionsFlag", () => {
    const b = makeBorrower({ id: "b-42", totalCo2eTonnes: 0 });
    const bundle = getBorrowerClimateBundle(b);
    expect(bundle.borrowerId).toBe("b-42");
    expect(bundle.climateRisk).toBeTruthy();
    expect(bundle.emissionsFlag).toBeTruthy();
  });

  it("passes the seed through to the emissions flag", () => {
    const seed: ReductionTargetSeedFn = () => ({ onFile: true, details: "seeded" });
    const b = makeBorrower({ id: "b-42", totalCo2eTonnes: 40_000 });
    expect(getBorrowerClimateBundle(b, seed).emissionsFlag.reductionTargetOnFile).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// summarisePortfolioClimate — §4.4 rollup + retail-pool / no-sector filters.
// ---------------------------------------------------------------------------

describe("summarisePortfolioClimate", () => {
  it("excludes retail-pool and sector-less borrowers from the assessed set", () => {
    const borrowers = [
      makeBorrower({ id: "corp", nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 0 }),
      makeBorrower({ id: "pool", kind: "retail-pool", totalCo2eTonnes: 0 }),
      makeBorrower({ id: "nosector", nrbSector: "" }),
    ];
    const s = summarisePortfolioClimate(borrowers);
    expect(s.borrowersAssessed).toBe(1);
  });

  it("counts physical + transition presence across the scoped set", () => {
    const borrowers = [
      makeBorrower({ id: "a", nrbSector: "Energy - Hydropower", totalCo2eTonnes: 0 }),
      makeBorrower({ id: "b", nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 0 }),
    ];
    const s = summarisePortfolioClimate(borrowers);
    expect(s.borrowersWithPhysicalRisk).toBe(2);
    expect(s.borrowersWithTransitionRisk).toBe(2);
  });

  // INVARIANT backing summarisePortfolioClimate's unconditional physical /
  // transition counters (P1.5 dead-branch removal): every SECTOR_PROFILE and the
  // DEFAULT_PROFILE fallback declare >=1 physical AND >=1 transition category, so
  // every scoped borrower always contributes to both counters — the old
  // `length > 0 ?` guards had unreachable false arms. We assert the invariant via
  // inferClimateRisk across a matched sector, an unmatched sector (default
  // profile), and a null sector; if a future profile drops a category this test
  // fails loudly instead of the summary silently undercounting.
  it("every borrower's climate profile carries >=1 physical and >=1 transition risk", () => {
    const sectors: string[] = [
      "Energy - Hydropower", // matched profile
      "Manufacturing - Cement",
      "Agriculture - Farming",
      "Totally Unmatched Sector", // → DEFAULT_PROFILE
      // null sector → DEFAULT_PROFILE (cast to satisfy the string field, mirroring
      // the "treats a null nrbSector as empty" case above).
      null as unknown as string,
    ];
    for (const nrbSector of sectors) {
      const risk = inferClimateRisk(makeBorrower({ nrbSector, totalCo2eTonnes: 0 }));
      expect(risk.physicalRisks.length).toBeGreaterThan(0);
      expect(risk.transitionRisks.length).toBeGreaterThan(0);
    }
  });

  it("splits above-threshold borrowers into with/without target (no seed → all without)", () => {
    const borrowers = [
      makeBorrower({ id: "hi", nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 40_000 }),
      makeBorrower({ id: "lo", nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 100 }),
    ];
    const s = summarisePortfolioClimate(borrowers);
    expect(s.aboveThresholdCount).toBe(1);
    expect(s.aboveThresholdBorrowerIds).toEqual(["hi"]);
    expect(s.aboveThresholdWithoutTargetCount).toBe(1);
    expect(s.aboveThresholdWithoutTargetBorrowerIds).toEqual(["hi"]);
    expect(s.aboveThresholdWithTargetCount).toBe(0);
  });

  it("moves a seeded above-threshold borrower into the with-target bucket", () => {
    const seed: ReductionTargetSeedFn = (id) =>
      id === "hi" ? { onFile: true, details: "plan" } : { onFile: false, details: null };
    const borrowers = [
      makeBorrower({ id: "hi", nrbSector: "Manufacturing - Cement", totalCo2eTonnes: 40_000 }),
    ];
    const s = summarisePortfolioClimate(borrowers, seed);
    expect(s.aboveThresholdWithTargetCount).toBe(1);
    expect(s.aboveThresholdWithoutTargetCount).toBe(0);
    expect(s.aboveThresholdWithoutTargetBorrowerIds).toEqual([]);
  });
});
