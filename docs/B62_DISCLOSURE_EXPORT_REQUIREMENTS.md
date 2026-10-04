# B62 Disclosure Export Requirements

**Date:** 2026-10-03
**Context:** N1.14 Phase 4 — documenting export requirements for IFRS S2 B62 disclosures

## Overview

As of N1.14 Phases 1-3, all IFRS S2 B62(a)-(d), B55-B56, and B27 disclosures are **displayed on the NFRS tab** via interactive UI components. This document specifies how these disclosures should appear in Excel and PDF exports when NFRS-specific export endpoints are implemented.

## Current State

### Implemented (UI Components)
All B62 disclosure outputs are computed in `lib/regulatory/pcaf/*` and displayed via components in `components/bfi/shared/b62-disclosures/`:

1. **Gross Exposure Matrix** (`gross-exposure-matrix.tsx`) — IFRS S2 B62(a)(b)
   - Industry × asset-class matrix
   - Gross exposure in NPR (presentation currency)
   - Total financed emissions per cell
   - Interactive table with expandable rows

2. **Coverage Disclosure** (`coverage-disclosure.tsx`) — IFRS S2 B62(c)
   - Percentage of gross exposure included in measurement
   - Excluded asset types listed
   - Risk mitigant exclusion note

3. **Methodology Disclosure** (`methodology-disclosure.tsx`) — IFRS S2 B62(d)
   - PCAF option distribution (1a-3c)
   - Attribution denominator breakdown
   - Data quality score distribution
   - Data sources and asset classes

4. **Data Extent Disclosure** (`data-extent-disclosure.tsx`) — IFRS S2 B55-B56
   - Primary-activity data coverage (PCAF options 2a/2b)
   - Verified data coverage (PCAF option 1a)
   - Breakdown by loans, exposure, emissions

5. **Consolidation Approach** (`consolidation-approach.tsx`) — IFRS S2 B27
   - Equity-share vs control disclosure
   - Attribution formula
   - Reason for approach choice

### Not Yet Implemented
- **NFRS-specific export endpoints** (`/api/reports/nfrs-disclosure` or similar)
- Excel workbook generation for B62 disclosures
- PDF document generation for B62 disclosures

## Proposed Export Structure

### Excel Export (`/api/reports/nfrs-disclosure?format=xlsx`)

**Workbook Name:** `nfrs-s2-disclosure-YYYY-MM-DD.xlsx`

**Worksheets:**

1. **Summary** (1 page)
   - Bank name, reporting period, as-of date
   - Total financed emissions headline
   - Weighted average data quality score
   - Coverage percentage
   - Consolidation approach

2. **Gross Exposure Matrix** (B62(a)(b))
   - Industry (rows) × Asset Class (columns)
   - Each cell shows:
     - Gross exposure (NPR)
     - Attributed emissions (tCO₂e)
     - Loan count
   - Row/column totals
   - Currency and unit labels

3. **Coverage** (B62(c))
   - Total gross exposure
   - Included gross exposure
   - Coverage percentage
   - Excluded asset types (list)
   - Risk mitigants note

4. **Methodology** (B62(d))
   - PCAF option distribution table
   - Attribution denominator breakdown
   - Data quality score distribution
   - Data sources list
   - Asset classes represented

5. **Data Extent** (B55-B56)
   - Primary-activity data coverage
   - Verified data coverage
   - Breakdown by loans/exposure/emissions

6. **Consolidation** (B27)
   - Approach (equity-share or control)
   - Reason
   - Attribution formula

7. **Metadata**
   - FX rate and source
   - Reporting period
   - Computation timestamp
   - Software version

**Styling:**
- Bank's brand colors (from tenant config)
- IFRS S2 section references in headers
- Freeze panes on data tables
- Auto-fit columns

### PDF Export (`/api/reports/nfrs-disclosure?format=pdf`)

**Document Name:** `nfrs-s2-disclosure-YYYY-MM-DD.pdf`

**Structure:**

1. **Cover Page**
   - Bank logo
   - "IFRS S2 Climate-related Disclosures"
   - Reporting period
   - As-of date
   - Classification (e.g., "Internal Use Only")

2. **Executive Summary** (1-2 pages)
   - Total financed emissions
   - Coverage percentage
   - Data quality overview
   - Key findings

3. **B62(a)-(b) Gross Exposure Matrix** (1-2 pages)
   - Full industry × asset-class table
   - Footnotes for any "Not Provided" cells
   - Currency: NPR

4. **B62(c) Coverage Disclosure** (1 page)
   - KPI cards (coverage %, included/total exposure)
   - Excluded asset types
   - Risk mitigants note

