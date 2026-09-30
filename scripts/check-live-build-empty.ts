/**
 * Without the demo switch, is the loan book actually empty?
 *
 * The requirement: no fabricated record may reach the bank's own data. An
 * invented loan is indistinguishable from a real one once it is in a
 * disclosure, so the guarantee has to be that the synthesizer is not
 * reachable through lib/demo/provider.ts unless demo is enabled -- not that
 * every caller remembers not to read it. (The synthesizer code is in every
 * bundle; this checks the provider gate, not code absence.)
 *
 * With JANA_DEMO unset (demo switch not available on this deployment),
 * getBfiDemoData() must return a valid but genuinely
 * empty envelope: the state of a bank whose core-banking import has not
 * happened yet. The weighted data-quality check is deliberate -- zero, not
 * five. Five is the worst PCAF score and would assert that every loan was
 * assessed and found wanting, which is a claim about a book that does not
 * exist.
 *
 * The JANA_DEMO=1 half matters too: a boundary that breaks the demo would
 * just get reverted.
 *
 * Usage:  npx tsx scripts/check-live-build-empty.ts
 * Exit 0 = empty without the demo switch and the demo works with it, 1 = leak.
 */
import { getBfiDemoData } from "@/lib/api/bfi";
import { __resetDemoProviderCache } from "@/lib/demo/provider";

(async () => {
  // --- JANA_DEMO unset: no demo switch ------------------------------------
  delete process.env.JANA_DEMO;
  __resetDemoProviderCache();
  const live = await getBfiDemoData();

  // --- JANA_DEMO=1: demo switch available ---------------------------------
  process.env.JANA_DEMO = "1";
  __resetDemoProviderCache();
  const demo = await getBfiDemoData();

  const checks: [string, boolean][] = [
    ["live: zero loans", live.loans.length === 0],
    ["live: zero borrowers", live.borrowers.length === 0],
    ["live: zero attributions", live.attributions.length === 0],
    ["live: zero attributed tonnes", live.portfolio.totalAttributedCo2eTonnes === 0],
    ["live: weighted DQ is 0, not 5", live.portfolio.weightedDataQuality === 0],
    ["live: envelope still structurally valid",
      Array.isArray(live.portfolio.sectorBreakdown) &&
      Array.isArray(live.portfolio.trend)],
    ["live: methodology note explains the emptiness",
      live.meta.pcafMethodologyNote.includes("No loan portfolio")],
    ["demo: full book present", demo.loans.length > 79000],
    ["demo: emissions present", demo.portfolio.totalAttributedCo2eTonnes > 0],
  ];

  let ok = true;
  for (const [name, pass] of checks) {
    if (!pass) ok = false;
    console.log(`  [${pass ? "PASS" : "FAIL"}] ${name}`);
  }
  console.log(`\n  live loans=${live.loans.length}  demo loans=${demo.loans.length}`);
  console.log(ok ? "  without the demo switch the book is genuinely empty" : "  SEAM BROKEN");
  process.exit(ok ? 0 : 1);
})();
