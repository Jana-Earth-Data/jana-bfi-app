/**
 * UNIT TESTS — PCAF attribution factor + retail proxy + portfolio aggregation.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/pcaf/attribution.ts  — the §4.2 outstanding/EVIC factor +
 *     the two-tier enterprise-value floor.
 *   • lib/regulatory/pcaf/retail.ts       — the illustrative Score-5 retail
 *     revenue proxy.
 *   • lib/regulatory/pcaf/aggregation.ts  — `summarise()`, the single roll-up
 *     both providers call (demo synthesizer + live overlay).
 *
 * WHY
 * ---
 * `summarise()` is the function that produces every headline number on the
 * dashboard. Its defensive `?? 0` / `?? null` fallbacks (a loan whose borrower
 * is missing, an attribution whose loan is missing, a facility year absent from
 * its series) are exactly the branches a golden snapshot on the *healthy* 80K
 * book never exercises — so P1.5 constructs deliberately-degenerate mini
 * portfolios to drive each one. The attribution floor + retail proxy are pinned
 * to their exact arithmetic so a silent constant edit fails loudly.
 */
import { describe, expect, it } from "vitest";
import {
  PCAF_ATTRIBUTION_CITATION,
  PCAF_EV_FLOOR_FACILITY_USD,
  PCAF_EV_FLOOR_NON_FACILITY_USD,
  flooredEnterpriseValueUsd,
  pcafAttributionFactor,
} from "@/lib/regulatory/pcaf/attribution";
import {
  RETAIL_PROXY_CITATION,
  RETAIL_TCO2E_PER_NPR,
  retailProxyEmissionsTonnes,
} from "@/lib/regulatory/pcaf/retail";
import { summarise } from "@/lib/regulatory/pcaf/aggregation";
import type {
  Borrower,
  Loan,
  MatchedFacility,
  PcafAttribution,
} from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Fixtures — minimal, only the fields the functions read.
// ---------------------------------------------------------------------------

function makeFacility(overrides: Partial<MatchedFacility> = {}): MatchedFacility {
  return {
    assetId: "ct-1",
    facilityName: "Test Facility",
    sector: "manufacturing",
    lat: 27.7,
    lng: 85.3,
    annualCo2eTonnes: 100_000,
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

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l-1",
    borrowerId: "b-1",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 1_000_000,
    outstandingUsd: 7_500,
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "active",
    nrbTaxonomy: "unclassified",
    purpose: "Working capital",
    ...overrides,
  };
}

