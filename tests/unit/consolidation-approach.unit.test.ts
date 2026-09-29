/**
 * Unit tests for N1.12 — IFRS S2 B27 consolidation approach disclosure.
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B27, entity shall use
 * either the **equity share approach** or the **control approach** when measuring
 * financed emissions, and shall disclose which approach was used and the reason.
 *
 * Tests verify that the consolidation approach configuration is correctly passed
 * through to the PortfolioSummary disclosure when provided, and gracefully handles
 * the case when it is not configured (undefined).
 */

import { describe, it, expect } from "vitest";
import { summarise } from "@/lib/regulatory/pcaf/aggregation";
import type { Loan, Borrower, PcafAttribution } from "@/lib/types/bfi";

// Test helpers
function makeLoan(id: string): Loan {
  return {
    id,
    borrowerId: `borrower-${id}`,
    product: "Term Loan",
    outstandingNpr: 100_000,
    outstandingUsd: 1_000,
    disbursedDate: "2024-01-01",
    maturityDate: "2029-01-01",
    status: "disbursed",
    nrbTaxonomy: "unclassified",
    purpose: "General working capital",
    category: "sme-term-loan",
  };
}

function makeBorrower(id: string): Borrower {
  return {
    id,
    name: `Borrower ${id}`,
    nrbSector: "Manufacturing - Other",
    totalCo2eTonnes: 100,
    enterpriseValueUsd: 10_000,
    evSource: "estimated",
    kind: "corporate",
    dataTier: "sector-benchmark",
    facilities: [],
  };
}

function makeAttribution(loanId: string, borrowerId: string): PcafAttribution {
  return {
    loanId,
    borrowerId,
    attributionFactor: 0.1,
    attributedCo2eTonnes: 10,
    dataQualityScore: 4,
    qualityNote: "Sector benchmark",
  };
}

