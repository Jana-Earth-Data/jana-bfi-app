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
 * v8 provider, report-only for now (no threshold gate). P0.4 wires the report
 * into CI; P1.5 turns the 100%-on-lib/regulatory gate ON. Until then a missing
 * threshold must not fail the build.
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
    },
  },
});