5. **B62(d) Methodology Disclosure** (2-3 pages)
   - PCAF option distribution
   - Attribution denominators
   - Data quality scores
   - Data sources and asset classes

6. **B55-B56 Data Extent** (1 page)
   - Primary-activity data coverage
   - Verified data coverage

7. **B27 Consolidation Approach** (1 page)
   - Approach and reason
   - Attribution formula

8. **Appendices**
   - GICS 6-digit industry codes used
   - Emission factor sources
   - PCAF data quality definitions
   - Glossary of terms

**Styling:**
- Bank letterhead on each page
- Page numbers
- Table of contents
- Consistent typography (professional, readable)
- Sufficient white space for review annotations

### JSON Export (`/api/reports/nfrs-disclosure?format=json`)

**File Name:** `nfrs-s2-disclosure-YYYY-MM-DD.json`

**Structure:**
```json
{
  "metadata": {
    "bankName": "string",
    "reportingPeriodStart": "YYYY-MM-DD",
    "reportingPeriodEnd": "YYYY-MM-DD",
    "asOfDate": "YYYY-MM-DD",
    "generatedAt": "ISO 8601 timestamp",
    "standard": "IFRS S2",
    "currency": "NPR",
    "fxRate": {
      "nprPerUsd": 133.5,
      "asOf": "2024-07-15",
      "source": "NRB FY2023/24 close"
    }
  },
  "summary": {
    "totalAttributedCo2eTonnes": 9774371,
    "weightedDataQualityScore": 3.8,
    "coveragePercent": 0.95,
    "consolidationApproach": "equity-share"
  },
  "b62": {
    "grossExposureMatrix": { /* see lib/types/bfi.ts GrossExposureMatrixRow[] */ },
    "coverage": { /* see lib/types/bfi.ts GrossExposureCoverage */ },
    "methodology": { /* see lib/types/bfi.ts MethodologyDisclosure */ }
  },
  "b55b56": {
    "dataExtent": { /* see lib/types/bfi.ts DataExtentDisclosure */ }
  },
  "b27": {
    "consolidationApproach": { /* see lib/types/bfi.ts consolidationApproach */ }
  }
}
```

## Implementation Roadmap

### Phase 1: API Route Foundation
**Effort:** 0.5 days

Create `/app/api/reports/nfrs-disclosure/route.ts`:
- Accept `?format=json|xlsx|pdf` query parameter
- Auth via `requireCaptureClient()` (follows existing pattern)
- Fetch portfolio summary from provider
- Return JSON structure above

### Phase 2: Excel Generation
**Effort:** 1 day

- Install `exceljs` (already in dependencies for NRB exports)
- Create `lib/exports/nfrs-excel.ts` module
- Implement 7 worksheets per spec above
- Apply bank branding from tenant config
- Return binary workbook with proper MIME type

### Phase 3: PDF Generation
**Effort:** 1.5 days

- Install PDF library (e.g., `pdfkit` or reuse existing if available)
- Create `lib/exports/nfrs-pdf.ts` module
- Implement multi-page document per spec above
- Include bank letterhead/logo
- Return binary PDF with proper MIME type

### Phase 4: Export Button UI
**Effort:** 0.5 days

- Create `components/bfi/reports/nfrs-disclosure-export-button.tsx`
- Follow pattern from `NrbsisGreenStatementButton`
- Wire into NFRS tab
- Three-button UI (JSON / Excel / PDF)

**Total Effort:** ~3.5 days for full export implementation

## Current N1.14 Scope

**Phases 1-3 (Complete):**
- ✅ Gross exposure matrix component
- ✅ Coverage disclosure component
- ✅ Methodology disclosure component
- ✅ Data extent disclosure component
- ✅ Consolidation approach component
- ✅ All wired into NFRS tab as CollapsiblePanels

**Phase 4 (This Document):**
- ✅ Documented export requirements
- ⏳ Update gap analysis (next)
- ⏳ Update PROJECT_PLAN changelog (next)

**Future Work (Post-N1.14):**
Full NFRS export implementation per roadmap above should be scheduled as a separate task after N1.14 completes. The UI disclosure surface (NFRS tab) satisfies the immediate B62 disclosure requirement.

## References

- **IFRS S2** Climate-related Disclosures, Appendix B paragraphs B62, B55-B56, B27
- **N1.14** task in `PROJECT_PLAN.md` §4a
- **Type definitions** in `lib/types/bfi.ts` (lines 367-635)
- **Computation modules** in `lib/regulatory/pcaf/*`
- **Existing export patterns** in `app/api/reports/nrbsis-green-statement/route.ts`