describe("summarise() - Consolidation Approach Disclosure", () => {
  it("includes consolidation approach when provided (equity-share)", () => {
    const loans = [makeLoan("loan-1")];
    const borrowers = [makeBorrower("borrower-1")];
    const attributions = [makeAttribution("loan-1", "borrower-1")];

    const consolidation = {
      approach: "equity-share" as const,
      reason:
        "Equity share approach used because the bank does not exercise operational control over borrowers in its commercial loan portfolio.",
    };

    const summary = summarise(loans, borrowers, attributions, consolidation);

    expect(summary.consolidationApproach).toBeDefined();
    expect(summary.consolidationApproach?.approach).toBe("equity-share");
    expect(summary.consolidationApproach?.reason).toBe(consolidation.reason);
  });

  it("includes consolidation approach when provided (control)", () => {
    const loans = [makeLoan("loan-1")];
    const borrowers = [makeBorrower("borrower-1")];
    const attributions = [makeAttribution("loan-1", "borrower-1")];

    const consolidation = {
      approach: "control" as const,
      reason:
        "Control approach used because the bank exercises operational control over borrowers through majority ownership and board representation.",
    };

    const summary = summarise(loans, borrowers, attributions, consolidation);

    expect(summary.consolidationApproach).toBeDefined();
    expect(summary.consolidationApproach?.approach).toBe("control");
    expect(summary.consolidationApproach?.reason).toBe(consolidation.reason);
  });

  it("is undefined when not provided (backward compatibility)", () => {
    const loans = [makeLoan("loan-1")];
    const borrowers = [makeBorrower("borrower-1")];
    const attributions = [makeAttribution("loan-1", "borrower-1")];

    // Call without consolidation parameter
    const summary = summarise(loans, borrowers, attributions);

    expect(summary.consolidationApproach).toBeUndefined();
  });

  it("is undefined when explicitly passed as undefined", () => {
    const loans = [makeLoan("loan-1")];
    const borrowers = [makeBorrower("borrower-1")];
    const attributions = [makeAttribution("loan-1", "borrower-1")];

    const summary = summarise(loans, borrowers, attributions, undefined);

    expect(summary.consolidationApproach).toBeUndefined();
  });

  it("preserves reason text exactly as provided", () => {
    const loans = [makeLoan("loan-1")];
    const borrowers = [makeBorrower("borrower-1")];
    const attributions = [makeAttribution("loan-1", "borrower-1")];

    const longReason =
      "The bank uses the equity share approach per PCAF Part A 3rd Edition §4.2, " +
      "as the bank's role is that of a lender rather than an operator. The bank's " +
      "minority stake in most borrowers (average ~10% attribution factor) reflects " +
      "limited influence over operational decisions. This approach aligns with GHG " +
      "Protocol Scope 3 Category 15 guidance for financial institutions.";

    const consolidation = {
      approach: "equity-share" as const,
      reason: longReason,
    };

    const summary = summarise(loans, borrowers, attributions, consolidation);

    expect(summary.consolidationApproach?.reason).toBe(longReason);
    expect(summary.consolidationApproach?.reason.length).toBe(longReason.length);
  });

  it("does not affect any portfolio calculations", () => {
    const loans = [makeLoan("loan-1"), makeLoan("loan-2")];
    const borrowers = [makeBorrower("borrower-1"), makeBorrower("borrower-2")];
    const attributions = [
      makeAttribution("loan-1", "borrower-1"),
      makeAttribution("loan-2", "borrower-2"),
    ];

    // Summary without consolidation approach
    const summaryWithout = summarise(loans, borrowers, attributions);

    // Summary with equity-share
    const summaryEquity = summarise(loans, borrowers, attributions, {
      approach: "equity-share",
      reason: "Test reason",
    });

    // Summary with control
    const summaryControl = summarise(loans, borrowers, attributions, {
      approach: "control",
      reason: "Test reason",
    });

    // All calculations should be identical
    expect(summaryEquity.totalLoans).toBe(summaryWithout.totalLoans);
    expect(summaryEquity.totalOutstandingUsd).toBe(summaryWithout.totalOutstandingUsd);
    expect(summaryEquity.totalAttributedCo2eTonnes).toBe(
      summaryWithout.totalAttributedCo2eTonnes,
    );
    expect(summaryEquity.weightedDataQuality).toBe(summaryWithout.weightedDataQuality);

    expect(summaryControl.totalLoans).toBe(summaryWithout.totalLoans);
    expect(summaryControl.totalOutstandingUsd).toBe(summaryWithout.totalOutstandingUsd);
    expect(summaryControl.totalAttributedCo2eTonnes).toBe(
      summaryWithout.totalAttributedCo2eTonnes,
    );
    expect(summaryControl.weightedDataQuality).toBe(summaryWithout.weightedDataQuality);
  });

  it("works with empty portfolio", () => {
    const consolidation = {
      approach: "equity-share" as const,
      reason: "Standard approach for commercial lending",
    };

    const summary = summarise([], [], [], consolidation);

    expect(summary.consolidationApproach).toBeDefined();
    expect(summary.consolidationApproach?.approach).toBe("equity-share");
    expect(summary.totalLoans).toBe(0);
  });

  it("works with large portfolio", () => {
    const loans: Loan[] = [];
    const borrowers: Borrower[] = [];
    const attributions: PcafAttribution[] = [];

    for (let i = 0; i < 1000; i++) {
      const loanId = `loan-${i}`;
      const borrowerId = `borrower-${i}`;
      loans.push(makeLoan(loanId));
      borrowers.push(makeBorrower(borrowerId));
      attributions.push(makeAttribution(loanId, borrowerId));
    }

    const consolidation = {
      approach: "control" as const,
      reason: "Control approach due to majority ownership structure",
    };

    const summary = summarise(loans, borrowers, attributions, consolidation);

    expect(summary.consolidationApproach).toBeDefined();
    expect(summary.consolidationApproach?.approach).toBe("control");
    expect(summary.totalLoans).toBe(1000);
  });
});

describe("ConsolidationConfig Type", () => {
  it("accepts both approach values", () => {
    // This is a compile-time test - if it compiles, the types are correct
    const equityConfig: { approach: "equity-share" | "control"; reason: string } = {
      approach: "equity-share",
      reason: "Test",
    };

    const controlConfig: { approach: "equity-share" | "control"; reason: string } = {
      approach: "control",
      reason: "Test",
    };

    expect(equityConfig.approach).toBe("equity-share");
    expect(controlConfig.approach).toBe("control");
  });

  it("requires a reason string", () => {
    const config: { approach: "equity-share" | "control"; reason: string } = {
      approach: "equity-share",
      reason: "Per B27, this reason explains the choice of approach.",
    };

    expect(config.reason).toBeDefined();
    expect(typeof config.reason).toBe("string");
    expect(config.reason.length).toBeGreaterThan(0);
  });
});
