/**
 * Reporting period — the sanctioned, single source of the disclosure boundary
 * (N0.7).
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * A financed-emissions disclosure is anchored to a reporting period: which
 * years the trend covers, which year is the "most recent fully-reported" year a
 * bank cites in its annual NFRS figure, which trailing year is only partial, and
 * the "as of" date the whole statement is prepared to. NFRS/IFRS S1 §24 and the
 * NRB Green Finance Statement (Annex 4b) both require a stated, consistent
 * as-of; two surfaces disagreeing on it is not a cosmetic bug, it is two
 * different disclosures.
 *
 * Before N0.7 the boundary was re-typed independently in four places — the YoY
 * filter and the KPI card and the disclosure narrative each hardcoded
 * `year < 2025` / `"2024"`, the trend chart hardcoded `partialFromYear = 2025`,
 * and the demo synthesizer pinned an unrelated forward `AS_OF_DATE` of
 * `2026-05-01` that contradicted the `/api/pcaf/scores` docstring example
 * (`2025-10-31`). That divergence is finding N0.7 (GA §6.5): a disclosure
 * primitive with four uncoordinated definitions. Per the "one computation, two
 * providers" principle (backlog §0) the period is regulatory policy, so it
 * belongs here — defined once, reviewed as policy, and shared by BOTH the demo
 * and the live provider. `lib/reporting/periods.ts` now re-exports from this
 * module so no call site changes and the year values are unchanged
 * (arithmetic-neutral: PR0-b keeps the goldens frozen).
 *
 * WHAT A LIVE DEPLOYMENT DOES
 * ---------------------------
 * A live bank derives TenantConfig.reportingPeriod from what has actually been
 * ingested: the span of Climate TRACE / EDGAR coverage in its own database sets
 * trendYears, the last complete calendar year sets latestFullYear, and the
 * ingest high-water mark sets latestYear / the partial-through month and the
 * as-of date. Demo tenants leave reportingPeriod undefined and fall back to the
 * pinned FY2024/25 constants below. See {@link trendYearsForTenant},
 * {@link asOfDateForTenant}, and related helpers (N1.13) for the selection logic.
 */

/**
 * Years the platform builds emissions and financed-emissions trends for.
 * Matches Climate TRACE Nepal coverage: earliest 2021-01, latest 2025-10.
 *
 * Per N1.13: A live deployment derives this from ingested coverage via
 * TenantConfig.reportingPeriod. When undefined, this constant is the fallback.
 * Use {@link trendYearsForTenant} to get the effective years for a tenant.
 */
export const TREND_YEARS = [2021, 2022, 2023, 2024, 2025] as const;

/**
 * Most recent fully-reported year — the one a bank cites in its annual NFRS
 * disclosure. Distinct from {@link LATEST_YEAR} because a partial year cannot
 * carry an annual figure. Every "most recent fully-reported year" surface reads
 * this, so the KPI card, the YoY comparison, and the disclosure narrative can
 * never drift apart.
 */
export const LATEST_FULL_YEAR = 2024;

/** Latest year with any data at all. May be partial; see {@link LATEST_YEAR_PARTIAL_THROUGH}. */
export const LATEST_YEAR = 2025;

/**
 * How far into {@link LATEST_YEAR} the data runs. Surfaced in the UI so a reader
 * does not mistake a partial year for a decline.
 */
export const LATEST_YEAR_PARTIAL_THROUGH = "October";

/** Month-end (1-based month, ISO day) that {@link LATEST_YEAR_PARTIAL_THROUGH}
 *  resolves to. October → 10 / 31. Kept alongside the label so the as-of date
 *  below and the human label can never disagree. */
const LATEST_YEAR_PARTIAL_MONTH = 10;
const LATEST_YEAR_PARTIAL_DAY = 31;

/**
 * The reporting-period "as of" date the disclosure is prepared to: the last day
 * of ingested coverage (LATEST_YEAR, through the partial month). This is the
 * value that reaches `meta.asOfDate`, the NRB Green Finance Statement header,
 * and the `/api/pcaf/scores` response — so the docstring example (2025-10-31)
 * and the runtime value now agree. Derived from the year + partial month above
 * so it cannot drift from the trend range.
 */
