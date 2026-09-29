/**
 * Data extent disclosure computation per IFRS S2 B55–B56 and §29(a)(iii).
 *
 * Per IFRS S2 Climate-related Disclosures (June 2023):
 * - **§B55**: Entity shall disclose the extent to which Scope 3 financed emissions
 *   are measured using primary activity data from counterparties (borrower-specific
 *   operational data).
 * - **§B56**: Entity shall disclose the extent using verified data (third-party assured).
 *
 * Maps to PCAF data quality options:
 * - **Primary-activity data**: Options 2a (energy consumption records) and 2b (production records)
 * - **Verified data**: Option 1a (third-party assurance opinion)
 *
 * Each extent is measured across three dimensions:
 * - Count of loans
 * - Gross exposure (outstanding USD)
 * - Attributed financed emissions (CO2e tonnes)
 *
 * Added for N1.11 (PR1 phase — B62 compliance).
 */

import type { Loan, PcafAttribution, DataExtentDisclosure } from "@/lib/types/bfi";

/**
 * Compute the data extent disclosure from per-loan attributions.
 *
 * @param attributions - Per-loan PCAF attributions with pcafOption metadata (from N1.8)
 * @param loans - Loan book for outstanding USD lookup
 * @returns Structured disclosure of primary-activity and verified data extents
 */
export function computeDataExtentDisclosure(
  attributions: PcafAttribution[],
  loans: Loan[],
): DataExtentDisclosure {
  // Build loan lookup for outstanding USD
  const loanById = new Map(loans.map((l) => [l.id, l]));

  // Total portfolio metrics for percentage calculations
  const totalLoans = attributions.length;
  const totalGrossExposureUsd = attributions.reduce(
    (sum, a) => sum + (loanById.get(a.loanId)?.outstandingUsd ?? 0),
    0,
  );
  const totalAttributedCo2eTonnes = attributions.reduce(
    (sum, a) => sum + a.attributedCo2eTonnes,
    0,
  );

  // Accumulate primary-activity data extent (Options 2a, 2b)
  let primaryActivityCount = 0;
  let primaryActivityExposureUsd = 0;
  let primaryActivityCo2eTonnes = 0;

  // Accumulate verified data extent (Option 1a)
  let verifiedCount = 0;
  let verifiedExposureUsd = 0;
  let verifiedCo2eTonnes = 0;

  for (const attr of attributions) {
    const loan = loanById.get(attr.loanId);
    const exposure = loan?.outstandingUsd ?? 0;
    const emissions = attr.attributedCo2eTonnes;

    // Primary-activity data: Options 2a (energy) and 2b (production)
    if (attr.pcafOption === "2a" || attr.pcafOption === "2b") {
      primaryActivityCount += 1;
      primaryActivityExposureUsd += exposure;
      primaryActivityCo2eTonnes += emissions;
    }

    // Verified data: Option 1a (third-party assurance)
    if (attr.pcafOption === "1a") {
      verifiedCount += 1;
      verifiedExposureUsd += exposure;
      verifiedCo2eTonnes += emissions;
    }
  }

  // Helper to compute percentages safely (avoid division by zero)
  const pct = (numerator: number, denominator: number): number => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 10000) / 100; // Two decimal places
  };

  return {
    primaryActivityData: {
      loanCount: primaryActivityCount,
      percentOfLoans: pct(primaryActivityCount, totalLoans),
      grossExposureUsd: Math.round(primaryActivityExposureUsd),
      percentOfExposure: pct(primaryActivityExposureUsd, totalGrossExposureUsd),
      attributedCo2eTonnes: Math.round(primaryActivityCo2eTonnes),
      percentOfEmissions: pct(primaryActivityCo2eTonnes, totalAttributedCo2eTonnes),
    },
    verifiedData: {
      loanCount: verifiedCount,
      percentOfLoans: pct(verifiedCount, totalLoans),
      grossExposureUsd: Math.round(verifiedExposureUsd),
      percentOfExposure: pct(verifiedExposureUsd, totalGrossExposureUsd),
      attributedCo2eTonnes: Math.round(verifiedCo2eTonnes),
      percentOfEmissions: pct(verifiedCo2eTonnes, totalAttributedCo2eTonnes),
    },
  };
}
