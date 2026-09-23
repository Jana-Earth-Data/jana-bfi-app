/**
 * Demo fixture: which above-threshold borrowers carry a documented GHG
 * reduction target, and what it says.
 *
 * This is the demo-only seed that used to live inside
 * `lib/regulatory/climate/infer.ts` as a `stableHash(...) % 100 < 15` branch
 * with four canned strings. It was moved here by N0.3 so `lib/regulatory`
 * fabricates nothing: whether a borrower has a reduction target on file is a
 * FACT a live bank records (persisted per borrower and applied as an officer
 * override), not something arithmetic can invent. A live build injects no seed,
 * so the flag is `false`/`null` until an officer records a real target; the
 * demo injects `demoReductionTargetSeed` to reproduce the previous ~15%
 * distribution and canned commitments, keeping demo output unchanged.
 *
 * See `ReductionTargetSeedFn` in lib/regulatory/climate/infer.ts.
 */

import type { ReductionTargetSeed } from "@/lib/regulatory/climate/infer";

/**
 * Deterministic 32-bit hash — same function the regulatory module retains for
 * its assessed-at timestamp. Duplicated here (rather than exported from
 * regulatory) so the demo seed owns its own randomness source and the
 * regulatory module has no reduction-target logic to import back.
 */
function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0; // uint32
}

/**
 * Target-text variants. All align to NRB ESRM 2022 §4.3 wording (measure /
 * disclose / set targets / mitigate) so the ESRM tab renders plausibly
 * different commitments across borrowers.
 */
const TARGET_VARIANTS = [
  "Board-approved 25% reduction in Scope 1+2 by 2030 (2020 baseline)",
  "10% intensity reduction per unit output by 2028; annual disclosure via NFRS",
  "Net-zero pathway aligned to NDC 2020; interim 30% reduction by 2030",
  "Committed to SBTi 1.5C pathway; validation in progress",
] as const;

/**
 * Demo reduction-target seed for one borrower.
 *
 * Reproduces the pre-N0.3 behaviour exactly: a deterministic ~15% share of
 * (above-threshold) borrowers — every ~7th — carry a target on file, with the
 * text picked deterministically from `TARGET_VARIANTS`. Callers only invoke
 * this for above-threshold borrowers, but the function is self-contained and
 * returns `{ onFile: false, details: null }` for the 85% share regardless.
 */
export function demoReductionTargetSeed(borrowerId: string): ReductionTargetSeed {
  const h = stableHash(`${borrowerId}:reduction-target`);
  const onFile = h % 100 < 15;
  return {
    onFile,
    details: onFile ? TARGET_VARIANTS[h % TARGET_VARIANTS.length] : null,
  };
}
