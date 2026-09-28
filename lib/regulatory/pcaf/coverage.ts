/**
 * IFRS S2 B62(c) coverage calculation — percentage of gross exposure included
 * in financed-emissions calculation, with excluded asset types named.
 *
 * Per *IFRS Sustainability Disclosure Standard IFRS S2 Climate-related
 * Disclosures* (June 2023), paragraph B62(c):
 *
 *   "An entity shall disclose the **percentage of its gross exposure that is
 *   included** in its financed emissions calculation ... the entity shall
 *   disclose:
 *     (i) the **types of assets excluded** from the calculation;
 *     (ii) whether the entity has excluded risk mitigants ... from its gross
 *          exposure;
 *     (iii) whether undrawn loan commitments are included ..."
 *
 * CORRECT DENOMINATOR. The percentage is calculated against **total gross
 * exposure** (all loans), not against "in-scope exposure" (non-retail loans).
 * This is the correction N1.2 makes: the existing `PortfolioFunnel` computes
 * facilityMatched ÷ inScope, which has the wrong denominator — it excludes
 * retail from both numerator and denominator, so the percentage overstates
 * coverage. B62(c) requires:
 *
 *     coverage % = (gross exposure of loans WITH attribution) /
 *                  (total gross exposure of ALL loans)
 *
 * WHAT IS INCLUDED. A loan is "included in the financed-emissions calculation"
 * if it has a PCAF attribution (i.e., appears in the `attributions` array
 * passed to the aggregation function). Loans without attributions are excluded
 * — typically retail loans, which are out of PCAF scope.
 *
 * EXCLUDED ASSET TYPES. B62(c)(i) requires the bank to name the types of
 * assets excluded. This module provides `computeExcludedAssetTypes()`, which
 * identifies all loan categories present in the portfolio that have zero
 * attributions, grouped into human-readable labels (e.g., "Retail mortgages",
 * "Retail personal loans").
 */

import type { Loan, PcafAttribution } from "@/lib/types/bfi";
import { grossExposureUsd } from "./gross-exposure";

/**
 * IFRS S2 B62(c) citation surfaced in tooltips / auditor exports.
 */
export const IFRS_S2_B62C_CITATION =
  "IFRS S2 Climate-related Disclosures (June 2023) §B62(c) — percentage of gross exposure included";

/**
 * Result of the B62(c) coverage calculation.
 */
export type GrossExposureCoverage = {
  /** Total gross exposure (USD) across all loans */
  totalGrossExposureUsd: number;
  /** Gross exposure (USD) of loans included in financed-emissions calculation */
  includedGrossExposureUsd: number;
  /** Percentage of gross exposure included (0-100) */
  coveragePercent: number;
  /** Count of loans included */
  includedLoanCount: number;
  /** Count of loans excluded */
  excludedLoanCount: number;
  /** Human-readable list of excluded asset types (B62(c)(i)) */
  excludedAssetTypes: string[];
};

/**
 * Mapping from LoanCategory to human-readable asset type labels for B62(c)(i)
 * disclosure ("types of assets excluded").
 */
const LOAN_CATEGORY_LABELS: Record<string, string> = {
  "retail-mortgage": "Retail mortgages",
  "retail-personal": "Retail personal loans",
  "retail-education": "Retail education loans",
  "retail-vehicle": "Retail vehicle loans",
  "sme-working-capital": "SME working capital",
  "sme-trade-finance": "SME trade finance",
  "sme-term-loan": "SME term loans",
  "commercial-term-loan": "Commercial term loans",
  "commercial-working-capital": "Commercial working capital",
  "commercial-project-finance": "Commercial project finance",
  "corporate-syndicated": "Corporate syndicated loans",
  "corporate-project-finance": "Corporate project finance",
};

/**
 * Compute IFRS S2 B62(c) coverage: percentage of gross exposure included in
 * the financed-emissions calculation, with excluded asset types identified.
 *
 * @param loans - All loans in the portfolio
 * @param attributions - PCAF attributions (loans WITH attribution are included)
 * @returns Coverage statistics + list of excluded asset types
 *
 * A loan is "included" if it appears in the `attributions` array (i.e., has a
 * PCAF attribution). Loans without attributions are excluded — typically retail
 * loans, which are out of scope for facility-level PCAF.
 *
 * The denominator is **total gross exposure** (all loans), not "in-scope
 * exposure" — this is the correction N1.2 makes over the existing
 * `PortfolioFunnel` calculation.
 */
export function computeGrossExposureCoverage(
  loans: Loan[],
  attributions: PcafAttribution[],
): GrossExposureCoverage {
  // Build a set of loan IDs that have attributions (= included)
  const includedLoanIds = new Set(attributions.map((a) => a.loanId));

  let totalGrossExposureUsd = 0;
  let includedGrossExposureUsd = 0;
  let includedLoanCount = 0;
  let excludedLoanCount = 0;

  // Track which loan categories are excluded (have loans but zero attributions)
  const categoriesWithLoans = new Set<string>();
  const categoriesWithAttributions = new Set<string>();

  for (const loan of loans) {
    const grossExp = grossExposureUsd(loan);
    totalGrossExposureUsd += grossExp;

    const category = loan.category ?? "uncategorized";
    categoriesWithLoans.add(category);

    if (includedLoanIds.has(loan.id)) {
      includedGrossExposureUsd += grossExp;
      includedLoanCount += 1;
      categoriesWithAttributions.add(category);
    } else {
      excludedLoanCount += 1;
    }
  }

  // Identify excluded asset types: categories with loans but no attributions
  const excludedCategories = Array.from(categoriesWithLoans).filter(
    (cat) => !categoriesWithAttributions.has(cat),
  );

  const excludedAssetTypes = excludedCategories
    .map((cat) => LOAN_CATEGORY_LABELS[cat] ?? cat)
    .sort();

  const coveragePercent =
    totalGrossExposureUsd > 0
      ? (includedGrossExposureUsd / totalGrossExposureUsd) * 100
      : 0;

  return {
    totalGrossExposureUsd: Math.round(totalGrossExposureUsd),
    includedGrossExposureUsd: Math.round(includedGrossExposureUsd),
    coveragePercent: Math.round(coveragePercent * 100) / 100, // Round to 2 decimals
    includedLoanCount,
    excludedLoanCount,
    excludedAssetTypes,
  };
}
