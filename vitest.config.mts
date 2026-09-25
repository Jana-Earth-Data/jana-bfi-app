/**
 * Vitest configuration — jana-bfi-app (Task P0.2 of PROJECT_PLAN.md).
 *
 * WHY THIS EXISTS
 * ---------------
 * P1 (Correctness) requires a test net around the ~8,200 lines of regulatory
 * logic, and PR0 (Regulatory integrity) needs characterization ("golden")
 * tests that pin today's disclosed numbers BEFORE the integrity refactors move
 * them. This config is the harness both depend on.
 *
 * ENVIRONMENT
 * -----------
 * The default environment is `node`: the regulatory core (lib/regulatory/**),
 * the demo synthesizer (lib/demo/**), and the aggregators (lib/api/bfi.ts) are
 * pure TypeScript with no DOM. Component tests (Tier 3, P4.9) opt into jsdom
 * per-file with a `// @vitest-environment jsdom` docblock, so we do not pay the
 * jsdom startup cost on the pure-logic suites.
 *
 * ALIAS
 * -----
 * `@/` maps to the repo root, mirroring tsconfig.json `paths` exactly, so test
 * imports (`@/lib/demo/portfolio`) resolve the same way app code does.
 *
 * COVERAGE
 * --------
 * v8 provider. P0.4 wired the report into CI; P1.5 (this config) turns the hard
 * gate ON: `lib/regulatory/**` must hold 100% line + branch + function coverage,
 * enforced on every `npm run test:coverage` run (so CI fails the build on any
 * regression) per TEST_STRATEGY §5.2. The regulatory core is the disclosed-
 * numbers surface — every branch there changes a figure a bank reports, so it
 * carries no untested lines. The wider report globs (lib/demo, lib/api/bfi.ts,
 * lib/reporting, …) stay report-only; they are exercised by the golden suites
 * but are not yet under a hard threshold.
 *
 * The four unreachable branches that stood between the suites and a literal
 * 100% (a terminal switch case, a `: "none"` ternary, a `?? null` alias
 * fallback, and an all-`yes_no` DNSH implicit-else) were removed in P1.5 with
 * inline notes pointing at the invariant each removal relies on; see the
 * per-module test headers.
 *
 * WHY .mts (not .ts)
 * ------------------
 * This file uses ESM syntax (`import ... from`, `import.meta.url`). The repo's
 * root package.json is CommonJS (no `"type": "module"`, as Next.js expects), so
 * Vite's native config loader would treat a `.ts` config as CJS and warn. The
 * `.mts` extension forces ESM loading without flipping the whole project to
 * module type, keeping the Next.js build untouched.
 */
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": repoRoot.replace(/\/$/, ""),
    },
  },
  test: {
    // Pure-logic default; component suites opt into jsdom per-file.
    environment: "node",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    // globalSetup synthesizes the ~80K-loan portfolio ONCE (writing the gz that
    // getPortfolio() prefers) before any worker starts. Without it, Vitest's
    // per-file worker isolation would re-run the ~50-80s synthesis for each
    // golden file's beforeAll — which blew past a 60s hookTimeout on the slower
    // GitHub Actions runner (CI run 35483664854). With the shared gz, each
    // beforeAll just gunzips (~300ms), so these timeouts are generous headroom.
    globalSetup: ["tests/global-setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      // Report the regulatory surface and the paths the goldens exercise.
      // No threshold gate yet — see the header note (P1.5 turns it on).
      include: [
        "lib/regulatory/**",
        "lib/demo/**",
        "lib/api/bfi.ts",
        "lib/reporting/**",
        "lib/reports/**",
        "lib/units.ts",
      ],
      // Data catalogues and generated artifacts are not logic under test.
      exclude: ["**/*.d.ts", "lib/demo/precomputed-portfolio.json.gz"],
      // P1.5 hard gate (TEST_STRATEGY §5.2). The `**` glob applies the 100%
      // thresholds per-file across the regulatory core, so a single uncovered
      // branch in any lib/regulatory module fails `npm run test:coverage` (and
      // therefore CI). The wider report globs above are intentionally NOT listed
      // here — they stay report-only until their own phase raises them.
      thresholds: {
        "lib/regulatory/**": {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
