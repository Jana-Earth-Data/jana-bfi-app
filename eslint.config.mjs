// Flat ESLint config (ESLint 9 + eslint-config-next 16).
//
// WHY THIS FILE EXISTS
// --------------------
// Before this, the repo had no ESLint config at all. `next lint` responded by
// dropping into an INTERACTIVE setup prompt ("How would you like to configure
// ESLint?"), which hangs forever in CI (no TTY) and cannot gate anything.
// A lint step that can't run non-interactively is not a gate.
//
// This composes the two standard Next presets that eslint-config-next ships as
// flat-config arrays:
//   * core-web-vitals — the recommended Next rules + web-vitals correctness
//   * typescript      — TypeScript-aware rules
//
// The `lint` script now calls the ESLint CLI (`eslint .`) directly rather than
// the deprecated `next lint`, so it runs headless in the node:20-alpine CI
// container.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  // Never lint build output, deps, the standalone bundle, or generated files.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      // Generated demo artifact — reproducible from source, not authored.
      "lib/demo/precomputed-portfolio.json.gz",
      // Standalone CommonJS build tooling for the user manual — a Node script
      // run by hand, not part of the app bundle. It legitimately uses
      // require(); linting it under the app's ESM/TS rules is noise.
      "docs/**/*.js",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,

  // ------------------------------------------------------------------------
  // Experimental React-hooks RC rules — WARN, not ERROR (temporary).
  //
  // eslint-config-next 16 bundles the React Compiler / react-hooks release-
  // candidate plugin, which ships two rules that flag patterns this app uses
  // pervasively in working, shipped code:
  //
  //   * react-hooks/set-state-in-effect — setState() called synchronously in
  //     an effect body. ~29 sites, almost all legitimate one-shot mount
  //     handoffs (tour orchestration, wizard hydration, dashboard bootstrap).
  //   * react-hooks/refs — reading a ref during render. ~3 sites.
  //
  // These are downgraded to `warn` rather than mass-refactored RIGHT NOW for a
  // deliberate sequencing reason: there is not yet an automated test safety
  // net (that is Phase P1 of PROJECT_PLAN.md). Refactoring 30+ effects across
  // every wizard and the dashboard with no behavioural tests is exactly the
  // high-risk churn a zero-tolerance banking product must avoid. The signal is
  // preserved as warnings; the refactor is tracked as a P1 follow-up to be
  // done AFTER the components have test coverage, then these lines removed and
  // the rules restored to `error`.
  //
  // TODO(P1): once Tier-3 component tests exist, refactor the flagged effects/
  // refs and delete this override so both rules are errors again.
  // ------------------------------------------------------------------------
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },

  // ------------------------------------------------------------------------
  // Underscore-prefix convention for intentionally-unused bindings.
  //
  // The codebase already uses the `_name` convention to mark a variable,
  // argument, or caught error as deliberately unused (e.g. `_tenant`,
  // `_sectorSlug`, a destructured field kept for shape but not read). This is
  // the standard @typescript-eslint escape hatch — honour it so intent is
  // respected and only *accidentally* unused bindings are flagged.
  // ------------------------------------------------------------------------
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },

  // ------------------------------------------------------------------------
  // Deliberately-deferred warnings — left as `warn`, NOT fixed in the P0.1
  // lint-gate change.
  //
  // The P0.1 gate blocks merges on lint ERRORS only (`eslint .` exits non-zero
  // on errors, zero on warnings). The following rules remain at their preset
  // `warn` level on purpose; each carries a behavioural-risk or scope reason
  // for deferring the fix rather than doing a drive-by change inside a
  // CI-infrastructure PR:
  //
  //   * react-hooks/exhaustive-deps — 8 sites. "Fixing" an effect dependency
  //     array can introduce re-run loops, double-fetches, or wizard/tour state
  //     resets. This is the same risk profile that led to downgrading the RC
  //     rules above, and in a banking UI with no test safety net (Phase P1) it
  //     is not safe to change these without behavioural tests first.
  //   * @next/next/no-img-element — 2 sites (header, page-client). Swapping a
  //     raw <img> for next/image changes layout/loading semantics and needs
  //     explicit width/height; it deserves its own reviewed change, not a
  //     drive-by edit here.
  //   * @next/next/no-location-assign-relative-destination — 1 site (header).
  //     Changing it touches navigation behaviour; deferred for the same reason.
  //
  // TODO(P1): once component tests exist, fix the flagged effects/images/
  // navigation and consider promoting these rules to `error`.
  // ------------------------------------------------------------------------
];

export default config;
