/**
 * Keep regulatory policy in one place: lib/regulatory/**.
 *
 * The rule
 * --------
 * A "policy constant" is any number or string that encodes a regulatory or
 * accounting choice: an FX rate used in a disclosed figure, an emissions
 * factor, a reporting-period boundary, a PCAF method label, a scoring
 * threshold. Those belong in lib/regulatory/** where they are reviewed as
 * policy, cited, and shared by BOTH the demo and the live path. When the same
 * choice is re-typed in lib/demo/, lib/api/, or a component, the two copies
 * drift and a disclosed number ends up depending on which code path produced
 * it (backlog §0, findings N0.1–N0.7).
 *
 * Why a script and not review
 * ---------------------------
 * A second hardcoding of the 2024/2025 period boundary, or a second
 * `Math.max(1_000_000, …)` EV floor, compiles fine and reads plausibly. The
 * only mechanical signal that two aggregators have diverged is a grep that
 * fails the build. This is the same reasoning as check-demo-imports.mjs.
 *
 * Staged tightening
 * -----------------
 * The N0.1–N0.7 fixes MOVE these constants into lib/regulatory across PR0-b
 * and PR0-c. Until then the known occurrences are GRANDFATHERED below: the
 * guard warns about each (so the target list is visible and cannot grow), but
 * does not fail on them. Any *new* occurrence — a specifier this file has not
 * seen — fails immediately. As each N0.x fix lands, delete its baseline entry;
 * the net tightens with every sub-PR and can never loosen.
 *
 * Run:  node scripts/check-regulatory-boundary.mjs
 * Exit: 0 = clean (or only grandfathered warnings), 1 = a new violation.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Directories scanned for stray policy. lib/regulatory is the sanctioned home. */
const SCANNED = ["app", "components", "lib"];
const SANCTIONED_PREFIX = "lib/regulatory/";

/**
 * Policy patterns that must not appear outside lib/regulatory. Each entry is a
 * regex plus a human label used in the failure message. Keep these tight —
 * they should match a *definition* of a policy constant, not an incidental use
 * of a common word.
 */
const POLICY_PATTERNS = [
  {
    id: "npr-per-usd",
    pattern: /\bNPR_PER_USD\b\s*=/,
    what: "an FX rate constant (belongs in lib/regulatory with a dated source — N0.6)",
  },
  {
    id: "retail-emissions-factor",
    pattern: /\bRETAIL_TCO2E_PER_NPR\b\s*=/,
    what: "a retail emissions factor (belongs in lib/regulatory with a citation — N0.5)",
  },
  {
    id: "as-of-date",
    pattern: /\bAS_OF_DATE\b\s*=/,
    what: "a hardcoded reporting-period boundary (derive from ingested coverage — N0.7)",
  },
  {
    id: "ev-floor-million",
    pattern: /Math\.max\(\s*1_000_000\b/,
    what: "an enterprise-value floor duplicated across aggregators (N0.1)",
  },
];

/**
 * Grandfathered baseline: <policy id> -> [ "<relpath>:<line>", … ].
 *
 * These are the KNOWN pre-existing occurrences the N0.1–N0.7 fixes will
 * relocate. They warn but do not fail. Delete an entry the moment its fix
 * lands so the guard starts failing on any reintroduction.
 *
 * Lines are advisory (for the warning text); matching is by file + policy id,
 * so a small line drift from an unrelated edit does not spuriously fail.
 */
const BASELINE = {
  // npr-per-usd: RELOCATED by N0.6 (PR0-b). The FX rate now lives, dated and
  // sourced, in lib/regulatory/fx/rates.ts; lib/units.ts only re-exports it.
  // No grandfather entry remains, so any NEW `NPR_PER_USD =` definition outside
  // lib/regulatory now fails the build.
  "retail-emissions-factor": ["lib/demo/portfolio.ts"],
  "as-of-date": ["lib/demo/synth-util.ts"],
  // ev-floor-million: the demo aggregator floors enterprise value at
  // Math.max(1_000_000, …) (portfolio.ts:344) while the live aggregator uses a
  // different floor, Math.max(1, … || 1) (bfi.ts:189) — that very divergence is
  // finding N0.1. Only the demo literal matches this pattern; grandfather it by
  // file until N0.1 collapses both aggregators into one lib/regulatory helper.
  "ev-floor-million": ["lib/demo/portfolio.ts"],
};

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

const newViolations = [];
const grandfathered = [];

for (const root of SCANNED) {
  for (const file of walk(join(repoRoot, root))) {
    const rel = relative(repoRoot, file).split("\\").join("/");
    if (rel.startsWith(SANCTIONED_PREFIX)) continue;

    const lines = readFileSync(file, "utf8").split("\n");
    for (const { id, pattern, what } of POLICY_PATTERNS) {
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        // A pattern inside a comment explaining the boundary is not itself a
        // violation of it.
        if (trimmed.startsWith("*") || trimmed.startsWith("//")) return;
        if (!pattern.test(line)) return;
        const allowedFiles = BASELINE[id] ?? [];
        const hit = { id, rel, line: i + 1, what, text: trimmed };
        if (allowedFiles.includes(rel)) grandfathered.push(hit);
        else newViolations.push(hit);
      });
    }
  }
}

for (const g of grandfathered) {
  console.warn(
    `[check-regulatory-boundary] grandfathered: ${g.rel}:${g.line} — ${g.what}`,
  );
}

if (newViolations.length > 0) {
  console.error("\nRegulatory policy found outside lib/regulatory.\n");
  for (const v of newViolations) {
    console.error(`  ${v.rel}:${v.line}`);
    console.error(`    ${v.what}`);
    console.error(`    ${v.text}\n`);
  }
  console.error(
    "Policy constants and portfolio aggregators must live in lib/regulatory/**\n" +
      "so the demo and live paths share ONE reviewed computation. A second copy\n" +
      "outside that tree lets a disclosed number depend on which path produced\n" +
      "it. Move the constant into lib/regulatory and import it, or — if this is\n" +
      "a sanctioned pre-existing occurrence being relocated — add it to the\n" +
      "BASELINE in this script with the tracking N0.x id.\n",
  );
  process.exit(1);
}

console.log(
  `[check-regulatory-boundary] no new policy outside lib/regulatory` +
    (grandfathered.length
      ? ` (${grandfathered.length} grandfathered occurrence(s) pending N0.1–N0.7).`
      : "."),
);
