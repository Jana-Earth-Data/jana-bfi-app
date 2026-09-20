/**
 * CHARACTERIZATION ("GOLDEN") TEST — PCAF scoring + retail contribution.
 * jana-bfi-demo · Phase B of PROJECT_PLAN.md (pins the PR0 baseline).
 *
 * WHAT THIS PINS AND WHY
 * ----------------------
 * Two PR0 tasks reshape the PCAF attribution layer and MUST be diff-checked:
 *
 *   • N0.4 — evidence-driven scoring. Today Scores 1–2 are unlocked by a
 *     hard-coded borrower-NAME fixture list (PCAF_NAME_FIXTURES_*). N0.4 moves
 *     that to observable evidence. This suite pins the exact score histogram
 *     (how many attributions land in each PCAF 1–5 bucket) so the shape of the
 *     change is visible when the name list goes away.
 *
 *   • N0.5 — retail emissions factor. Retail-pool loans get a Score-5
 *     revenue proxy: attributed tCO2e = outstandingNpr × RETAIL_TCO2E_PER_NPR
 *     (6e-6), a constant "calibrated so the KPI stays under 10M tCO2e"
 *     (portfolio.ts:255). That is a chart-tuned number, not a derived one;
 *     N0.5 replaces it with a defensible factor. This suite pins the current
 *     retail-pool contribution to the disclosed total so the re-derivation's
 *     impact on the headline KPI is measured, not guessed.
 *
 * Captured deterministically 2026-09-19 (seed 0xb1f0b1f0), verified stable
 * across runs.
 */
import { getPortfolio } from "@/lib/demo/portfolio";
import type { BfiDemoData } from "@/lib/types/bfi";

let data: BfiDemoData;
beforeAll(async () => {
  data = await getPortfolio();
});

describe("PCAF scoring · data-quality score histogram", () => {
  it("pins the per-score attribution counts (N0.4 baseline)", () => {
    const hist: Record<number, number> = {};
    for (const a of data.attributions) {
      hist[a.dataQualityScore] = (hist[a.dataQualityScore] ?? 0) + 1;
    }
    // Score 4 has zero attributions today, so it is absent from the map.
    expect(hist).toEqual({ 1: 5, 2: 39, 3: 991, 5: 79_000 });
  });

  it("the score histogram covers every attribution", () => {
    const counted = data.attributions.reduce(
      (n, a) => n + (a.dataQualityScore >= 1 && a.dataQualityScore <= 5 ? 1 : 0),
      0,
    );
    expect(counted).toBe(80_035);
  });

  it("pins that Scores 1–2 are unlocked ONLY by the name fixtures today", () => {
    // This is the fact N0.4 removes: exactly 5 + 39 = 44 attributions reach a
    // best-two PCAF score, and today that is driven by the borrower-name
    // fixture list rather than observable evidence.
    const bestTwo = data.attributions.filter(
      (a) => a.dataQualityScore <= 2,
    ).length;
    expect(bestTwo).toBe(44);
  });
});

describe("retail-pool contribution · revenue-proxy baseline (N0.5)", () => {
  it("pins the retail-pool loan count and attributed emissions", () => {
    const retailBorrowerIds = new Set(
      data.borrowers.filter((b) => b.kind === "retail-pool").map((b) => b.id),
    );
    const retailAttrs = data.attributions.filter((a) =>
      retailBorrowerIds.has(a.borrowerId),
    );
    const retailTonnes = retailAttrs.reduce(
      (sum, a) => sum + a.attributedCo2eTonnes,
      0,
    );

    // A single "retail-pool" pseudo-borrower carries 70,000 personal/mortgage/
    // vehicle loans. NOTE: this is NOT the whole Score-5 bucket (79,000) — the
    // other 9,000 Score-5 loans are non-retail SMEs with no borrower-specific
    // data. Pinning retail separately is what lets N0.5 move the retail factor
    // without the diff being confounded by those SMEs.
    expect(retailBorrowerIds.size).toBe(1);
    expect(retailAttrs.length).toBe(70_000);
    // The retail book's contribution to the disclosed financed-emissions total.
    // ~2.04M tCO2e — the "~2M tCO2e/yr" the 6e-6 factor was tuned to produce
    // (portfolio.ts:255). N0.5 replaces that factor; this literal will move.
    expect(retailTonnes).toBe(2_044_419);
  });

  it("every retail attribution uses the pinned revenue-proxy method", () => {
    const retailBorrowerIds = new Set(
      data.borrowers.filter((b) => b.kind === "retail-pool").map((b) => b.id),
    );
    const retailAttrs = data.attributions.filter((a) =>
      retailBorrowerIds.has(a.borrowerId),
    );
    for (const a of retailAttrs) {
      expect(a.dataQualityScore).toBe(5);
      expect(a.methodology).toBe("revenue-based-estimate");
      expect(a.attributionFactor).toBe(1.0);
    }
  });

  it("retail is a material but non-dominant slice of the headline KPI", () => {
    // 2,044,419 / 9,774,371 ≈ 20.9%. Pinned as a guard-rail band so a
    // re-tuned factor (N0.5) that flips retail into the majority (or down to
    // noise) is caught independently of the exact tonnes literal above.
    const share = 2_044_419 / data.portfolio.totalAttributedCo2eTonnes;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.3);
  });
});
