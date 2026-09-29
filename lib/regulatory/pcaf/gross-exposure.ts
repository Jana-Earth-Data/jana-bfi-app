/**
 * IFRS S2 B62(b) gross exposure computation AND B62(a) financed emissions
 * disaggregation — funded carrying amount before loss allowance and absolute
 * gross financed emissions, both aggregated per industry per asset class.
 *
 * Per *IFRS Sustainability Disclosure Standard IFRS S2 Climate-related
 * Disclosures* (June 2023), paragraph B62 "Disclosure of financed emissions"
 * requires a bank to disclose:
 *
 *   (a) **Absolute gross financed emissions** disaggregated by:
 *       - asset classes
 *       - industry (based on IFRS classification or other industry systems)
 *       - for business-loan asset classes, size of investee/counterparty
 *       - for mortgage asset classes, energy-efficiency rating
 *   (b) **Gross exposure** per industry per asset class, funded carrying
 *       amount before loss allowance, in presentation currency
 *
 * This module serves BOTH requirements via a single industry × asset-class
 * matrix that includes gross exposure USD AND attributed CO2e tonnes per cell.
 *
 * B62(b) and B62(c) note that gross exposure is the **funded carrying amount
 * before loss allowance**, not the net carrying amount after impairment
 * provisions. This module computes:
 *
 *     gross exposure USD = outstanding USD + loss allowance USD - risk mitigants USD
 *
 * and aggregates that amount plus financed emissions into an industry × asset-class matrix.
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
 * Compute the gross exposure (funded carrying amount before loss allowance,
 * less risk mitigants if excluded) for a single loan, per IFRS S2 B62(b) and (c)(ii).
 *
 * Formula:
 *     outstanding USD + loss allowance USD - risk mitigant value USD
 *
 * Per B62(c)(ii), an entity shall disclose whether it has excluded risk mitigants
 * (collateral, guarantees, credit insurance) from its gross exposure calculation.
 * When `riskMitigantValueUsd` is provided, it is subtracted from the gross exposure.
 * This reduces the bank's reported climate risk exposure to reflect secured positions.
 *
 * If `lossAllowance` or `riskMitigantValueUsd` are undefined, they default to zero.
 * Demo mode seeds ~2% loss allowance and collateral on ~30% of loans to demonstrate
 * the full disclosure logic.
 */
export function grossExposureUsd(loan: Loan): number {
  return (
    loan.outstandingUsd +
    (loan.lossAllowance ?? 0) -
    (loan.riskMitigantValueUsd ?? 0)
  );
}

/**
 * A single cell in the industry × asset-class matrix serving both B62(a) and B62(b).
 * Each cell contains gross exposure (B62(b)) AND financed emissions (B62(a)) for
 * one industry × asset-class combination.
 */
export type GrossExposureCell = {
  /** Industry key (NRB sector or Climate TRACE facility sector) */
  industry: string;
  /** PCAF asset class (PCAF Part A 3rd Edition §5.1-§5.10) */
  assetClass: PcafAssetClass;
  /** Sum of gross exposure USD across all loans in this cell (B62(b)) */
  grossExposureUsd: number;
  /** Number of loans contributing to this cell */
  loanCount: number;
  /**
   * Sum of attributed CO2e tonnes for this cell (B62(a) financed emissions disaggregation).
   * Optional for type safety (cells with zero attributions won't have emissions), but in
   * practice always present since computeGrossExposureMatrix() filters out loans without
   * attributions before creating cells.
   */
  attributedCo2eTonnes?: number;
  /**
   * Sum of attributed Scope 1 emissions (direct) in CO2e tonnes for this cell.
   * Per IFRS S2 B62(a), financed emissions must be disaggregated by Scope 1/2/3 for each
   * industry × asset class combination.
   * Optional - when undefined, scope split is not available for this cell.
   */
  attributedScope1Co2eTonnes?: number;
  /**
   * Sum of attributed Scope 2 emissions (indirect, purchased energy) in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  attributedScope2Co2eTonnes?: number;
  /**
   * Sum of attributed Scope 3 emissions (other indirect) in CO2e tonnes.
   * Optional - when undefined, scope split is not available.
   */
  attributedScope3Co2eTonnes?: number;
};

