/**
 * PCAF attribution-factor computation — the single source of truth for the
 * loan-share and enterprise-value floor used by every aggregator.
 *
 * Derived from *PCAF Global GHG Accounting and Reporting Standard, Part A:
 * Financed Emissions*, Third Edition (Dec 2025 / release 15 Jan 2026), §4.2
 * "Attribution of emissions". For business loans and unlisted equity the
 * attribution factor is
 *
 *     attribution factor = outstanding amount / enterprise value including cash (EVIC)
 *
 * and the borrower's financed emissions are that factor times the borrower's
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

import type { Borrower } from "@/lib/types/bfi";

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