function makeAttribution(overrides: Partial<PcafAttribution> = {}): PcafAttribution {
  return {
    loanId: "l-1",
    borrowerId: "b-1",
    attributionFactor: 0.001,
    attributedCo2eTonnes: 100,
    dataQualityScore: 3,
    qualityNote: "test",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// attribution.ts
// ---------------------------------------------------------------------------

describe("flooredEnterpriseValueUsd", () => {
  it("uses the FACILITY floor when the borrower has ≥1 facility", () => {
    const b = makeBorrower({ facilities: [makeFacility()], enterpriseValueUsd: 1 });
    expect(flooredEnterpriseValueUsd(b)).toBe(PCAF_EV_FLOOR_FACILITY_USD);
  });

  it("uses the NON-FACILITY floor when the borrower has no facilities", () => {
    const b = makeBorrower({ facilities: [], enterpriseValueUsd: 1 });
    expect(flooredEnterpriseValueUsd(b)).toBe(PCAF_EV_FLOOR_NON_FACILITY_USD);
  });

  it("never lowers a legitimately larger observed EV", () => {
    const b = makeBorrower({ facilities: [], enterpriseValueUsd: 5_000_000 });
    expect(flooredEnterpriseValueUsd(b)).toBe(5_000_000);
  });
});

describe("pcafAttributionFactor", () => {
  it("is outstanding / floored EV", () => {
    const b = makeBorrower({ facilities: [], enterpriseValueUsd: 1_000_000 });
    expect(pcafAttributionFactor(10_000, b)).toBeCloseTo(0.01, 12);
  });

  it("cannot exceed 1.0 even for a degenerate near-zero EV (floor binds)", () => {
    const b = makeBorrower({ facilities: [], enterpriseValueUsd: 0 });
    // outstanding 10k / floor 50k = 0.2, not a >1 nonsense share.
    expect(pcafAttributionFactor(10_000, b)).toBeCloseTo(0.2, 12);
  });

  it("exposes a citation string", () => {
    expect(PCAF_ATTRIBUTION_CITATION).toContain("§4.2");
  });
});

// ---------------------------------------------------------------------------
// retail.ts
// ---------------------------------------------------------------------------

describe("retailProxyEmissionsTonnes", () => {
  it("is outstandingNpr × the illustrative intensity", () => {
    expect(retailProxyEmissionsTonnes(1_000_000)).toBeCloseTo(1_000_000 * RETAIL_TCO2E_PER_NPR, 12);
  });

  it("is zero for a zero balance", () => {
    expect(retailProxyEmissionsTonnes(0)).toBe(0);
  });

  it("carries the illustrative-provenance citation", () => {
    expect(RETAIL_PROXY_CITATION).toMatch(/illustrative/i);
  });
});

// ---------------------------------------------------------------------------
// aggregation.ts — summarise(). Degenerate fixtures drive the fallbacks.
// ---------------------------------------------------------------------------

describe("summarise — happy path", () => {
  it("rolls up totals, weighted DQ, taxonomy, sector and funnel", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement", dataTier: "facility", facilities: [makeFacility()] });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", nrbTaxonomy: "amber" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", attributedCo2eTonnes: 200, dataQualityScore: 2 })];
    const s = summarise(loans, [borrower], attributions);

    expect(s.totalLoans).toBe(1);
    expect(s.totalAttributedCo2eTonnes).toBe(200);
    expect(s.weightedDataQuality).toBe(2);
    expect(s.taxonomyBreakdown.amber).toBe(1);
    expect(s.sectorBreakdown[0]).toMatchObject({ sector: "Manufacturing - Cement", loanCount: 1 });
    expect(s.funnel?.facilityMatchedLoans).toBe(1);
  });

  it("weightedDataQuality is 0 when no attribution has positive emissions", () => {
    const borrower = makeBorrower();
    const loans = [makeLoan()];
    const attributions = [makeAttribution({ attributedCo2eTonnes: 0 })];
    expect(summarise(loans, [borrower], attributions).weightedDataQuality).toBe(0);
  });
});

describe("summarise — defensive fallbacks", () => {
  it("skips a loan whose borrower is missing (sector + trend `!b` guards)", () => {
    const loans = [makeLoan({ id: "l-1", borrowerId: "ghost" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "ghost" })];
    // No borrowers at all → the loan is skipped in sector + trend loops.
    const s = summarise(loans, [], attributions);
    expect(s.sectorBreakdown).toEqual([]);
    // Trend still returns one point per TREND_YEAR, all zero.
    expect(s.trend?.every((p) => p.totalAttributedCo2eTonnes === 0)).toBe(true);
  });

  it("uses `?? 0` when a non-retail loan has no attribution (sector co2e)", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "corporate", nrbSector: "Manufacturing - Cement" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    // Empty attributions → attrByLoan.get(l-1) is undefined → a?.… ?? 0.
    const s = summarise(loans, [borrower], []);
    expect(s.sectorBreakdown[0]).toMatchObject({ sector: "Manufacturing - Cement", attributedCo2e: 0, loanCount: 1 });
  });

  it("merges two loans in the same sector (sectorMap.get hit branch)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingNpr: 1000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingNpr: 2000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", attributedCo2eTonnes: 10 }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", attributedCo2eTonnes: 20 }),
    ];
    const s = summarise(loans, [borrower], attributions);
    expect(s.sectorBreakdown[0]).toMatchObject({ loanCount: 2, outstandingNpr: 3000, attributedCo2e: 30 });
  });

  it("uses `?? 0` when a data-quality bucket's loan is missing", () => {
    // Attribution references a loan id that isn't in the loan book → loanById
    // miss → outstandingUsd/Npr fall back to 0, but the bucket still counts.
    const borrower = makeBorrower({ id: "b-1" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", dataQualityScore: 3 }),
      makeAttribution({ loanId: "phantom", borrowerId: "b-1", dataQualityScore: 3, attributedCo2eTonnes: 5 }),
    ];
    const s = summarise(loans, [borrower], attributions);
    const score3 = s.dataQualityDistribution?.find((d) => d.score === 3);
    expect(score3?.loanCount).toBe(2);
  });

  it("leaves empty buckets for scores no attribution used", () => {
    const borrower = makeBorrower({ id: "b-1" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", dataQualityScore: 1 })];
    const s = summarise(loans, [borrower], attributions);
    const score5 = s.dataQualityDistribution?.find((d) => d.score === 5);
    expect(score5).toMatchObject({ loanCount: 0, attributedCo2eTonnes: 0 });
  });

  it("skips a trend loan whose attribution is missing (`!a` guard)", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "corporate" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    // borrower present but no attribution → attrByLoan.get miss → continue.
    const s = summarise(loans, [borrower], []);
    expect(s.trend?.every((p) => p.totalAttributedCo2eTonnes === 0)).toBe(true);
  });

  it("retail-pool borrower contributes a flat trend figure", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "retail-pool", nrbSector: "Retail" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", category: "retail-mortgage", nrbTaxonomy: "unclassified" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", attributedCo2eTonnes: 42 })];
    const s = summarise(loans, [borrower], attributions);
    // Retail-pool is excluded from sector breakdown but flat across trend years.
    expect(s.sectorBreakdown).toEqual([]);
    expect(s.trend?.every((p) => p.totalAttributedCo2eTonnes === 42)).toBe(true);
  });

  it("facility trend uses per-year series where present, flat annual where absent", () => {
    const facility = makeFacility({
      annualCo2eTonnes: 100,
      emissionsByYear: [{ year: 2024, co2eTonnes: 500 }], // only one year populated
    });
    const borrower = makeBorrower({ id: "b-1", kind: "corporate", dataTier: "facility", facilities: [facility] });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", attributionFactor: 1 })];
    const s = summarise(loans, [borrower], attributions);
    const y2024 = s.trend?.find((p) => p.year === 2024);
    const other = s.trend?.find((p) => p.year !== 2024);
    // 2024 uses the series value (500 × factor 1); any other year falls back to
    // the flat annual figure (100 × factor 1).
    expect(y2024?.totalAttributedCo2eTonnes).toBe(500);
    expect(other?.totalAttributedCo2eTonnes).toBe(100);
  });

  it("sector-benchmark borrower (no facilities) uses the flat attributed figure in trend", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "corporate", dataTier: "sector-benchmark", facilities: [] });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", attributedCo2eTonnes: 77 })];
    const s = summarise(loans, [borrower], attributions);
    expect(s.trend?.every((p) => p.totalAttributedCo2eTonnes === 77)).toBe(true);
  });

  it("treats a loan with undefined category as in-scope (`?? ''` funnel branch)", () => {
    const borrower = makeBorrower({ id: "b-1" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", category: undefined })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1" })];
    const s = summarise(loans, [borrower], attributions);
    // "".startsWith("retail-") is false → the loan counts as in-scope.
    expect(s.funnel?.inScopeLoans).toBe(1);
  });
});