/**
 * The full industry × asset-class matrix, per IFRS S2 B62(a) and B62(b).
 * Serves dual purpose:
 * - B62(a): Absolute gross financed emissions disaggregation by industry × asset class
 * - B62(b): Gross exposure disaggregation by industry × asset class
 *
 * Rows are sorted by descending `grossExposureUsd` so the largest exposures
 * appear first in disclosure tables.
 */
export type GrossExposureMatrix = GrossExposureCell[];

/**
 * Compute the IFRS S2 B62(a) + B62(b) industry × asset-class matrix:
 * - B62(a): Absolute gross financed emissions disaggregation
 * - B62(b): Gross exposure disaggregation (funded carrying amount before loss allowance)
 *
 * @param loans - All loans in the portfolio
 * @param borrowers - All borrowers (needed for industry classification)
 * @param attributions - PCAF attributions (needed for asset-class routing and CO2e tonnes)
 * @returns Industry × asset-class matrix sorted by descending gross exposure, with both
 *          gross exposure USD and attributed CO2e tonnes per cell
 *
 * Each loan contributes to exactly one cell: the cell keyed by
 * `(borrower.nrbSector, attribution.pcafAssetClass)`. Loans with no attribution
 * are excluded (out-of-scope retail loans).
 *
 * This function serves BOTH B62(a) and B62(b) requirements in a single matrix,
 * since both require the same industry × asset-class disaggregation.
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
      attributedScope1Co2eTonnes: number;
      attributedScope2Co2eTonnes: number;
      attributedScope3Co2eTonnes: number;
      hasScopeData: boolean; // Track if ANY attribution in this cell has scope data
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

    const hasScopeData =
      attr.attributedScope1Co2eTonnes !== undefined ||
      attr.attributedScope2Co2eTonnes !== undefined ||
      attr.attributedScope3Co2eTonnes !== undefined;

    const existing = cellMap.get(key);
    if (existing) {
      existing.grossExposureUsd += grossExposureUsd(loan);
      existing.loanCount += 1;
      existing.attributedCo2eTonnes += attr.attributedCo2eTonnes;
      // Accumulate scope emissions when available
      existing.attributedScope1Co2eTonnes += attr.attributedScope1Co2eTonnes ?? 0;
      existing.attributedScope2Co2eTonnes += attr.attributedScope2Co2eTonnes ?? 0;
      existing.attributedScope3Co2eTonnes += attr.attributedScope3Co2eTonnes ?? 0;
      existing.hasScopeData = existing.hasScopeData || hasScopeData;
    } else {
      cellMap.set(key, {
        industry,
        assetClass,
        grossExposureUsd: grossExposureUsd(loan),
        loanCount: 1,
        attributedCo2eTonnes: attr.attributedCo2eTonnes,
        attributedScope1Co2eTonnes: attr.attributedScope1Co2eTonnes ?? 0,
        attributedScope2Co2eTonnes: attr.attributedScope2Co2eTonnes ?? 0,
        attributedScope3Co2eTonnes: attr.attributedScope3Co2eTonnes ?? 0,
        hasScopeData,
      });
    }
  }

  // Convert map to array, map to final type, and sort by descending gross exposure
  const matrix = Array.from(cellMap.values())
    .map((cell) => ({
      industry: cell.industry,
      assetClass: cell.assetClass,
      grossExposureUsd: cell.grossExposureUsd,
      loanCount: cell.loanCount,
      attributedCo2eTonnes: cell.attributedCo2eTonnes,
      // Only include scope fields if at least one attribution in this cell has scope data
      // Otherwise leave undefined to signal "scope split not available"
      ...(cell.hasScopeData
        ? {
            attributedScope1Co2eTonnes: cell.attributedScope1Co2eTonnes,
            attributedScope2Co2eTonnes: cell.attributedScope2Co2eTonnes,
            attributedScope3Co2eTonnes: cell.attributedScope3Co2eTonnes,
          }
        : {}),
    }))
    .sort((a, b) => b.grossExposureUsd - a.grossExposureUsd);

  return matrix;
}
