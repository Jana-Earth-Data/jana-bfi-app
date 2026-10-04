/**
 * PCAF attribution-factor computation — the single source of truth for the
 * loan-share and per-asset-class attribution denominators used by every aggregator.
 *
 * Derived from *PCAF Global GHG Accounting and Reporting Standard, Part A:
 * Financed Emissions*, Third Edition (Dec 2025 / release 15 Jan 2026), §4.2
 * "Attribution of emissions" and §5.1–§5.6 asset-class-specific guidance.
 *
 * The attribution factor is:
 *
 *     attribution factor = outstanding amount / denominator
 *
 * where the **denominator varies by PCAF §5 asset class** (N1.9):
 *
 *   - §5.1 Listed equity/bonds: EVIC (Enterprise Value Including Cash)
 *   - §5.2 Business loans: Total equity + total debt (balance-sheet basis)
 *   - §5.3 Project finance: Total project cost
 *   - §5.4/§5.5 CRE/Mortgages: Property value at origination
 *   - §5.6 Motor vehicles: Vehicle value at origination
 *
 * The borrower's financed emissions are that factor times the borrower's
 * total emissions.
 *
 * WHY A FLOOR AT ALL. PCAF §4.2 assumes a genuine EVIC observed from market
 * data. In this platform some borrowers carry a synthesized or thinly-sourced
 * enterprise value; without a floor a near-zero EV would drive the attribution
 * factor above 100 %, which is nonsensical (a bank cannot finance more than
 * the whole company). The floor is a guard rail on the *denominator*, not a
 * change to the PCAF formula — it never lowers a legitimately observed EVIC,
 * it only prevents a degenerate near-zero one.
 *
 * WHY TWO TIERS. Facility-tier borrowers (cement, hydropower, industrial —
 * anything with physical facilities) are large corporates whose EVIC is at
 * least on the order of USD 1M; a facility-tier EV below that is a data
 * artefact, so we floor at USD 1,000,000. Non-facility borrowers (SME
 * sector-benchmark tier) are smaller by construction, so a proportionate
 * floor of USD 50,000 applies. In practice the catalog assigns facility-tier
 * EVs well above USD 5M (cement ≥ 5M, hydropower ≥ 8M, industrial 40–200M),
 * so the facility floor is dormant on the current book — it exists to keep the
 * denominator honest if a future ingest supplies a smaller EV.
 *
 * ONE COMPUTATION, TWO PROVIDERS. Both the demo aggregator
 * (`lib/demo/portfolio.ts`) and the live re-overlay aggregator
 * (`lib/api/bfi.ts`) call {@link pcafAttributionFactor}. Neither carries its
 * own floor literal — that is exactly the duplication N0.2 removes. The policy
 * (the two floor constants and the tiering rule) lives here, cited, once.
 */

import type { Borrower, Loan } from "@/lib/types/bfi";
import type { PcafAssetClass } from "./types";

/**
 * Minimum enterprise value (USD) for a facility-tier borrower — one with at
 * least one physical facility. PCAF Part A 3rd Edition §4.2 (attribution
 * denominator guard). See module header for the rationale.
 */
export const PCAF_EV_FLOOR_FACILITY_USD = 1_000_000;

/**
 * Minimum enterprise value (USD) for a non-facility borrower (SME
 * sector-benchmark tier). PCAF Part A 3rd Edition §4.2 (attribution
 * denominator guard). See module header for the rationale.
 */
export const PCAF_EV_FLOOR_NON_FACILITY_USD = 50_000;

/** Short citation surfaced next to attribution numbers in tooltips/exports. */
export const PCAF_ATTRIBUTION_CITATION =
  "PCAF Part A 3rd Edition §4.2 — outstanding / EVIC attribution";

// ---------------------------------------------------------------------------
// Per-asset-class attribution denominators (N1.9)
// ---------------------------------------------------------------------------

/**
 * Denominator type identifier — describes which PCAF §5 denominator was used.
 * Maps to human-readable labels for UI hints (e.g., "loan outstanding ÷ equity + debt").
 */
export type DenominatorType =
  | "equity-plus-debt"          // §5.2 business loans (equity + debt from balance sheet)
  | "project-cost"              // §5.3 project finance (total project cost)
  | "property-value"            // §5.4 CRE / §5.5 mortgages (property value at origination)
  | "vehicle-value"             // §5.6 motor vehicles (vehicle value at origination)
  | "enterprise-value"          // §5.1 listed equity/bonds (EVIC) OR fallback for any class
  | "out-of-scope";             // no denominator (loan not in PCAF Cat. 15)

