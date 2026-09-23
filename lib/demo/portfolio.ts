/**
 * Deterministic ~80K-loan portfolio synthesizer for First Bank of Nepal.
 *
 * Strategy:
 *   - Retail bulk (~70K loans):     mortgage / personal / education / vehicle
 *   - SME middle (~8K loans):        working capital / trade / term — synthesized SME pool
 *   - Commercial slice (~2K loans):  rooted in real cement / hydro / industrial entities
 *   - Large corporate (~50 loans):   large syndicated and project finance to the top emitters
 *
 * The synthesizer is seeded so every run produces the same portfolio. The result
 * is cached in module scope and survives across requests within one server lifetime.
 *
 * For live mode (token present), the facility emissions on cement/hydro/industrial
 * borrowers are replaced with Climate TRACE values fetched from the Jana API.
 */

import {
  Borrower,
  BfiDemoData,
  Loan,
  LoanCategory,
  LoanStatus,
  NrbTaxonomyColor,
  PcafAttribution,
  PcafMethodology,
} from "@/lib/types/bfi";
import {
  SYNTH_ANCHOR_DATE,
  BRANCHES,
  isoDateOffsetDays,
  logUniform,
  mulberry32,
  pick,
  pickWeighted,
  rangeInt,
} from "@/lib/demo/synth-util";
import { nprToUsd, roundNpr, usdToNpr } from "@/lib/units";
import { AS_OF_DATE } from "@/lib/reporting/periods";
import { getBorrowerCatalog, SmeBorrower } from "@/lib/demo/entities";
import {
  assetClassForLoanCategory,
  computePcafScore,
  inferPcafAvailability,
} from "@/lib/regulatory/pcaf/scoring";
import { resolveAvailability } from "@/lib/regulatory/pcaf/evidence-matrix";
import { LATEST_FULL_YEAR } from "@/lib/regulatory/reporting/period";
import { demoPcafEvidenceRecords } from "@/lib/demo/pcaf-evidence-seed";
import { SCORE_FOR_OPTION } from "@/lib/regulatory/pcaf/types";
import { pcafAttributionFactor } from "@/lib/regulatory/pcaf/attribution";
import { summarise } from "@/lib/regulatory/pcaf/aggregation";
import {
  RETAIL_PROXY_CITATION,
  retailProxyEmissionsTonnes,
} from "@/lib/regulatory/pcaf/retail";

// ---------------------------------------------------------------------------
// Portfolio scale and mix
// ---------------------------------------------------------------------------

export const PORTFOLIO_SCALE = {
  retailMortgage: 50_000,
  retailPersonal: 12_000,
  retailEducation: 5_000,
  retailVehicle: 3_000,
  smeWorkingCapital: 5_000,
  smeTradeFinance: 2_500,
  smeTermLoan: 1_500,
  // Commercial and large corporate — sized so each of the ~121 facility-tier
  // borrowers receives a realistic 6-10 loans on average (term + working
  // capital + LC line + project finance, etc.), rather than the prior 17/avg.
  commercialTerm: 600,
  commercialWorkingCapital: 300,
  commercialProjectFinance: 100,
  corporateSyndicated: 20,
  corporateProjectFinance: 15,
} as const;

export const PORTFOLIO_TOTAL_COUNT = Object.values(PORTFOLIO_SCALE).reduce(
  (s, n) => s + n,
  0
);

// ---------------------------------------------------------------------------
// Loan amount distributions (in NPR)
// ---------------------------------------------------------------------------

const NPR_RANGES: Record<LoanCategory, [number, number]> = {
  "retail-mortgage": [2_000_000, 15_000_000],
  "retail-personal": [100_000, 2_000_000],
  "retail-education": [200_000, 3_000_000],
  "retail-vehicle": [500_000, 5_000_000],
  "sme-working-capital": [1_000_000, 50_000_000],
  "sme-trade-finance": [500_000, 25_000_000],
  "sme-term-loan": [5_000_000, 100_000_000],
  "commercial-term-loan": [50_000_000, 2_000_000_000],
  "commercial-working-capital": [25_000_000, 500_000_000],
  "commercial-project-finance": [200_000_000, 5_000_000_000],
  "corporate-syndicated": [1_000_000_000, 20_000_000_000],
  "corporate-project-finance": [500_000_000, 30_000_000_000],
};

