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
 * A live bank derives this period from what has actually been ingested: the
 * span of Climate TRACE / EDGAR coverage in its own database sets TREND_YEARS,
 * the last complete calendar year sets LATEST_FULL_YEAR, and the ingest
 * high-water mark sets LATEST_YEAR / the partial-through month and the as-of
 * date. The demo pins the FY2024/25 coverage below. The shape is identical;
 * only the data differs.
 */

/**
 * Years the platform builds emissions and financed-emissions trends for.
 * Matches Climate TRACE Nepal coverage: earliest 2021-01, latest 2025-10.
 * A live deployment derives this from ingested coverage rather than pinning it.
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