/**
 * The result of selecting a PCAF attribution denominator for a loan.
 * Returned by {@link attributionDenominatorUsd} to provide both the value
 * and metadata about which denominator was used (for UI hints and audit trails).
 */
export type AttributionDenominator = {
  /** The denominator value in USD (after floors applied) */
  denominatorUsd: number;
  /** Which type of denominator was used */
  denominatorType: DenominatorType;
  /** Human-readable label for UI hints (e.g., "Outstanding ÷ Equity + Debt") */
  denominatorLabel: string;
  /** PCAF §5 citation for this denominator type */
  citation: string;
};

/**
 * Select the PCAF Part A §5 attribution denominator for a loan based on asset class.
 *
 * Per PCAF Part A 3rd Edition §4.2 and §5.1–§5.6, different asset classes use
 * different attribution denominators:
 *
 * - **§5.1 Listed equity/corporate bonds:** EVIC (Enterprise Value Including Cash)
 * - **§5.2 Business loans/unlisted equity:** Total equity + total debt (balance-sheet basis)
 * - **§5.3 Project finance:** Total project cost (equity + debt at project level)
 * - **§5.4 Commercial real estate / §5.5 Mortgages:** Property value at origination
 * - **§5.6 Motor vehicle loans:** Vehicle value at origination
 *
 * **Fallback logic:** Per PCAF §4.2 ("Fallback allowed to total balance sheet (assets)
 * if debt/equity split not obtainable"), when the asset-class-specific denominator is
 * unavailable (field is undefined), falls back to borrower's `enterpriseValueUsd`. This
 * keeps the calculation functional while signaling via `denominatorType` that the ideal
 * denominator was not available.
 *
 * **Floor application:** All denominators pass through {@link flooredEnterpriseValueUsd}
 * to prevent degenerate near-zero values from producing >100% attribution factors.
 *
 * @param loan - The loan being attributed
 * @param borrower - The borrower receiving the loan
 * @param assetClass - The PCAF §5 asset class (from assetClassForLoanCategory)
 * @returns Denominator value + metadata for UI hints and audit trails
 */
