/**
 * UNIT TESTS — IFRS S2 B62(b) gross exposure computation.
 * jana-bfi-app · PR1 task N1.1 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/pcaf/gross-exposure.ts — IFRS S2 B62(b) funded carrying
 *     amount before loss allowance, industry × asset-class disaggregation.
 *
 * WHY
 * ---
 * `grossExposureUsd()` is the single source of truth for the B62(b) disclosure
 * formula (outstanding + loss allowance). `computeGrossExposureMatrix()` builds
 * the required industry × asset-class disaggregation. These functions drive the
 * annual NFRS/ISSB climate disclosures and must produce stable, auditable
 * numbers — so this test pins the arithmetic and exercises the edge cases
 * (loans without loss allowance, orphaned loans, empty portfolios).
 */
import { describe, expect, it } from "vitest";
import {
  IFRS_S2_B62_CITATION,
  grossExposureUsd,
  computeGrossExposureMatrix,
} from "@/lib/regulatory/pcaf/gross-exposure";
import type { Borrower, Loan, PcafAttribution } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Fixtures — minimal, only the fields the functions read.
// ---------------------------------------------------------------------------

function makeLoan(overrides: Partial<Loan> = {}): Loan {
  return {
    id: "l-1",
    borrowerId: "b-1",
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: 1_000_000,
    outstandingUsd: 7_500,
    lossAllowance: 150, // 2% provision (typical Nepal BFI)
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "active",
    nrbTaxonomy: "unclassified",
    purpose: "Working capital",
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
    totalCo2eTonnes: 100_000,
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
    pcafAssetClass: "business-loans-unlisted-equity",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// grossExposureUsd()
// ---------------------------------------------------------------------------

describe("grossExposureUsd", () => {
  it("is outstanding USD + loss allowance per IFRS S2 B62(b)", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: 200 });
    expect(grossExposureUsd(loan)).toBe(10_200);
  });

  it("subtracts risk mitigant value per IFRS S2 B62(c)(ii) (N1.3)", () => {
    const loan = makeLoan({
      outstandingUsd: 10_000,
      lossAllowance: 200,
      riskMitigantValueUsd: 3_000,
    });
    // Gross exposure = 10,000 + 200 - 3,000 = 7,200
    expect(grossExposureUsd(loan)).toBe(7_200);
  });

  it("falls back to outstanding USD when lossAllowance is undefined", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: undefined });
    expect(grossExposureUsd(loan)).toBe(10_000);
  });

  it("treats zero lossAllowance as zero, not undefined", () => {
    const loan = makeLoan({ outstandingUsd: 10_000, lossAllowance: 0 });
    expect(grossExposureUsd(loan)).toBe(10_000);
  });

  it("treats undefined riskMitigantValueUsd as zero", () => {
    const loan = makeLoan({
      outstandingUsd: 10_000,
      lossAllowance: 200,
      riskMitigantValueUsd: undefined,
    });
    expect(grossExposureUsd(loan)).toBe(10_200);
  });

  it("treats zero riskMitigantValueUsd as zero, not undefined", () => {
    const loan = makeLoan({
      outstandingUsd: 10_000,
      lossAllowance: 200,
      riskMitigantValueUsd: 0,
    });
    expect(grossExposureUsd(loan)).toBe(10_200);
  });

  it("exposes an IFRS S2 B62(b) citation string", () => {
    expect(IFRS_S2_B62_CITATION).toContain("IFRS S2");
    expect(IFRS_S2_B62_CITATION).toContain("B62(b)");
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — happy path
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — happy path", () => {
  it("aggregates gross exposure by industry × asset class", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: 200 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000, lossAllowance: 100 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 50 }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 30 }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      grossExposureUsd: 10_200 + 5_100, // (10k + 200) + (5k + 100)
      loanCount: 2,
      attributedCo2eTonnes: 80, // 50 + 30
    });
  });

  it("creates separate cells for different industries", () => {
    const borrowers = [
      makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" }),
      makeBorrower({ id: "b-2", nrbSector: "Energy - Hydropower" }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: 200 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 5_000, lossAllowance: 100 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-2", pcafAssetClass: "business-loans-unlisted-equity" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    expect(matrix).toHaveLength(2);
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower")).toBeDefined();
  });

  it("creates separate cells for different asset classes", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(2);
    expect(matrix.find((c) => c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.assetClass === "project-finance")).toBeDefined();
  });

  it("sorts cells by descending gross exposure", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 1_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 10_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    // Largest exposure first
    expect(matrix[0].grossExposureUsd).toBeGreaterThan(matrix[1].grossExposureUsd);
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — edge cases & defensive fallbacks
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — edge cases", () => {
  it("returns empty matrix for empty portfolio", () => {
    const matrix = computeGrossExposureMatrix([], [], []);
    expect(matrix).toEqual([]);
  });

  it("skips loans with no attribution (out-of-scope retail)", () => {
    const borrower = makeBorrower({ id: "b-1", kind: "retail-pool", nrbSector: "Retail" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", category: "retail-mortgage" })];
    // No attribution for this loan → should be skipped
    const matrix = computeGrossExposureMatrix(loans, [borrower], []);
    expect(matrix).toEqual([]);
  });

  it("skips loans with attribution but missing pcafAssetClass", () => {
    const borrower = makeBorrower({ id: "b-1" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: undefined })];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);
    expect(matrix).toEqual([]);
  });

  it("skips orphaned loans (borrower missing from borrowers array)", () => {
    const loans = [makeLoan({ id: "l-1", borrowerId: "ghost" })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "ghost" })];

    const matrix = computeGrossExposureMatrix(loans, [], attributions);
    expect(matrix).toEqual([]);
  });

  it("includes loans with undefined lossAllowance (uses outstandingUsd only)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000, lossAllowance: undefined })];
    const attributions = [makeAttribution({ loanId: "l-1", borrowerId: "b-1" })];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0].grossExposureUsd).toBe(10_000); // No loss allowance to add
  });

  it("accumulates multiple loans in the same cell (Map.get hit branch)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 1_000, lossAllowance: 20 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 2_000, lossAllowance: 40 }),
      makeLoan({ id: "l-3", borrowerId: "b-1", outstandingUsd: 3_000, lossAllowance: 60 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 10 }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 20 }),
      makeAttribution({ loanId: "l-3", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity", attributedCo2eTonnes: 30 }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      grossExposureUsd: (1_000 + 20) + (2_000 + 40) + (3_000 + 60),
      loanCount: 3,
      attributedCo2eTonnes: 60,
    });
  });

  it("handles mixed industries and asset classes (full 2×2 matrix)", () => {
    const borrowers = [
      makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" }),
      makeBorrower({ id: "b-2", nrbSector: "Energy - Hydropower" }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
      makeLoan({ id: "l-3", borrowerId: "b-2", outstandingUsd: 8_000 }),
      makeLoan({ id: "l-4", borrowerId: "b-2", outstandingUsd: 3_000 }),
    ];
    const attributions = [
      makeAttribution({ loanId: "l-1", borrowerId: "b-1", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-2", borrowerId: "b-1", pcafAssetClass: "project-finance" }),
      makeAttribution({ loanId: "l-3", borrowerId: "b-2", pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution({ loanId: "l-4", borrowerId: "b-2", pcafAssetClass: "project-finance" }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    // 2 industries × 2 asset classes = 4 cells
    expect(matrix).toHaveLength(4);
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement" && c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Manufacturing - Cement" && c.assetClass === "project-finance")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower" && c.assetClass === "business-loans-unlisted-equity")).toBeDefined();
    expect(matrix.find((c) => c.industry === "Energy - Hydropower" && c.assetClass === "project-finance")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — Scope 1/2/3 disaggregation (N1.6)
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — Scope 1/2/3 disaggregation (N1.6)", () => {
  it("aggregates scope emissions when all attributions have scope data", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 40,
        attributedScope2Co2eTonnes: 30,
        attributedScope3Co2eTonnes: 30,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 80,
        attributedScope1Co2eTonnes: 32,
        attributedScope2Co2eTonnes: 24,
        attributedScope3Co2eTonnes: 24,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      attributedCo2eTonnes: 180, // 100 + 80
      attributedScope1Co2eTonnes: 72, // 40 + 32
      attributedScope2Co2eTonnes: 54, // 30 + 24
      attributedScope3Co2eTonnes: 54, // 30 + 24
    });
  });

  it("omits scope fields when no attributions have scope data", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    // Attributions without scope fields (typical Climate TRACE data)
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 80,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      attributedCo2eTonnes: 180,
    });
    // Scope fields should be undefined (not present in output)
    expect(matrix[0].attributedScope1Co2eTonnes).toBeUndefined();
    expect(matrix[0].attributedScope2Co2eTonnes).toBeUndefined();
    expect(matrix[0].attributedScope3Co2eTonnes).toBeUndefined();
  });

  it("includes scope fields when at least one attribution has scope data", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 40,
        attributedScope2Co2eTonnes: 30,
        attributedScope3Co2eTonnes: 30,
      }),
      // Second loan has no scope data
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 80,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      attributedCo2eTonnes: 180,
      // Scope fields present, second loan contributes 0 to each scope
      attributedScope1Co2eTonnes: 40, // 40 + 0
      attributedScope2Co2eTonnes: 30, // 30 + 0
      attributedScope3Co2eTonnes: 30, // 30 + 0
    });
  });

  it("handles partial scope data (only Scope 1 available)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Energy - Hydropower" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 50,
        attributedScope1Co2eTonnes: 50, // Only Scope 1 available
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Energy - Hydropower",
      assetClass: "project-finance",
      attributedCo2eTonnes: 50,
      attributedScope1Co2eTonnes: 50,
      attributedScope2Co2eTonnes: 0, // Present but zero
      attributedScope3Co2eTonnes: 0, // Present but zero
    });
  });

  it("handles partial scope data (only Scope 2 available)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Energy - Hydropower" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 30,
        attributedScope2Co2eTonnes: 30, // Only Scope 2 available
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Energy - Hydropower",
      assetClass: "project-finance",
      attributedCo2eTonnes: 30,
      attributedScope1Co2eTonnes: 0,
      attributedScope2Co2eTonnes: 30,
      attributedScope3Co2eTonnes: 0,
    });
  });

  it("handles partial scope data (only Scope 3 available)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 20,
        attributedScope3Co2eTonnes: 20, // Only Scope 3 available
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      attributedCo2eTonnes: 20,
      attributedScope1Co2eTonnes: 0,
      attributedScope2Co2eTonnes: 0,
      attributedScope3Co2eTonnes: 20,
    });
  });

  it("accumulates scope emissions across multiple cells (different industries)", () => {
    const borrowers = [
      makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" }),
      makeBorrower({ id: "b-2", nrbSector: "Energy - Hydropower" }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 60,
        attributedScope2Co2eTonnes: 20,
        attributedScope3Co2eTonnes: 20,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-2",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 80,
        attributedScope1Co2eTonnes: 10,
        attributedScope2Co2eTonnes: 40,
        attributedScope3Co2eTonnes: 30,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    expect(matrix).toHaveLength(2);

    const cementCell = matrix.find((c) => c.industry === "Manufacturing - Cement");
    expect(cementCell).toMatchObject({
      attributedCo2eTonnes: 100,
      attributedScope1Co2eTonnes: 60,
      attributedScope2Co2eTonnes: 20,
      attributedScope3Co2eTonnes: 20,
    });

    const hydropowerCell = matrix.find((c) => c.industry === "Energy - Hydropower");
    expect(hydropowerCell).toMatchObject({
      attributedCo2eTonnes: 80,
      attributedScope1Co2eTonnes: 10,
      attributedScope2Co2eTonnes: 40,
      attributedScope3Co2eTonnes: 30,
    });
  });

  it("verifies scope split sums to total emissions (consistency check)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 150,
        attributedScope1Co2eTonnes: 75,
        attributedScope2Co2eTonnes: 50,
        attributedScope3Co2eTonnes: 25,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    const cell = matrix[0];

    // Total should equal sum of scopes
    expect(cell.attributedCo2eTonnes).toBe(150);
    expect(
      (cell.attributedScope1Co2eTonnes ?? 0) +
      (cell.attributedScope2Co2eTonnes ?? 0) +
      (cell.attributedScope3Co2eTonnes ?? 0)
    ).toBe(150);
  });

  it("handles mixed scope availability across different asset classes in same industry", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      // Business loan has scope data
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 50,
        attributedScope2Co2eTonnes: 30,
        attributedScope3Co2eTonnes: 20,
      }),
      // Project finance has no scope data
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 60,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(2);

    const businessLoanCell = matrix.find((c) => c.assetClass === "business-loans-unlisted-equity");
    expect(businessLoanCell).toMatchObject({
      attributedCo2eTonnes: 100,
      attributedScope1Co2eTonnes: 50,
      attributedScope2Co2eTonnes: 30,
      attributedScope3Co2eTonnes: 20,
    });

    const projectFinanceCell = matrix.find((c) => c.assetClass === "project-finance");
    expect(projectFinanceCell).toMatchObject({
      attributedCo2eTonnes: 60,
    });
    // Project finance cell should NOT have scope fields
    expect(projectFinanceCell?.attributedScope1Co2eTonnes).toBeUndefined();
    expect(projectFinanceCell?.attributedScope2Co2eTonnes).toBeUndefined();
    expect(projectFinanceCell?.attributedScope3Co2eTonnes).toBeUndefined();
  });

  it("handles zero values in scope fields (treated as explicit data, not missing)", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Energy - Hydropower" });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 100, // Only direct emissions
        attributedScope2Co2eTonnes: 0,   // Explicit zero (no purchased energy)
        attributedScope3Co2eTonnes: 0,   // Explicit zero (no supply chain tracked)
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      attributedCo2eTonnes: 100,
      attributedScope1Co2eTonnes: 100,
      attributedScope2Co2eTonnes: 0, // Zero is data, not absence of data
      attributedScope3Co2eTonnes: 0,
    });
  });

  it("accumulates scope emissions when multiple loans contribute to same cell with mixed scope availability", () => {
    const borrower = makeBorrower({ id: "b-1", nrbSector: "Manufacturing - Cement" });
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-1", outstandingUsd: 8_000 }),
      makeLoan({ id: "l-3", borrowerId: "b-1", outstandingUsd: 6_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
        attributedScope1Co2eTonnes: 60,
        attributedScope2Co2eTonnes: 20,
        attributedScope3Co2eTonnes: 20,
      }),
      // Second loan has no scope data
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 80,
      }),
      // Third loan has scope data
      makeAttribution({
        loanId: "l-3",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 50,
        attributedScope1Co2eTonnes: 30,
        attributedScope2Co2eTonnes: 10,
        attributedScope3Co2eTonnes: 10,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      attributedCo2eTonnes: 230, // 100 + 80 + 50
      // Scope fields present because at least one attribution has scope data
      attributedScope1Co2eTonnes: 90, // 60 + 0 + 30
      attributedScope2Co2eTonnes: 30, // 20 + 0 + 10
      attributedScope3Co2eTonnes: 30, // 20 + 0 + 10
    });
  });
});

