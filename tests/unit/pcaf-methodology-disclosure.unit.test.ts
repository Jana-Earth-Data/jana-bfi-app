/**
 * Unit tests for PCAF methodology disclosure (N1.10).
 *
 * Per IFRS S2 B62(d) and §29(a)(iii), entity shall disclose the methodology
 * used to measure financed emissions, including the allocation method, inputs,
 * assumptions, and estimation techniques. N1.10 replaces the hardcoded
 * `pcafMethodologyNote` prose strings with structured disclosure showing which
 * PCAF options, denominators, data sources, and asset classes were used.
 *
 * **Scope:** Tests {@link computeMethodologyDisclosure} from
 * `lib/regulatory/pcaf/methodology.ts` to verify correct aggregation of
 * per-loan methodology metadata into portfolio-level disclosure.
 */

import { describe, it, expect } from "vitest";
import { computeMethodologyDisclosure } from "@/lib/regulatory/pcaf/methodology";
import type { Loan, PcafAttribution } from "@/lib/types/bfi";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeLoan(id: string, outstandingUsd: number): Loan {
  return {
    id,
    borrowerId: `borrower-${id}`,
    product: "Term Loan",
    category: "commercial-term-loan",
    outstandingNpr: outstandingUsd * 133.5,
    outstandingUsd,
    disbursedDate: "2024-01-15",
    maturityDate: "2029-01-15",
    status: "disbursed",
    nrbTaxonomy: "unclassified",
    purpose: "General corporate",
  };
}

function makeAttribution(
  loanId: string,
  overrides?: Partial<PcafAttribution>,
): PcafAttribution {
  return {
    loanId,
    borrowerId: `borrower-${loanId}`,
    attributionFactor: 0.15,
    attributedCo2eTonnes: 100,
    dataQualityScore: 3,
    qualityNote: "Test",
    pcafOption: "2b",
    pcafAssetClass: "business-loans-unlisted-equity",
    denominatorType: "enterprise-value",
    denominatorLabel: "Outstanding ÷ Enterprise Value",
    pcafCitation: "PCAF Part A 3rd Edition §5.2",
    pcafDataSource: "Climate TRACE facility data",
    ...overrides,
  };
}