export function attributionDenominatorUsd(
  loan: Loan,
  borrower: Borrower,
  assetClass: PcafAssetClass,
): AttributionDenominator {
  // Out-of-scope loans have no denominator (not in PCAF Cat. 15)
  if (assetClass === "out-of-scope") {
    return {
      denominatorUsd: 0,
      denominatorType: "out-of-scope",
      denominatorLabel: "N/A (out of scope)",
      citation: "PCAF Part A — out of PCAF Cat. 15 scope",
    };
  }

  // §5.2 Business loans / unlisted equity: equity + debt (balance-sheet basis)
  if (assetClass === "business-loans-unlisted-equity") {
    if (
      borrower.totalEquityUsd !== undefined &&
      borrower.totalDebtUsd !== undefined
    ) {
      const rawDenom = borrower.totalEquityUsd + borrower.totalDebtUsd;
      const floor =
        borrower.facilities.length > 0
          ? PCAF_EV_FLOOR_FACILITY_USD
          : PCAF_EV_FLOOR_NON_FACILITY_USD;
      return {
        denominatorUsd: Math.max(floor, rawDenom),
        denominatorType: "equity-plus-debt",
        denominatorLabel: "Outstanding ÷ (Equity + Debt)",
        citation: "PCAF Part A 3rd Edition §5.2 — equity + debt attribution",
      };
    }
    // Fallback: equity + debt not available → use enterprise value
    return {
      denominatorUsd: flooredEnterpriseValueUsd(borrower),
      denominatorType: "enterprise-value",
      denominatorLabel: "Outstanding ÷ Enterprise Value (fallback)",
      citation:
        "PCAF Part A 3rd Edition §4.2 — enterprise value fallback (equity/debt split not available)",
    };
  }

  // §5.3 Project finance: total project cost
  if (assetClass === "project-finance") {
    if (loan.projectCostUsd !== undefined) {
      const floor =
        borrower.facilities.length > 0
          ? PCAF_EV_FLOOR_FACILITY_USD
          : PCAF_EV_FLOOR_NON_FACILITY_USD;
      return {
        denominatorUsd: Math.max(floor, loan.projectCostUsd),
        denominatorType: "project-cost",
        denominatorLabel: "Outstanding ÷ Total Project Cost",
        citation:
          "PCAF Part A 3rd Edition §5.3 — project cost attribution",
      };
    }
    // Fallback: project cost not available → use borrower's enterprise value (the SPV's value)
    return {
      denominatorUsd: flooredEnterpriseValueUsd(borrower),
      denominatorType: "enterprise-value",
      denominatorLabel: "Outstanding ÷ Enterprise Value (fallback)",
      citation:
        "PCAF Part A 3rd Edition §4.2 — enterprise value fallback (project cost not available)",
    };
  }

  // §5.5 Mortgages: property value at origination
  if (assetClass === "mortgages") {
    if (loan.propertyValueUsd !== undefined) {
      const floor = PCAF_EV_FLOOR_NON_FACILITY_USD; // Residential properties use non-facility floor
      return {
        denominatorUsd: Math.max(floor, loan.propertyValueUsd),
        denominatorType: "property-value",
        denominatorLabel: "Outstanding ÷ Property Value",
        citation:
          "PCAF Part A 3rd Edition §5.5 — property value attribution",
      };
    }
    // Fallback: property value not available → use enterprise value
    return {
      denominatorUsd: flooredEnterpriseValueUsd(borrower),
      denominatorType: "enterprise-value",
      denominatorLabel: "Outstanding ÷ Enterprise Value (fallback)",
      citation:
        "PCAF Part A 3rd Edition §4.2 — enterprise value fallback (property value not available)",
    };
  }

  // §5.6 Motor vehicle loans: vehicle value at origination
  if (assetClass === "motor-vehicle-loans") {
    if (loan.vehicleValueUsd !== undefined) {
      const floor = PCAF_EV_FLOOR_NON_FACILITY_USD; // Vehicles use non-facility floor
      return {
        denominatorUsd: Math.max(floor, loan.vehicleValueUsd),
        denominatorType: "vehicle-value",
        denominatorLabel: "Outstanding ÷ Vehicle Value",
        citation:
          "PCAF Part A 3rd Edition §5.6 — vehicle value attribution",
      };
    }
    // Fallback: vehicle value not available → use enterprise value
    return {
      denominatorUsd: flooredEnterpriseValueUsd(borrower),
      denominatorType: "enterprise-value",
      denominatorLabel: "Outstanding ÷ Enterprise Value (fallback)",
      citation:
        "PCAF Part A 3rd Edition §4.2 — enterprise value fallback (vehicle value not available)",
    };
  }

  // §5.1 Listed equity/corporate bonds / §5.4 Commercial real estate / any other class:
  // Use enterprise value (EVIC for listed; balance-sheet for unlisted)
  return {
    denominatorUsd: flooredEnterpriseValueUsd(borrower),
    denominatorType: "enterprise-value",
    denominatorLabel: "Outstanding ÷ Enterprise Value",
    citation: "PCAF Part A 3rd Edition §4.2 — enterprise value attribution",
  };
}

/**
 * Apply the PCAF §4.2 attribution-denominator floor to a borrower's
 * enterprise value.
 *
 * Facility-tier borrowers (`facilities.length > 0`) floor at
 * {@link PCAF_EV_FLOOR_FACILITY_USD}; all others floor at
 * {@link PCAF_EV_FLOOR_NON_FACILITY_USD}. Never lowers a legitimately larger
 * EVIC — the floor only binds when the supplied value is degenerate.
 */
export function flooredEnterpriseValueUsd(borrower: Borrower): number {
  const floor =
    borrower.facilities.length > 0
      ? PCAF_EV_FLOOR_FACILITY_USD
      : PCAF_EV_FLOOR_NON_FACILITY_USD;
  return Math.max(floor, borrower.enterpriseValueUsd);
}

/**
 * PCAF Part A §4.2 attribution factor for a loan:
 *
 *     outstanding USD / floored enterprise value USD
 *
 * The denominator is {@link flooredEnterpriseValueUsd} so a degenerate
 * near-zero EV cannot produce a >100 % share. Multiply the result by the
 * borrower's total emissions to obtain the financed (attributed) emissions.
 */
export function pcafAttributionFactor(
  outstandingUsd: number,
  borrower: Borrower,
): number {
  return outstandingUsd / flooredEnterpriseValueUsd(borrower);
}
