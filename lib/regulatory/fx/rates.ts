/**
 * Foreign-exchange rates for disclosure — the sanctioned, dated home (N0.6).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A financed-emissions disclosure converts borrower enterprise values (held in
 * USD, from Climate TRACE / EDGAR) into the bank's presentation currency (NPR)
 * for every NRB / NFRS surface. IFRS/NFRS S1 §24 requires disclosures to use
 * the presentation currency of the related financial statements, and a
 * conversion is only auditable if it states BOTH the rate AND the date it was
 * observed — otherwise two reporting years are not comparable and a reader
 * cannot reproduce the figure.
 *
 * Previously the rate lived in `lib/units.ts` as an undated bare constant
 * (`NPR_PER_USD = 133.5`). That is finding N0.6 in the gap analysis (§6.4): an
 * undated policy constant reaching a disclosed figure, outside `lib/regulatory`.
 * Per the "one computation, two providers" principle (backlog §0) the rate is a
 * regulatory policy input, so it belongs here — reviewed as policy, cited to a
 * source, carried on the reporting period, and shared by BOTH the demo and the
 * live provider. `lib/units.ts` now re-exports from this module so no call site
 * changes and the numeric value is unchanged (arithmetic-neutral: PR0-b keeps
 * the goldens frozen).
 *
 * WHAT A LIVE DEPLOYMENT DOES
 * ---------------------------
 * A live bank sets `reportingFxRate` from its own books — the rate it used to
 * translate USD-denominated exposures in the financial statements the
 * disclosure sits alongside (typically the NRB reference rate at the fiscal-year
 * close). The demo pins the FY2024 rate below. The shape is identical; only the
 * data differs.
 */

/**
 * A dated FX observation. `asOf` and `source` are what make the rate
 * disclosable: a reader can look up the same reference and reproduce the
 * conversion (S1 §24 comparability).
 */
export interface FxRate {
  /** NPR per 1 USD. */
  readonly nprPerUsd: number;
  /** ISO date the rate was observed (YYYY-MM-DD). */
  readonly asOf: string;
  /** Human-readable provenance, cited on the disclosure. */
  readonly source: string;
}

/**
 * The rate carried on the demo's reporting period (FY2024).
 *
 * 133.5 NPR/USD is the Nepal Rastra Bank published reference (buying) rate
 * around the FY 2023/24 close (Ashadh end / mid-July 2024). Kept numerically
 * identical to the prior `NPR_PER_USD` constant so this move is arithmetic-
 * neutral; the change is that the value is now DATED and SOURCED. A live tenant
 * overrides this with the rate from its own financial statements.
 */
export const REPORTING_FX_RATE: FxRate = {
  nprPerUsd: 133.5,
  asOf: "2024-07-15",
  source:
    "Nepal Rastra Bank published reference exchange rate, FY 2023/24 close (Ashadh end).",
};

/**
 * Bare NPR-per-USD scalar for the current reporting period. Provided for call
 * sites that only need the number (UI display of enterprise value). Prefer
 * passing the full {@link FxRate} where the date/source must be disclosed.
 */
export const NPR_PER_USD = REPORTING_FX_RATE.nprPerUsd;

/** Convert NPR to USD at a given rate (defaults to the reporting-period rate). */
export function nprToUsd(npr: number, rate: FxRate = REPORTING_FX_RATE): number {
  return npr / rate.nprPerUsd;
}

/** Convert USD to NPR at a given rate (defaults to the reporting-period rate). */
export function usdToNpr(usd: number, rate: FxRate = REPORTING_FX_RATE): number {
  return usd * rate.nprPerUsd;
}