const LOAN_PRODUCT_NAME: Record<LoanCategory, string> = {
  "retail-mortgage": "Home Loan",
  "retail-personal": "Personal Loan",
  "retail-education": "Education Loan",
  "retail-vehicle": "Auto Loan",
  "sme-working-capital": "SME Working Capital",
  "sme-trade-finance": "SME Trade Finance",
  "sme-term-loan": "SME Term Loan",
  "commercial-term-loan": "Commercial Term Loan",
  "commercial-working-capital": "Commercial Working Capital",
  "commercial-project-finance": "Project Finance",
  "corporate-syndicated": "Syndicated Facility",
  "corporate-project-finance": "Corporate Project Finance",
};

const BUSINESS_UNIT_FOR_CATEGORY: Record<LoanCategory, Loan["businessUnit"]> = {
  "retail-mortgage": "Retail",
  "retail-personal": "Retail",
  "retail-education": "Retail",
  "retail-vehicle": "Retail",
  "sme-working-capital": "SME",
  "sme-trade-finance": "SME",
  "sme-term-loan": "SME",
  "commercial-term-loan": "Corporate",
  "commercial-working-capital": "Corporate",
  "commercial-project-finance": "Project Finance",
  "corporate-syndicated": "Corporate",
  "corporate-project-finance": "Project Finance",
};

// ---------------------------------------------------------------------------
// Taxonomy assignment
// ---------------------------------------------------------------------------

function taxonomyForLoan(
  category: LoanCategory,
  borrower: Borrower
): NrbTaxonomyColor {
  if (
    category === "retail-mortgage" ||
    category === "retail-personal" ||
    category === "retail-education" ||
    category === "retail-vehicle"
  ) {
    return "unclassified";
  }

  const sector = borrower.nrbSector.toLowerCase();
  if (sector.includes("hydropower") || sector.includes("renewable")) {
    return "green";
  }
  if (
    sector.includes("cement") ||
    sector.includes("steel") ||
    sector.includes("brick") ||
    sector.includes("thermal")
  ) {
    return "red";
  }
  if (
    sector.includes("manufacturing") ||
    sector.includes("agriculture") ||
    sector.includes("textile") ||
    sector.includes("construction") ||
    sector.includes("chemical") ||
    sector.includes("plastic") ||
    sector.includes("processing") ||
    // Sectors added with the CT-matched non-mfg borrower expansion.
    // Per NRB Green Finance Taxonomy these are transition activities:
    // waste management contributes to pollution prevention, hospitality and
    // real estate touch energy and resource use, transport touches mitigation.
    sector.includes("transport") ||
    sector.includes("storage") ||
    sector.includes("hospitality") ||
    sector.includes("tourism") ||
    sector.includes("real estate") ||
    sector.includes("waste") ||
    sector.includes("utilities")
  ) {
    return "amber";
  }
  return "unclassified";
}

// ---------------------------------------------------------------------------
// Borrower selection helpers
// ---------------------------------------------------------------------------

function pickCommercialBorrower(
  catalog: ReturnType<typeof getBorrowerCatalog>,
  category: LoanCategory,
  r: () => number
): Borrower {
  // Project finance favours hydro + cement; working capital favours industrial +
  // hotels/logistics/waste; syndicated favours the big emitters.
  const weights = (() => {
    switch (category) {
      case "commercial-project-finance":
      case "corporate-project-finance":
        return [
          { value: "hydro", weight: 5 },
          { value: "cement", weight: 4 },
          { value: "industrial", weight: 1 },
          { value: "ctNonMfg", weight: 2 },
        ];
      case "corporate-syndicated":
        return [
          { value: "cement", weight: 5 },
          { value: "hydro", weight: 3 },
          { value: "industrial", weight: 2 },
          { value: "ctNonMfg", weight: 2 },
        ];
      default:
        return [
          { value: "cement", weight: 3 },
          { value: "hydro", weight: 2 },
          { value: "industrial", weight: 3 },
          { value: "ctNonMfg", weight: 4 },
        ];
    }
  })();
  const tier = pickWeighted(weights, r);
  if (tier === "cement") return pick(catalog.cement, r);
  if (tier === "hydro") return pick(catalog.hydro, r);
  if (tier === "ctNonMfg") {
    // Fall through to industrial if there are no CT non-mfg matches (shouldn't happen)
    return catalog.ctMatchedNonMfg.length > 0
      ? pick(catalog.ctMatchedNonMfg, r)
      : pick(catalog.industrial, r);
  }
  return pick(catalog.industrial, r);
}

