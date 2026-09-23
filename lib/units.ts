/**
 * Currency units and conversion.
 *
 * Extracted from lib/data/util.ts, which is the portfolio synthesizer's
 * toolbox and is moving under lib/demo/. These helpers are not demo
 * scaffolding -- three production UI components convert borrower enterprise
 * values for display -- so they belong in a module that survives a live
 * build.
 *
 * N0.6 (PR0-b): the FX rate itself is a regulatory policy input (a disclosed
 * figure depends on it, and S1 §24 requires it to be dated and sourced), so it
 * no longer lives here as a bare constant. It moved to
 * `lib/regulatory/fx/rates.ts` where it is reviewed as policy, carried on the
 * reporting period, and shared by both the demo and the live provider. This
 * module re-exports the rate and the conversion helpers so existing call sites
 * (loan-table, esrm-tab, nfrs-tab, the demo aggregator) are unchanged and the
 * numeric value stays identical — the move is arithmetic-neutral.
 */

export {
  NPR_PER_USD,
  REPORTING_FX_RATE,
  nprToUsd,
  usdToNpr,
  type FxRate,
} from "@/lib/regulatory/fx/rates";

/** Round to whole rupees. Amounts below one rupee are not meaningful here. */
export function roundNpr(npr: number): number {
  return Math.round(npr);
}