describe("computeMethodologyDisclosure · Basic aggregation", () => {
  it("aggregates single attribution correctly", () => {
    const loans = [makeLoan("loan-1", 1_000_000)];
    const attributions = [makeAttribution("loan-1")];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // By option
    expect(disclosure.byOption).toHaveLength(1);
    expect(disclosure.byOption[0].option).toBe("2b");
    expect(disclosure.byOption[0].loanCount).toBe(1);
    expect(disclosure.byOption[0].percentOfLoans).toBe(100);
    expect(disclosure.byOption[0].outstandingUsd).toBe(1_000_000);
    expect(disclosure.byOption[0].percentOfExposure).toBe(100);
    expect(disclosure.byOption[0].attributedCo2eTonnes).toBe(100);
    expect(disclosure.byOption[0].percentOfEmissions).toBe(100);

    // By denominator
    expect(disclosure.byDenominator).toHaveLength(1);
    expect(disclosure.byDenominator[0].denominatorType).toBe("enterprise-value");
    expect(disclosure.byDenominator[0].loanCount).toBe(1);
    expect(disclosure.byDenominator[0].percentOfLoans).toBe(100);

    // By data quality score
    expect(disclosure.byDataQualityScore).toHaveLength(1);
    expect(disclosure.byDataQualityScore[0].score).toBe(3);
    expect(disclosure.byDataQualityScore[0].loanCount).toBe(1);

    // Data sources
    expect(disclosure.dataSources).toEqual(["Climate TRACE facility data"]);

    // Asset classes
    expect(disclosure.assetClasses).toHaveLength(1);
    expect(disclosure.assetClasses[0].assetClass).toBe("business-loans-unlisted-equity");
  });

  it("aggregates multiple attributions with same option", () => {
    const loans = [makeLoan("loan-1", 500_000), makeLoan("loan-2", 300_000)];
    const attributions = [
      makeAttribution("loan-1", { attributedCo2eTonnes: 50 }),
      makeAttribution("loan-2", { attributedCo2eTonnes: 30 }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byOption).toHaveLength(1);
    expect(disclosure.byOption[0].option).toBe("2b");
    expect(disclosure.byOption[0].loanCount).toBe(2);
    expect(disclosure.byOption[0].outstandingUsd).toBe(800_000);
    expect(disclosure.byOption[0].attributedCo2eTonnes).toBe(80);
  });

  it("separates different PCAF options", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
      makeLoan("loan-3", 300_000),
    ];
    const attributions = [
      makeAttribution("loan-1", {
        pcafOption: "1a",
        dataQualityScore: 1,
        attributedCo2eTonnes: 200,
      }),
      makeAttribution("loan-2", {
        pcafOption: "2b",
        dataQualityScore: 3,
        attributedCo2eTonnes: 100,
      }),
      makeAttribution("loan-3", {
        pcafOption: "3b",
        dataQualityScore: 5,
        attributedCo2eTonnes: 50,
      }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // Should have 3 option entries
    expect(disclosure.byOption).toHaveLength(3);

    // Find each option
    const opt1a = disclosure.byOption.find((o) => o.option === "1a")!;
    const opt2b = disclosure.byOption.find((o) => o.option === "2b")!;
    const opt3b = disclosure.byOption.find((o) => o.option === "3b")!;

    expect(opt1a.loanCount).toBe(1);
    expect(opt1a.outstandingUsd).toBe(1_000_000);
    expect(opt1a.percentOfExposure).toBeCloseTo(55.56, 1); // 1M / 1.8M * 100

    expect(opt2b.loanCount).toBe(1);
    expect(opt2b.outstandingUsd).toBe(500_000);

    expect(opt3b.loanCount).toBe(1);
    expect(opt3b.outstandingUsd).toBe(300_000);
  });
});

describe("computeMethodologyDisclosure · By denominator type (N1.9)", () => {
  it("separates different denominator types", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
      makeLoan("loan-3", 300_000),
    ];
    const attributions = [
      makeAttribution("loan-1", {
        denominatorType: "equity-plus-debt",
        denominatorLabel: "Outstanding ÷ (Equity + Debt)",
      }),
      makeAttribution("loan-2", {
        denominatorType: "project-cost",
        denominatorLabel: "Outstanding ÷ Total Project Cost",
      }),
      makeAttribution("loan-3", {
        denominatorType: "enterprise-value",
        denominatorLabel: "Outstanding ÷ Enterprise Value",
      }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byDenominator).toHaveLength(3);

    const equityDebt = disclosure.byDenominator.find(
      (d) => d.denominatorType === "equity-plus-debt",
    )!;
    const projectCost = disclosure.byDenominator.find(
      (d) => d.denominatorType === "project-cost",
    )!;
    const enterpriseValue = disclosure.byDenominator.find(
      (d) => d.denominatorType === "enterprise-value",
    )!;

    expect(equityDebt.loanCount).toBe(1);
    expect(equityDebt.outstandingUsd).toBe(1_000_000);

    expect(projectCost.loanCount).toBe(1);
    expect(projectCost.outstandingUsd).toBe(500_000);

    expect(enterpriseValue.loanCount).toBe(1);
    expect(enterpriseValue.outstandingUsd).toBe(300_000);
  });

  it("aggregates same denominator type", () => {
    const loans = [makeLoan("loan-1", 500_000), makeLoan("loan-2", 300_000)];
    const attributions = [
      makeAttribution("loan-1", { denominatorType: "equity-plus-debt" }),
      makeAttribution("loan-2", { denominatorType: "equity-plus-debt" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byDenominator).toHaveLength(1);
    expect(disclosure.byDenominator[0].denominatorType).toBe("equity-plus-debt");
    expect(disclosure.byDenominator[0].loanCount).toBe(2);
    expect(disclosure.byDenominator[0].outstandingUsd).toBe(800_000);
  });
});

describe("computeMethodologyDisclosure · By data quality score", () => {
  it("separates all 5 scores", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 800_000),
      makeLoan("loan-3", 600_000),
      makeLoan("loan-4", 400_000),
      makeLoan("loan-5", 200_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { dataQualityScore: 1, attributedCo2eTonnes: 100 }),
      makeAttribution("loan-2", { dataQualityScore: 2, attributedCo2eTonnes: 80 }),
      makeAttribution("loan-3", { dataQualityScore: 3, attributedCo2eTonnes: 60 }),
      makeAttribution("loan-4", { dataQualityScore: 4, attributedCo2eTonnes: 40 }),
      makeAttribution("loan-5", { dataQualityScore: 5, attributedCo2eTonnes: 20 }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byDataQualityScore).toHaveLength(5);

    // Should be sorted by score (1, 2, 3, 4, 5)
    expect(disclosure.byDataQualityScore[0].score).toBe(1);
    expect(disclosure.byDataQualityScore[1].score).toBe(2);
    expect(disclosure.byDataQualityScore[2].score).toBe(3);
    expect(disclosure.byDataQualityScore[3].score).toBe(4);
    expect(disclosure.byDataQualityScore[4].score).toBe(5);

    // Check percentages
    const total = 100 + 80 + 60 + 40 + 20; // 300
    expect(disclosure.byDataQualityScore[0].percentOfEmissions).toBeCloseTo(
      (100 / total) * 100,
      1,
    );
    expect(disclosure.byDataQualityScore[4].percentOfEmissions).toBeCloseTo(
      (20 / total) * 100,
      1,
    );
  });

  it("aggregates same score", () => {
    const loans = [makeLoan("loan-1", 500_000), makeLoan("loan-2", 300_000)];
    const attributions = [
      makeAttribution("loan-1", { dataQualityScore: 3, attributedCo2eTonnes: 50 }),
      makeAttribution("loan-2", { dataQualityScore: 3, attributedCo2eTonnes: 30 }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byDataQualityScore).toHaveLength(1);
    expect(disclosure.byDataQualityScore[0].score).toBe(3);
    expect(disclosure.byDataQualityScore[0].loanCount).toBe(2);
    expect(disclosure.byDataQualityScore[0].attributedCo2eTonnes).toBe(80);
  });
});

describe("computeMethodologyDisclosure · Data sources", () => {
  it("collects unique data sources", () => {
    const loans = [
      makeLoan("loan-1", 500_000),
      makeLoan("loan-2", 300_000),
      makeLoan("loan-3", 200_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafDataSource: "Climate TRACE facility data" }),
      makeAttribution("loan-2", { pcafDataSource: "EDGAR sector intensity" }),
      makeAttribution("loan-3", { pcafDataSource: "Climate TRACE facility data" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // Should deduplicate and sort
    expect(disclosure.dataSources).toHaveLength(2);
    expect(disclosure.dataSources).toContain("Climate TRACE facility data");
    expect(disclosure.dataSources).toContain("EDGAR sector intensity");
    expect(disclosure.dataSources[0]).toBe("Climate TRACE facility data"); // Alphabetically first
  });

  it("handles empty data sources gracefully", () => {
    const loans = [makeLoan("loan-1", 500_000)];
    const attributions = [makeAttribution("loan-1", { pcafDataSource: undefined })];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.dataSources).toEqual([]);
  });
});

describe("computeMethodologyDisclosure · Asset classes", () => {
  it("separates different asset classes", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000),
      makeLoan("loan-2", 500_000),
      makeLoan("loan-3", 300_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution("loan-2", { pcafAssetClass: "project-finance" }),
      makeAttribution("loan-3", { pcafAssetClass: "mortgages" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.assetClasses).toHaveLength(3);

    // Should be sorted alphabetically
    expect(disclosure.assetClasses[0].assetClass).toBe("business-loans-unlisted-equity");
    expect(disclosure.assetClasses[1].assetClass).toBe("mortgages");
    expect(disclosure.assetClasses[2].assetClass).toBe("project-finance");
  });

  it("aggregates same asset class", () => {
    const loans = [makeLoan("loan-1", 500_000), makeLoan("loan-2", 300_000)];
    const attributions = [
      makeAttribution("loan-1", { pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution("loan-2", { pcafAssetClass: "business-loans-unlisted-equity" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.assetClasses).toHaveLength(1);
    expect(disclosure.assetClasses[0].assetClass).toBe("business-loans-unlisted-equity");
    expect(disclosure.assetClasses[0].loanCount).toBe(2);
    expect(disclosure.assetClasses[0].outstandingUsd).toBe(800_000);
  });
});

describe("computeMethodologyDisclosure · Backward compatibility", () => {
  it("handles attributions without pcafOption (pre-N1.8)", () => {
    const loans = [makeLoan("loan-1", 500_000)];
    const attributions = [makeAttribution("loan-1", { pcafOption: undefined })];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // Should have empty byOption array (no options to aggregate)
    expect(disclosure.byOption).toHaveLength(0);

    // Other fields should still work
    expect(disclosure.byDataQualityScore).toHaveLength(1);
  });

  it("handles attributions without denominatorType (pre-N1.9)", () => {
    const loans = [makeLoan("loan-1", 500_000)];
    const attributions = [makeAttribution("loan-1", { denominatorType: undefined })];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // Should have empty byDenominator array
    expect(disclosure.byDenominator).toHaveLength(0);
  });

  it("handles attributions without pcafAssetClass (pre-N1.8)", () => {
    const loans = [makeLoan("loan-1", 500_000)];
    const attributions = [makeAttribution("loan-1", { pcafAssetClass: undefined })];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    // Should have empty assetClasses array
    expect(disclosure.assetClasses).toHaveLength(0);
  });
});

describe("computeMethodologyDisclosure · Percentage calculations", () => {
  it("calculates percentages correctly with mixed exposure", () => {
    const loans = [
      makeLoan("loan-1", 1_000_000), // 50% of 2M
      makeLoan("loan-2", 600_000),   // 30% of 2M
      makeLoan("loan-3", 400_000),   // 20% of 2M
    ];
    const attributions = [
      makeAttribution("loan-1", {
        pcafOption: "1a",
        attributedCo2eTonnes: 200,
      }),
      makeAttribution("loan-2", {
        pcafOption: "2b",
        attributedCo2eTonnes: 100,
      }),
      makeAttribution("loan-3", {
        pcafOption: "3b",
        attributedCo2eTonnes: 50,
      }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    const opt1a = disclosure.byOption.find((o) => o.option === "1a")!;
    const opt2b = disclosure.byOption.find((o) => o.option === "2b")!;
    const opt3b = disclosure.byOption.find((o) => o.option === "3b")!;

    // Loan count percentages
    expect(opt1a.percentOfLoans).toBeCloseTo(33.33, 1);
    expect(opt2b.percentOfLoans).toBeCloseTo(33.33, 1);
    expect(opt3b.percentOfLoans).toBeCloseTo(33.33, 1);

    // Exposure percentages
    expect(opt1a.percentOfExposure).toBe(50);
    expect(opt2b.percentOfExposure).toBe(30);
    expect(opt3b.percentOfExposure).toBe(20);

    // Emissions percentages (total = 350)
    expect(opt1a.percentOfEmissions).toBeCloseTo(57.14, 1); // 200/350
    expect(opt2b.percentOfEmissions).toBeCloseTo(28.57, 1); // 100/350
    expect(opt3b.percentOfEmissions).toBeCloseTo(14.29, 1); // 50/350
  });

  it("handles zero totals gracefully", () => {
    const loans: Loan[] = [];
    const attributions: PcafAttribution[] = [];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byOption).toHaveLength(0);
    expect(disclosure.byDenominator).toHaveLength(0);
    expect(disclosure.byDataQualityScore).toHaveLength(0);
    expect(disclosure.dataSources).toEqual([]);
    expect(disclosure.assetClasses).toHaveLength(0);
  });
});

describe("computeMethodologyDisclosure · Sorting", () => {
  it("sorts byOption by option order (1a, 1b, 2a, 2b, 3a, 3b, 3c)", () => {
    const loans = [
      makeLoan("loan-1", 100_000),
      makeLoan("loan-2", 100_000),
      makeLoan("loan-3", 100_000),
      makeLoan("loan-4", 100_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafOption: "3b" }),
      makeAttribution("loan-2", { pcafOption: "1a" }),
      makeAttribution("loan-3", { pcafOption: "2b" }),
      makeAttribution("loan-4", { pcafOption: "1b" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byOption[0].option).toBe("1a");
    expect(disclosure.byOption[1].option).toBe("1b");
    expect(disclosure.byOption[2].option).toBe("2b");
    expect(disclosure.byOption[3].option).toBe("3b");
  });

  it("sorts byDataQualityScore by score (1-5)", () => {
    const loans = [
      makeLoan("loan-1", 100_000),
      makeLoan("loan-2", 100_000),
      makeLoan("loan-3", 100_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { dataQualityScore: 5 }),
      makeAttribution("loan-2", { dataQualityScore: 1 }),
      makeAttribution("loan-3", { dataQualityScore: 3 }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.byDataQualityScore[0].score).toBe(1);
    expect(disclosure.byDataQualityScore[1].score).toBe(3);
    expect(disclosure.byDataQualityScore[2].score).toBe(5);
  });

  it("sorts assetClasses alphabetically", () => {
    const loans = [
      makeLoan("loan-1", 100_000),
      makeLoan("loan-2", 100_000),
      makeLoan("loan-3", 100_000),
    ];
    const attributions = [
      makeAttribution("loan-1", { pcafAssetClass: "project-finance" }),
      makeAttribution("loan-2", { pcafAssetClass: "business-loans-unlisted-equity" }),
      makeAttribution("loan-3", { pcafAssetClass: "mortgages" }),
    ];

    const disclosure = computeMethodologyDisclosure(attributions, loans);

    expect(disclosure.assetClasses[0].assetClass).toBe("business-loans-unlisted-equity");
    expect(disclosure.assetClasses[1].assetClass).toBe("mortgages");
    expect(disclosure.assetClasses[2].assetClass).toBe("project-finance");
  });
});