function pickSmeBorrower(
  smes: SmeBorrower[],
  r: () => number
): SmeBorrower {
  return pick(smes, r);
}

// ---------------------------------------------------------------------------
// PCAF calculation
// ---------------------------------------------------------------------------

/**
 * PCAF attribution for one loan.  Delegates the score / option / citation
 * decision to `lib/regulatory/pcaf/scoring.ts` — the PCAF Part A 3rd
 * Edition (Dec 2025) rubric — and keeps the attribution-factor and
 * attributed-tCO2e math here since those are portfolio-shape concerns.
 */
function pcafFor(loan: Loan, borrower: Borrower): PcafAttribution {
  // 1. Determine PCAF asset class + inferred availability flags.
  const assetClass = assetClassForLoanCategory(loan.category);
  const inferred = inferPcafAvailability(borrower, loan.category);

  // 1a. Resolve the two published-emissions flags from EVIDENCE, not names.
  //     inferPcafAvailability leaves borrower_publishes_verified/_unverified
  //     false; resolveAvailability raises them only where a verified in-year
  //     document exists. This module IS the demo layer, so it seeds that
  //     evidence directly (lib/demo/pcaf-evidence-seed.ts) — a verified
  //     assurance opinion for the Score-1 exemplar, a verified GHG inventory
  //     for the Score-2 exemplars. A live build seeds nothing and the flags are
  //     established by an officer's real document review through this same
  //     resolveAvailability path (backlog N0.4). disclosureYear is the latest
  //     fully-reported year so a reportingYear-2024 record is not stale.
  const availability = resolveAvailability(
    inferred,
    demoPcafEvidenceRecords(borrower),
    LATEST_FULL_YEAR,
    { loanId: loan.id, isProjectFinance: assetClass === "project-finance" },
  ).flags;

  // 2. Run the PCAF §5 decision tree.
  const compute = computePcafScore(loan, borrower, null, availability, assetClass);
  const score = compute.score;
  const option = compute.option;

  // 3. Retail short-circuit — retail-pool borrower (mortgage / personal /
  //    education / vehicle). PCAF Part A §5.5 / §5.6 permits a Score-5
  //    revenue/economic-value proxy when borrower-specific data is
  //    unavailable. We use attribution factor = 1.0 (the bank fully finances
  //    a personal loan) and per-loan attributed emissions =
  //    outstandingNpr × the retail intensity. Emissions are broadly flat
  //    year-over-year — retail portfolios don't have year-varying facility
  //    data — so the trend aggregators below apply the same value to every
  //    year. This keeps the multi-year trend chart's Unclassified band
  //    consistent with the Data Quality Distribution panel's Score 5 total.
  //    The intensity is the ILLUSTRATIVE `RETAIL_TCO2E_PER_NPR` policy input
  //    (see lib/regulatory/pcaf/retail.ts for its provenance caveat — N0.5):
  //    it is a demo assumption, not a sourced factor, and is documented as
  //    such at its sanctioned home rather than tuned to a chart here.
  if (borrower.kind === "retail-pool") {
    const attributed = retailProxyEmissionsTonnes(loan.outstandingNpr);
    return {
      loanId: loan.id,
      borrowerId: borrower.id,
      methodology: "revenue-based-estimate",
      attributionFactor: 1.0,
      attributedCo2eTonnes: Math.round(attributed),
      dataQualityScore: 5,
      qualityNote:
        "Retail sector-average revenue proxy (PCAF Part A §5.5 / §5.6 fallback)",
      pcafOption: "3b",
      pcafAssetClass: assetClass,
      pcafCitation: RETAIL_PROXY_CITATION,
      pcafDataSource: "sector-average (retail proxy)",
    };
  }

  // 3a. Non-retail out-of-scope short-circuit — kept for defensive completeness.
  //     Any non-retail loan that computePcafScore flagged as out-of-scope
  //     keeps a zero attribution (score still populated so it appears in the
  //     disclosure histogram).
  if (compute.assetClass === "out-of-scope") {
    return {
      loanId: loan.id,
      borrowerId: borrower.id,
      methodology: "out-of-scope",
      attributionFactor: 0,
      attributedCo2eTonnes: 0,
      dataQualityScore: SCORE_FOR_OPTION[option],
      qualityNote: compute.method,
      pcafOption: option,
      pcafAssetClass: compute.assetClass,
      pcafCitation: compute.citation,
      pcafDataSource: compute.dataSource,
    };
  }

  // 4. Compute the attribution factor (loan / EV) — PCAF Part A §4.2. The
  //    enterprise-value floor (the guard that stops a tiny synthetic EV
  //    producing a >100 % share) lives once, cited, in
  //    lib/regulatory/pcaf/attribution.ts and is shared with the live
  //    re-overlay aggregator (lib/api/bfi.ts).
  const af = pcafAttributionFactor(loan.outstandingUsd, borrower);
  const attributed = af * borrower.totalCo2eTonnes;

  // 5. Pick the legacy `methodology` label — kept for the ESRM tab's
  //    existing badges (facility-attributed vs satellite-emissions vs
  //    sector-benchmark) so the visual language of the tabs is
  //    preserved.  New consumers should use `pcafOption` + `pcafCitation`.
  let methodology: PcafMethodology;
  if (score <= 2) methodology = "facility-attributed";
  else if (score === 3) methodology = borrower.evSource === "public-filing"
    ? "facility-attributed"
    : "satellite-emissions";
  else if (score === 4) methodology = "sector-benchmark";
  else methodology = "revenue-based-estimate";

  return {
    loanId: loan.id,
    borrowerId: borrower.id,
    methodology,
    attributionFactor: af,
    attributedCo2eTonnes: Math.round(attributed),
    dataQualityScore: score,
    qualityNote: compute.method,
    pcafOption: option,
    pcafAssetClass: compute.assetClass,
    pcafCitation: compute.citation,
    pcafDataSource: compute.dataSource,
  };
}

