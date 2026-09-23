/**
 * Does the demo boundary hold?
 *
 * The requirement being guarded: no fabricated record may appear in a live
 * deployment. The dangerous failure is silent -- an invented Score 1 looks
 * exactly like an earned one, and it lands in a disclosure.
 *
 * Asserts the two behaviours that matter. With JANA_DEMO=1 the demo seeds
 * verified PCAF evidence documents and the top of the histogram exists. Without
 * it nothing is seeded, so no borrower can claim published emissions on the
 * strength of a hardcoded list. The score is derived the SAME way in both
 * cases -- inferPcafAvailability() then resolveAvailability() -- so the switch
 * changes only the evidence, not the arithmetic. The last check confirms the
 * switch does not disturb genuine inference, which would be a different bug
 * wearing the same clothes.
 *
 * Scope: the BUILD-time half of the boundary only.
 *
 * This deliberately calls getDemoProvider().pcafEvidenceRecords() rather than
 * the demoPcafEvidenceRecords() helper the app uses. The helper now also
 * consults isDemoMode(), which reads the cookie jar via next/headers and throws
 * outside a request scope -- there is no request here, this is a plain node
 * process.
 *
 * The runtime half is covered statically by scripts/check-demo-mode-gate.mjs,
 * which asserts that basePortfolio() gates on isDemoMode() before touching the
 * provider. Splitting them is not a gap: each half is checked by the tool that
 * can actually see it, and both run in prebuild.
 *
 * Usage:  npx tsx scripts/check-demo-boundary.ts
 * Exit 0 = boundary holds, 1 = broken.
 */
import { inferPcafAvailability } from "@/lib/regulatory/pcaf/scoring";
import { resolveAvailability } from "@/lib/regulatory/pcaf/evidence-matrix";
import { LATEST_FULL_YEAR } from "@/lib/regulatory/reporting/period";
import type { Borrower } from "@/lib/types/bfi";
import type { PcafEvidenceRecord } from "@/lib/regulatory/pcaf/evidence-matrix";

const ghorahi = {
  id: "B-TEST-1",
  name: "Ghorahi Cement Industry Pvt Ltd",
  kind: "corporate",
  nrbSector: "Manufacturing - Cement",
  facilities: [],
  publiclyListed: true,
  evSource: "public-filing",
  totalCo2eTonnes: 100000,
  enterpriseValueUsd: 50_000_000,
  dataTier: "sector-benchmark",
} as unknown as Borrower;

/**
 * Resolve published-emissions flags the way pcafFor() does: infer the
 * observable flags, then raise the two publish flags from evidence.
 */
function resolvedFlags(borrower: Borrower, evidence: PcafEvidenceRecord[]) {
  const inferred = inferPcafAvailability(borrower, "commercial-term-loan");
  return resolveAvailability(inferred, evidence, LATEST_FULL_YEAR, {
    loanId: "L-TEST-1",
    isProjectFinance: false,
  }).flags;
}

(async () => {
  const { getDemoProvider, __resetDemoProviderCache } = await import(
    "@/lib/demo/provider"
  );

  /** Build-level evidence seed, skipping the cookie-reading mode check. */
  const buildEvidence = async () =>
    (await getDemoProvider())?.pcafEvidenceRecords(ghorahi);

  // --- live build: no evidence seeded ------------------------------------
  delete process.env.JANA_DEMO;
  __resetDemoProviderCache();
  const liveEvidence = await buildEvidence();
  const live = resolvedFlags(ghorahi, liveEvidence ?? []);

  // --- demo build: evidence seeded ---------------------------------------
  process.env.JANA_DEMO = "1";
  __resetDemoProviderCache();
  const demoEvidence = await buildEvidence();
  const demo = resolvedFlags(ghorahi, demoEvidence ?? []);

  const checks: [string, boolean][] = [
    ["live build seeds no evidence", liveEvidence === undefined],
    ["live: Ghorahi does NOT claim verified emissions", live.borrower_publishes_verified === false],
    ["live: Ghorahi does NOT claim unverified emissions", live.borrower_publishes_unverified === false],
    ["demo build seeds evidence", Array.isArray(demoEvidence) && demoEvidence.length > 0],
    ["demo: Ghorahi DOES claim verified emissions", demo.borrower_publishes_verified === true],
    ["real inference unaffected by the switch",
      live.revenue_data_available === demo.revenue_data_available],
  ];
  let ok = true;
  for (const [name, pass] of checks) {
    if (!pass) ok = false;
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}`);
  }
  console.log(ok ? "\n  boundary holds" : "\n  BOUNDARY BROKEN");
  process.exit(ok ? 0 : 1);
})();
