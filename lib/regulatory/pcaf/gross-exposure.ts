/**
 * IFRS S2 B62(b) gross exposure computation — funded carrying amount before
 * loss allowance, aggregated per industry per asset class.
 *
 * Per *IFRS Sustainability Disclosure Standard IFRS S2 Climate-related
 * Disclosures* (June 2023), paragraph B62 "Disclosure of financed emissions"
 * requires a bank to disclose absolute gross financed emissions disaggregated
 * by:
 *
 *   (a) asset classes;
 *   (b) industry, based on IFRS classification or other industry classification
 *       systems;
 *   (c) for business-loan asset classes, size of the investee or counterparty
 *       (e.g., micro, small, medium, large);
 *   (d) for mortgage asset classes, energy-efficiency rating.
 *
 * B62(b) and B62(c) note that gross exposure is the **funded carrying amount
 * before loss allowance**, not the net carrying amount after impairment
 * provisions. This module computes:
 *
 *     gross exposure USD = outstanding USD + loss allowance USD
 *
 * and aggregates that amount into an industry × asset-class matrix.
 *
 * WHY LOSS ALLOWANCE MUST BE ADDED BACK. The carrying amount on the balance
 * sheet is net of impairment. IFRS S2 explicitly requires the gross (before-
 * loss-allowance) figure so that the disclosed exposure reflects the original
 * financed amount, not the bank's expected recovery. This aligns the exposure
 * basis with the emissions attributable to the borrower's real operations.
 *
 * INDUSTRY CLASSIFICATION. Per B62(b), "industry" may be classified using IFRS
 * taxonomy, ISIC, NACE, GICS, or another industry classification system. This
 * platform uses the **NRB sector** classification (Nepal Rastra Bank sectors:
 * hydropower, cement, manufacturing, agriculture, etc.) extended with Climate
 * TRACE facility sectors where borrowers have matched facilities. The
 * industry-aggregation key is `borrower.nrbSector`.
 *
 * ASSET CLASS ROUTING. Each loan is routed to a PCAF asset class per the
 * scoring rubric in `lib/regulatory/pcaf/scoring.ts`. The asset-class
 * aggregation uses the `pcafAssetClass` field attached to each attribution.
 *
 * ONE COMPUTATION, MULTIPLE DISCLOSURES. The gross exposure matrix feeds:
 *   - NFRS / ISSB disclosure tables (annual report § Climate-related metrics)
 *   - PCAF-adjusted weighted-average data quality (B62(c) per asset class)
 *   - Scenario analysis / SBTi attribution granularity
 *
 * This module is the single source of truth for B62(b) disaggregation; no
 * downstream aggregator should replicate this logic.
 */

import type { Loan, Borrower, PcafAttribution } from "@/lib/types/bfi";
import type { PcafAssetClass } from "./types";

/**
 * IFRS S2 B62(b) citation surfaced in tooltips / auditor exports.
 */
export const IFRS_S2_B62_CITATION =
  "IFRS S2 Climate-related Disclosures (June 2023) §B62(b) — gross exposure per industry per asset class";

/**
 * Compute the gross exposure (funded carrying amount before loss allowance)
 * for a single loan, per IFRS S2 B62(b).
 *
 * Returns:
 *     outstanding USD + loss allowance USD
 *
 * If `lossAllowance` is undefined (bank has not provided impairment data yet),
 * falls back to `outstandingUsd` alone. This is a temporary gap — live
 * deployments will require the bank to provide loss-allowance figures for
 * every in-scope loan. Demo mode seeds ~2 % loss allowance on every loan to
 * demonstrate the full disclosure logic.
 */
export function grossExposureUsd(loan: Loan): number {
  return loan.outstandingUsd + (loan.lossAllowance ?? 0);
}

/**
 * A single cell in the industry × asset-class gross exposure matrix.
 */
export type GrossExposureCell = {
  /** Industry key (NRB sector or Climate TRACE facility sector) */
  industry: string;
  /** PCAF asset class (PCAF Part A 3rd Edition §5.1-§5.10) */
  assetClass: PcafAssetClass;
  /** Sum of gross exposure USD across all loans in this cell */
  grossExposureUsd: number;
  /** Number of loans contributing to this cell */
  loanCount: number;
  /** Sum of attributed CO2e tonnes for this cell (optional, for integrated disclosure) */
  attributedCo2eTonnes?: number;
};

/**
 * The full industry × asset-class gross exposure matrix, per IFRS S2 B62(b).
 *
 * Rows are sorted by descending `grossExposureUsd` so the largest exposures
 * appear first in disclosure tables.
 */
export type GrossExposureMatrix = GrossExposureCell[];

/**
 * Compute the IFRS S2 B62(b) gross exposure matrix: industry × asset class
 * disaggregation of funded carrying amount before loss allowance.
 *
 * @param loans - All loans in the portfolio
 * @param borrowers - All borrowers (needed for industry classification)
 * @param attributions - PCAF attributions (needed for asset-class routing and optional CO2e)
 * @returns Industry × asset-class matrix sorted by descending gross exposure
 *
 * Each loan contributes to exactly one cell: the cell keyed by
 * `(borrower.nrbSector, attribution.pcafAssetClass)`. Loans with no attribution
 * are excluded (out-of-scope retail loans).
 */
export function computeGrossExposureMatrix(
  loans: Loan[],
  borrowers: Borrower[],
  attributions: PcafAttribution[],
): GrossExposureMatrix {
  // Build borrower lookup
  const borrowerById = new Map<string, Borrower>();
  for (const b of borrowers) {
    borrowerById.set(b.id, b);
  }

  // Build attribution lookup (keyed by loanId)
  const attrByLoanId = new Map<string, PcafAttribution>();
  for (const attr of attributions) {
    attrByLoanId.set(attr.loanId, attr);
  }

  // Accumulate cells in a map keyed by "industry|assetClass"
  const cellMap = new Map<
    string,
    {
      industry: string;
      assetClass: PcafAssetClass;
      grossExposureUsd: number;
      loanCount: number;
      attributedCo2eTonnes: number;
    }
  >();

  for (const loan of loans) {
    const attr = attrByLoanId.get(loan.id);
    if (!attr || !attr.pcafAssetClass) {
      // Out of scope or missing attribution — skip
      continue;
    }

    const borrower = borrowerById.get(loan.borrowerId);
    if (!borrower) {
      // Orphaned loan (should not happen) — skip
      continue;
    }

    const industry = borrower.nrbSector;
    const assetClass = attr.pcafAssetClass;
    const key = `${industry}|${assetClass}`;

    const existing = cellMap.get(key);
    if (existing) {
      existing.grossExposureUsd += grossExposureUsd(loan);
      existing.loanCount += 1;
      existing.attributedCo2eTonnes += attr.attributedCo2eTonnes;
    } else {
      cellMap.set(key, {
        industry,
        assetClass,
        grossExposureUsd: grossExposureUsd(loan),
        loanCount: 1,
        attributedCo2eTonnes: attr.attributedCo2eTonnes,
      });
    }
  }

  // Convert map to array and sort by descending gross exposure
  const matrix = Array.from(cellMap.values()).sort(
    (a, b) => b.grossExposureUsd - a.grossExposureUsd,
  );

  return matrix;
}
