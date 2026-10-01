/**
 * Verify the build guard hooks fire correctly.
 *
 * Why this exists (P5.8 update)
 * -------------------------------
 * As of P5.8, there is ONE build entrypoint: `npm run build`. The prebuild
 * hook runs all guards before every build, and the precompute-guard always
 * generates the demo portfolio.
 *
 * This check verifies that:
 *   1. The `build` script exists
 *   2. The `prebuild` hook is wired
 *   3. No other `build:*` scripts exist that might bypass the guards
 *
 * Usage:  node scripts/check-build-wiring.mjs
 * Exit 0 = wiring correct, 1 = guards are bypassable.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const scripts = pkg.scripts ?? {};

const failures = [];

// Must have exactly one build script
if (!scripts.build) {
  failures.push({
    name: "build",
    body: "(missing) — no build script exists",
  });
}

// Must have the prebuild hook
if (!scripts.prebuild) {
  failures.push({
    name: "prebuild",
    body: "(missing) — nothing runs the guards at all",
  });
}

// Must NOT have build:demo or build:live anymore (P5.8)
const prohibitedBuilds = Object.keys(scripts).filter(
  (name) => name.startsWith("build:") && !name.startsWith("build:docker"),
);
if (prohibitedBuilds.length > 0) {
  for (const name of prohibitedBuilds) {
    failures.push({
      name,
      body: `${scripts[name]} — P5.8: removed dual builds; use 'npm run build' only`,
    });
  }
}

if (failures.length > 0) {
  console.error("\nBuild wiring incorrect.\n");
  for (const f of failures) {
    console.error(`  ${f.name}:`);
    console.error(`    ${f.body}\n`);
  }
  console.error(
    "P5.8: There is one build ('npm run build') that always generates the\n" +
      "demo portfolio. JANA_DEMO is a runtime setting, not a build flag.\n",
  );
  process.exit(1);
}

console.log(
  "[check-build-wiring] ✓ Single build path verified; prebuild hook wired.",
);