export const AS_OF_DATE = `${LATEST_YEAR}-${String(LATEST_YEAR_PARTIAL_MONTH).padStart(2, "0")}-${String(LATEST_YEAR_PARTIAL_DAY).padStart(2, "0")}`;

/**
 * True when `year` is only partially covered — the trailing coverage year that
 * cannot carry an annual figure. Any surface that must exclude the partial year
 * (YoY, the annual disclosure narrative) or annotate it (the trend chart's
 * partial-year shading) asks here instead of re-typing `year >= 2025`.
 */
export function isPartialYear(year: number): boolean {
  return year >= LATEST_YEAR;
}

/**
 * True when `year` is a complete, annually-reportable year (i.e. not the
 * trailing partial year). The complement of {@link isPartialYear}, named for
 * the common "keep only fully-reported years" filter.
 */
export function isFullyReportedYear(year: number): boolean {
  return !isPartialYear(year);
}

/**
 * Get the effective trend years for a tenant.
 * Returns tenant.reportingPeriod.trendYears if configured, otherwise falls back
 * to TREND_YEARS constant. Added for N1.13.
 *
 * @param tenant - Optional tenant configuration with reportingPeriod.
 * @returns The trend years to use for this tenant's disclosures.
 */
export function trendYearsForTenant(tenant?: {
  reportingPeriod?: { readonly trendYears: readonly number[] };
}): readonly number[] {
  return tenant?.reportingPeriod?.trendYears ?? TREND_YEARS;
}

/**
 * Get the effective latest full year for a tenant.
 * Returns tenant.reportingPeriod.latestFullYear if configured, otherwise falls
 * back to LATEST_FULL_YEAR constant. Added for N1.13.
 *
 * @param tenant - Optional tenant configuration with reportingPeriod.
 * @returns The latest full year to use for this tenant's disclosures.
 */
export function latestFullYearForTenant(tenant?: {
  reportingPeriod?: { readonly latestFullYear: number };
}): number {
  return tenant?.reportingPeriod?.latestFullYear ?? LATEST_FULL_YEAR;
}

/**
 * Get the effective latest year for a tenant.
 * Returns tenant.reportingPeriod.latestYear if configured, otherwise falls back
 * to LATEST_YEAR constant. Added for N1.13.
 *
 * @param tenant - Optional tenant configuration with reportingPeriod.
 * @returns The latest year (may be partial) to use for this tenant.
 */
export function latestYearForTenant(tenant?: {
  reportingPeriod?: { readonly latestYear: number };
}): number {
  return tenant?.reportingPeriod?.latestYear ?? LATEST_YEAR;
}

/**
 * Get the effective partial-through description for a tenant.
 * Returns tenant.reportingPeriod.latestYearPartialThrough if reportingPeriod is
 * configured, otherwise falls back to LATEST_YEAR_PARTIAL_THROUGH constant.
 * If reportingPeriod is configured and latestYearPartialThrough is undefined,
 * returns undefined (year is complete). Added for N1.13.
 *
 * @param tenant - Optional tenant configuration with reportingPeriod.
 * @returns The partial-through description (e.g., "October") or undefined if year is complete.
 */
export function latestYearPartialThroughForTenant(tenant?: {
  reportingPeriod?: { readonly latestYearPartialThrough?: string };
}): string | undefined {
  // If tenant has reportingPeriod configured, use its latestYearPartialThrough
  // (which may be undefined for complete years)
  if (tenant?.reportingPeriod !== undefined) {
    return tenant.reportingPeriod.latestYearPartialThrough;
  }
  // Otherwise fall back to constant
  return LATEST_YEAR_PARTIAL_THROUGH;
}

/**
 * Get the effective as-of date for a tenant.
 * Returns tenant.reportingPeriod.asOfDate if configured, otherwise falls back to
 * AS_OF_DATE constant. Added for N1.13.
 *
 * @param tenant - Optional tenant configuration with reportingPeriod.
 * @returns The as-of date (ISO YYYY-MM-DD) for this tenant's disclosures.
 */
export function asOfDateForTenant(tenant?: {
  reportingPeriod?: { readonly asOfDate: string };
}): string {
  return tenant?.reportingPeriod?.asOfDate ?? AS_OF_DATE;
}