// ---------------------------------------------------------------------------
// computeGrossExposureMatrix() — GICS 6-digit industry classification (N1.7)
// ---------------------------------------------------------------------------

describe("computeGrossExposureMatrix — GICS 6-digit industry classification (N1.7)", () => {
  it("populates GICS code and label for NRB sectors with mappings", () => {
    const borrower = makeBorrower({
      id: "b-1",
      nrbSector: "Manufacturing - Cement",
      gicsCode: "151020", // Set by demo entities
    });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      gicsCode: "151020",
      gicsLabel: "Materials / Materials / Construction Materials",
      industry: "Manufacturing - Cement",
      assetClass: "business-loans-unlisted-equity",
      grossExposureUsd: 10_150, // 10_000 outstanding + 150 lossAllowance
    });
  });

  it("includes NRB sector even when GICS code is present (backward compatibility)", () => {
    const borrower = makeBorrower({
      id: "b-1",
      nrbSector: "Energy - Hydropower",
      gicsCode: "551010",
    });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 5_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 50,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0].industry).toBe("Energy - Hydropower"); // NRB sector preserved
    expect(matrix[0].gicsCode).toBe("551010"); // GICS code present
    expect(matrix[0].gicsLabel).toBe("Utilities / Utilities / Electric Utilities");
  });

  it("omits GICS fields for NRB sectors without mappings", () => {
    const borrower = makeBorrower({
      id: "b-1",
      nrbSector: "Unknown Sector", // No GICS mapping
    });
    const loans = [makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 3_000 })];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 30,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, [borrower], attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0].industry).toBe("Unknown Sector");
    expect(matrix[0].gicsCode).toBeUndefined();
    expect(matrix[0].gicsLabel).toBeUndefined();
  });

  it("aggregates multiple loans from same GICS industry", () => {
    const borrowers = [
      makeBorrower({
        id: "b-1",
        nrbSector: "Manufacturing - Cement",
        gicsCode: "151020",
      }),
      makeBorrower({
        id: "b-2",
        nrbSector: "Manufacturing - Brick",
        gicsCode: "151020", // Same GICS code as Cement
      }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-2",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 50,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    // Two separate cells because NRB sectors differ (even though GICS code is same)
    expect(matrix).toHaveLength(2);
    const cementCell = matrix.find((c) => c.industry === "Manufacturing - Cement");
    const brickCell = matrix.find((c) => c.industry === "Manufacturing - Brick");

    expect(cementCell).toMatchObject({
      gicsCode: "151020",
      industry: "Manufacturing - Cement",
      grossExposureUsd: 10_150, // 10_000 outstanding + 150 lossAllowance
      attributedCo2eTonnes: 100,
    });
    expect(brickCell).toMatchObject({
      gicsCode: "151020",
      industry: "Manufacturing - Brick",
      grossExposureUsd: 5_150, // 5_000 outstanding + 150 lossAllowance
      attributedCo2eTonnes: 50,
    });
  });

  it("handles mixed GICS availability across different industries", () => {
    const borrowers = [
      makeBorrower({
        id: "b-1",
        nrbSector: "Manufacturing - Cement",
        gicsCode: "151020", // Has GICS
      }),
      makeBorrower({
        id: "b-2",
        nrbSector: "Unknown Sector", // No GICS
      }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 10_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 5_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 100,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-2",
        pcafAssetClass: "business-loans-unlisted-equity",
        attributedCo2eTonnes: 50,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    expect(matrix).toHaveLength(2);
    const cementCell = matrix.find((c) => c.industry === "Manufacturing - Cement");
    const unknownCell = matrix.find((c) => c.industry === "Unknown Sector");

    // Cement has GICS
    expect(cementCell?.gicsCode).toBe("151020");
    expect(cementCell?.gicsLabel).toBeDefined();

    // Unknown does not
    expect(unknownCell?.gicsCode).toBeUndefined();
    expect(unknownCell?.gicsLabel).toBeUndefined();
  });

  it("GICS codes are consistent across all borrowers in same NRB sector", () => {
    const borrowers = [
      makeBorrower({
        id: "b-1",
        nrbSector: "Energy - Hydropower",
        gicsCode: "551010",
      }),
      makeBorrower({
        id: "b-2",
        nrbSector: "Energy - Hydropower",
        gicsCode: "551010",
      }),
    ];
    const loans = [
      makeLoan({ id: "l-1", borrowerId: "b-1", outstandingUsd: 8_000 }),
      makeLoan({ id: "l-2", borrowerId: "b-2", outstandingUsd: 6_000 }),
    ];
    const attributions = [
      makeAttribution({
        loanId: "l-1",
        borrowerId: "b-1",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 80,
      }),
      makeAttribution({
        loanId: "l-2",
        borrowerId: "b-2",
        pcafAssetClass: "project-finance",
        attributedCo2eTonnes: 60,
      }),
    ];

    const matrix = computeGrossExposureMatrix(loans, borrowers, attributions);

    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({
      gicsCode: "551010",
      gicsLabel: "Utilities / Utilities / Electric Utilities",
      industry: "Energy - Hydropower",
      assetClass: "project-finance",
      grossExposureUsd: 14_300, // 8_000 + 6_000 outstanding + 2×150 lossAllowance
      loanCount: 2,
      attributedCo2eTonnes: 140,
    });
  });
});