// ---------------------------------------------------------------------------
// Loan generation
// ---------------------------------------------------------------------------

function generateLoansForCategory(
  catalog: ReturnType<typeof getBorrowerCatalog>,
  category: LoanCategory,
  count: number,
  startIndex: number,
  seed: number
): Loan[] {
  const r = mulberry32(seed);
  const [lo, hi] = NPR_RANGES[category];
  const product = LOAN_PRODUCT_NAME[category];
  const businessUnit = BUSINESS_UNIT_FOR_CATEGORY[category];
  const out: Loan[] = [];

  // Cap loan size at 50% of borrower EV. Real banks rarely lend more than
  // half a borrower's enterprise value, and we need this to keep the PCAF
  // attribution factor (loan / EV) below 50% rather than producing the
  // 200-700% nonsense an unconstrained synthesizer would generate.
  const EV_CAP_FRACTION = 0.5;

  for (let i = 0; i < count; i++) {
    // Pick borrower first so we can cap the loan against their EV
    let borrower: Borrower;
    if (category.startsWith("retail-")) {
      borrower = catalog.retailPool;
    } else if (category.startsWith("sme-")) {
      borrower = pickSmeBorrower(catalog.sme, r);
    } else {
      borrower = pickCommercialBorrower(catalog, category, r);
    }

    // Compute an EV-constrained upper bound on the NPR amount. Retail pool
    // borrower has EV=0 (out-of-scope) so we skip the cap there.
    let effectiveHi = hi;
    if (
      borrower.kind !== "retail-pool" &&
      borrower.enterpriseValueUsd > 0
    ) {
      const capNpr = usdToNpr(borrower.enterpriseValueUsd * EV_CAP_FRACTION);
      effectiveHi = Math.min(hi, Math.max(lo, capNpr));
    }
    const npr = roundNpr(logUniform(lo, effectiveHi, r));
    const usd = nprToUsd(npr);

    const disbursedOffset = -rangeInt(30, 365 * 5, r); // up to 5y ago
    const termMonths = (() => {
      if (category.startsWith("retail-mortgage")) return rangeInt(60, 300, r);
      if (category.startsWith("retail-")) return rangeInt(12, 60, r);
      if (category.startsWith("sme-")) return rangeInt(12, 60, r);
      if (category.includes("project-finance")) return rangeInt(60, 240, r);
      return rangeInt(24, 120, r);
    })();
    const maturityOffset = disbursedOffset + termMonths * 30;
    const disbursedDate = isoDateOffsetDays(SYNTH_ANCHOR_DATE, disbursedOffset);
    const maturityDate = isoDateOffsetDays(SYNTH_ANCHOR_DATE, maturityOffset);

    // ~1.5% of commercial loans in "under-review" for ESRM tab; 0.5% in "approved" pending disbursement.
    let status: LoanStatus = "active";
    const isCommercial =
      category.startsWith("commercial-") || category.startsWith("corporate-");
    if (isCommercial) {
      const x = r();
      if (x < 0.015) status = "under-review";
      else if (x < 0.02) status = "approved";
      else status = "active";
    } else {
      status = "active";
    }

    const taxonomy = taxonomyForLoan(category, borrower);
    const purpose = (() => {
      if (category === "retail-mortgage") return "Primary residence purchase";
      if (category === "retail-personal") return "Personal expenses";
      if (category === "retail-education") return "Tuition and study abroad";
      if (category === "retail-vehicle") return "Vehicle purchase";
      if (category === "sme-working-capital") return "Working capital line";
      if (category === "sme-trade-finance") return "Import LC / trust receipt";
      if (category === "sme-term-loan") return "Machinery / capex";
      if (category === "commercial-term-loan") return "Capacity expansion";
      if (category === "commercial-working-capital") return "Operating liquidity";
      if (category === "commercial-project-finance") return "Greenfield project";
      if (category === "corporate-syndicated") return "General corporate purpose";
      return "Capex / project finance";
    })();

    const branch = BRANCHES[Math.floor(r() * BRANCHES.length)];
    out.push({
      id: `L-${String(startIndex + i + 1).padStart(7, "0")}`,
      borrowerId: borrower.id,
      product,
      category,
      businessUnit,
      branch: branch.name,
      branchCode: branch.code,
      outstandingNpr: npr,
      outstandingUsd: usd,
      disbursedDate,
      maturityDate,
      status,
      nrbTaxonomy: taxonomy,
      purpose,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------
//
// The portfolio roll-up (buildSummary) that used to live here was collapsed
// into the single shared computation `summarise()` in
// lib/regulatory/pcaf/aggregation.ts (backlog N0.1) — the same function the
// live re-overlay path calls (via recomputeSummary in lib/api/bfi.ts). The
// demo synthesizer now calls summarise() below, so the demo and live disclosed
// totals can never diverge.

// ---------------------------------------------------------------------------
// Top-level memoized portfolio
// ---------------------------------------------------------------------------

let portfolioCache: BfiDemoData | null = null;

function buildPortfolio(): BfiDemoData {
  const catalog = getBorrowerCatalog();

  // Generate loans by category with a stable per-category seed.
  let cursor = 0;
  const loans: Loan[] = [];
  let seed = 0xb1f0b1f0;
  const cats: LoanCategory[] = [
    "retail-mortgage",
    "retail-personal",
    "retail-education",
    "retail-vehicle",
    "sme-working-capital",
    "sme-trade-finance",
    "sme-term-loan",
    "commercial-term-loan",
    "commercial-working-capital",
    "commercial-project-finance",
    "corporate-syndicated",
    "corporate-project-finance",
  ];
  for (const c of cats) {
    const n = PORTFOLIO_SCALE[
      ({
        "retail-mortgage": "retailMortgage",
        "retail-personal": "retailPersonal",
        "retail-education": "retailEducation",
        "retail-vehicle": "retailVehicle",
        "sme-working-capital": "smeWorkingCapital",
        "sme-trade-finance": "smeTradeFinance",
        "sme-term-loan": "smeTermLoan",
        "commercial-term-loan": "commercialTerm",
        "commercial-working-capital": "commercialWorkingCapital",
        "commercial-project-finance": "commercialProjectFinance",
        "corporate-syndicated": "corporateSyndicated",
        "corporate-project-finance": "corporateProjectFinance",
      } as const)[c]
    ];
    seed = (seed + 0xdeadbeef) | 0;
    loans.push(
      ...generateLoansForCategory(catalog, c, n, cursor, seed >>> 0)
    );
    cursor += n;
  }

  const borrowers = [catalog.retailPool, ...catalog.all];

  // Demo tour hook: ensure at least one Hongshi Shivam Cement loan is in the
  // "under-review" queue so the step 5 narration lands on a borrower with the
  // headline emissions story. Pick the largest by NPR for visibility.
  const hongshi = catalog.cement.find((b) =>
    b.name.toLowerCase().includes("hongshi")
  );
  if (hongshi) {
    const hongshiLoans = loans.filter((l) => l.borrowerId === hongshi.id);
    if (hongshiLoans.length > 0) {
      const biggest = hongshiLoans.reduce((acc, l) =>
        l.outstandingNpr > acc.outstandingNpr ? l : acc
      );
      biggest.status = "under-review";
    }
  }

  // Demo tour hook: ensure at least one SME brick-industry loan is
  // under-review so the "small loan in critical sector" walkthrough
  // path has a concrete loan to demonstrate. Brick is on NRB's
  // critical-sector list per NRB ESRM Guideline 2022 §5, so a small SME loan to a
  // brick borrower should route through the full ESDD checklist (not
  // the fast-path). Picks the largest SME term loan by NPR to the
  // first brick-industry borrower for stable selection.
  const brickBorrower = catalog.sme.find((b) =>
    b.nrbSector.toLowerCase().includes("brick"),
  );
  if (brickBorrower) {
    const brickSmeLoans = loans.filter(
      (l) =>
        l.borrowerId === brickBorrower.id && l.category === "sme-term-loan",
    );
    if (brickSmeLoans.length > 0) {
      const biggest = brickSmeLoans.reduce((acc, l) =>
        l.outstandingNpr > acc.outstandingNpr ? l : acc,
      );
      biggest.status = "under-review";
    }
  }

  // Compute PCAF attributions
  const attributions: PcafAttribution[] = loans.map((l) => {
    const b = catalog.byId.get(l.borrowerId)!;
    return pcafFor(l, b);
  });

  const portfolio = summarise(loans, borrowers, attributions);

  return {
    meta: {
      bankName: "First Bank of Nepal",
      isMock: true,
      generatedAt: new Date().toISOString(),
      asOfDate: AS_OF_DATE,
      pcafMethodologyNote:
        "Attribution factor = loan outstanding (USD) / borrower enterprise value (USD). " +
        "Facility-tier borrowers use Climate TRACE / GEM facility emissions. " +
        "SME and synthesized commercial borrowers use EDGAR sector intensity benchmarks.",
    },
    borrowers,
    loans,
    attributions,
    portfolio,
  };
}

/**
 * Get the synthesized portfolio. Memoized across requests within one server process.
 *
 * On Vercel serverless the module-scope cache above does NOT survive across
 * cold starts, and re-synthesizing 80k loans + PCAF attribution + aggregation
 * on every cold start pushed user load times past 60s. Fix: build the
 * portfolio once at `next build` time (see scripts/precompute-portfolio.ts)
 * and read it from a JSON file at request time — ~500ms parse vs. ~50s synth.
 */
/**
 * Load or synthesize the 80K-loan portfolio.
 *
 * Async to avoid blocking the Node.js event loop during gzip decompression
 * of the precomputed portfolio (~2.7 MB compressed). The cache is module-
 * scoped, so the async I/O only runs on the first request; subsequent calls
 * return the cached result immediately.
 *
 * Falls back to in-memory synthesis if the precomputed JSON is missing so
 * that `npm run dev` (which skips `prebuild`) still works out of the box.
 */
export async function getPortfolio(): Promise<BfiDemoData> {
  if (portfolioCache) return portfolioCache;

  // Prefer the precomputed gzipped JSON (written by
  // scripts/precompute-portfolio.ts during `next build`). This code only
  // runs on the server (API routes + server components), so `require` of
  // Node built-ins is safe.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs") as typeof import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path") as typeof import("path");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const zlib = require("zlib") as typeof import("zlib");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { promisify } = require("util") as typeof import("util");
    const gunzip = promisify(zlib.gunzip);

    // Where the gz actually lands at runtime differs by host:
    //
    //  - Local `next start` / Docker: cwd IS the repo root, so
    //    `<cwd>/lib/demo/...` resolves.
    //  - Vercel serverless: the RSC/route function runs with a cwd that is
    //    NOT the repo root, and `outputFileTracingIncludes` copies the traced
    //    asset next to the compiled module inside the function bundle. There
    //    `process.cwd()` misses entirely and we fell through to synthesizing
    //    80,035 loans on every cold start (~83s observed in Vercel logs).
    //
    // Resolve against the module's own directory FIRST (where the tracer keeps
    // the adjacent asset), then fall back to cwd-based paths for local/Docker.
    // The first candidate that exists wins. Adding paths here is always safe;
    // the guard is `existsSync`.
    const ARTIFACT = "precomputed-portfolio.json.gz";
    const candidates = [
      // This module lives in lib/demo/ (source) — after compilation the traced
      // asset is placed alongside it in the function bundle. __dirname is the
      // most reliable anchor on Vercel.
      path.join(__dirname, ARTIFACT),
      path.join(__dirname, "lib", "demo", ARTIFACT),
      // Local dev / Docker / `next start`: cwd is the repo root.
      path.join(process.cwd(), "lib", "demo", ARTIFACT),
      // Standalone output nests the app under .next/standalone.
      path.join(process.cwd(), ".next", "standalone", "lib", "demo", ARTIFACT),
    ];

    let gzPath: string | undefined;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        gzPath = candidate;
        break;
      }
    }

    if (gzPath) {
      const compressed = await fs.promises.readFile(gzPath);
      const raw = (await gunzip(compressed)).toString("utf8");
      portfolioCache = JSON.parse(raw) as BfiDemoData;
      console.log(`[portfolio] loaded precomputed portfolio from ${gzPath}`);
      return portfolioCache;
    }

    // Loud, not silent: a demo build that reaches synthesis has a packaging
    // bug (the tracer did not include the artifact where any candidate path
    // resolves). Log the paths we tried so the mismatch is diagnosable from
    // the deploy logs instead of surfacing only as an 83s request.
    console.error(
      "[portfolio] precomputed JSON NOT FOUND — will synthesize in-memory " +
        `(~50-80s cold start). __dirname=${__dirname} cwd=${process.cwd()} ` +
        `tried=${JSON.stringify(candidates)}`
    );
  } catch (e) {
    console.warn(
      "[portfolio] precomputed JSON load failed, falling back to synth:",
      e
    );
  }

  console.log(
    "[portfolio] synthesizing portfolio in-memory (no precomputed JSON found)"
  );
  portfolioCache = buildPortfolio();
  return portfolioCache;
}

/** For unit tests / live-mode overlays — invalidate the cache. */
export function invalidatePortfolioCache() {
  portfolioCache = null;
}

/** Re-export for downstream callers */
// Currency helpers live in lib/units.ts, which is real product code. Kept
// re-exported here only because existing callers import them from the
// portfolio module; they should move to @/lib/units directly.
export { usdToNpr, nprToUsd } from "@/lib/units";
