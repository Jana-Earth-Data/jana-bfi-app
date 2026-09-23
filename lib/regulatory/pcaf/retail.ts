/**
 * Retail-pool Score-5 emissions proxy — the sector-average intensity used to
 * estimate financed emissions on the retail book (mortgages, personal,
 * education, vehicle loans), where no borrower-specific emissions data exists.
 *
 * PCAF BASIS. PCAF Part A 3rd Edition permits a Score-5 economic-activity /
 * revenue proxy for asset classes without borrower-specific data — §5.5
 * (mortgages) and §5.6 (motor vehicles). The method is:
 *
 *     attributed emissions = outstanding amount × sector-average intensity
 *
 * with an attribution factor of 1.0 (the bank fully finances a retail loan).
 *
 * ⚠️ PROVENANCE — READ BEFORE RELYING ON THIS NUMBER.
 * ------------------------------------------------------------------------
 * {@link RETAIL_TCO2E_PER_NPR} is an **ILLUSTRATIVE DEMONSTRATION ASSUMPTION,
 * NOT A SOURCED EMISSIONS FACTOR.** It is a plausible-order-of-magnitude
 * placeholder chosen so the demo can show a complete, PCAF-shaped disclosure
 * (including a populated Score-5 band) end to end. It is **not** derived from a
 * published Nepal retail-sector intensity and MUST NOT be presented to a
 * regulator or a real bank's stakeholders as a defensible factor.
 *
 * Before this platform discloses a real bank's retail financed emissions, this
 * value must either be (a) DERIVED from a citable published intensity (a
 * national mortgage/vehicle emissions-per-unit-of-lending figure, with the
 * source and vintage recorded here the way {@link
 * ../fx/rates} records the FX rate), or (b) the retail book must be EXCLUDED
 * from the disclosed total with an explicit "retail excluded — no
 * borrower-specific data" note. Until then, everything downstream of this
 * constant is illustrative.
 *
 * This constant lives in `lib/regulatory` (not `lib/demo`) because it is a
 * disclosure-arithmetic policy input shared by both providers: the demo
 * synthesizer and, when retail data eventually flows, the live path. Keeping it
 * here — with this provenance note attached — is what makes its illustrative
 * status auditable rather than buried in a comment next to a tuned literal
 * (backlog N0.5).
 */

/**
 * Retail sector-average emissions intensity, tCO₂e per NPR of outstanding.
 *
 * ILLUSTRATIVE DEMO ASSUMPTION — see the module header. Not a sourced factor.
 *
 * Applied as `outstandingNpr × RETAIL_TCO2E_PER_NPR` for every retail-pool
 * loan (attribution factor 1.0, PCAF data-quality Score 5).
 */
export const RETAIL_TCO2E_PER_NPR = 6e-6;

/** Short citation surfaced next to retail-proxy attributions. */
export const RETAIL_PROXY_CITATION =
  "PCAF Part A 3rd Edition §5.5 / §5.6 — economic-activity-based proxy (illustrative demo intensity)";

/**
 * Attributed emissions (tCO₂e) for one retail-pool loan under the Score-5
 * revenue/economic-activity proxy. Attribution factor is 1.0 (the bank fully
 * finances a retail loan), so this is simply outstanding × intensity.
 *
 * NB: uses the ILLUSTRATIVE {@link RETAIL_TCO2E_PER_NPR} — see module header.
 */
export function retailProxyEmissionsTonnes(outstandingNpr: number): number {
  return outstandingNpr * RETAIL_TCO2E_PER_NPR;
}
