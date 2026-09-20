/**
 * Vitest GLOBAL SETUP — synthesize the demo portfolio ONCE for the whole run.
 * jana-bfi-demo · Phase B of PROJECT_PLAN.md (supports the PR0 goldens).
 *
 * THE PROBLEM THIS SOLVES
 * -----------------------
 * The characterization ("golden") suites each call `getPortfolio()` in a
 * `beforeAll`. `getPortfolio()` prefers a precomputed gz artifact and only
 * falls through to in-memory synthesis of ~80,035 loans when that artifact is
 * absent — a synthesis the source itself documents as "~50-80s cold start"
 * (portfolio.ts:929).
 *
 * Vitest isolates worker state PER FILE, so the module-scope cache inside
 * `getPortfolio()` is NOT shared across the three golden files. With no
 * artifact present that means the synthesis runs three separate times. Locally
 * (fast CPU, Docker) each pass was ~15-17s and squeaked under a 60s hookTimeout;
 * on the slower GitHub Actions runner each pass exceeded 60s and every golden's
 * `beforeAll` timed out (CI run 35483664854).
 *
 * THE FIX
 * -------
 * Run the EXISTING build-time precompute step (scripts/precompute-portfolio.ts)
 * once, here, before any test worker starts. It writes the deterministic gz to
 * lib/demo/precomputed-portfolio.json.gz — exactly the fast path `getPortfolio()`
 * already prefers in production. Every golden file's `beforeAll` then loads the
 * gz in ~300ms instead of synthesizing, so the 3× synthesis becomes 1× and the
 * per-file hookTimeout is never approached.
 *
 * This mirrors production behaviour (Vercel/Docker serve the precomputed gz),
 * so the goldens exercise the same load path real requests do — not a
 * test-only shortcut. The pinned numbers are unchanged: the synthesizer is
 * deterministic (seeded mulberry32, seed 0xb1f0b1f0), so the gz produced here
 * is byte-for-byte the same data an in-memory synth would have yielded.
 *
 * TEARDOWN
 * --------
 * The artifact is gitignored and is a build product, not a fixture. We only
 * remove it in teardown if WE created it — a pre-existing artifact (e.g. from a
 * prior `npm run build`) is left untouched so we never clobber a developer's
 * working tree.
 */
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT = path.join(repoRoot, "lib", "demo", "precomputed-portfolio.json.gz");

// Track whether THIS run created the artifact, so teardown only removes our own.
let createdByUs = false;

export async function setup() {
  if (fs.existsSync(ARTIFACT)) {
    // A precomputed portfolio already exists (e.g. a prior build). Reuse it and
    // leave it in place — the goldens load it in ~300ms and we own nothing.
    console.log(
      `[test/global-setup] reusing existing precomputed portfolio at ${ARTIFACT}`,
    );
    return;
  }

  console.log(
    "[test/global-setup] no precomputed portfolio — running precompute once " +
      "(synthesizes ~80K loans; the three golden suites then share this gz)",
  );

  // Reuse the SAME build-time step the prebuild chain uses, via the existing
  // `precompute-portfolio` npm script (which runs the pinned tsx). Inherit
  // stdio so its timing/size logs surface in the test run. `shell: true` so the
  // npm/npx shim resolves on both POSIX and the CI runner.
  const result = spawnSync("npm", ["run", "precompute-portfolio"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error(
      `[test/global-setup] precompute-portfolio.ts failed (exit ${result.status}). ` +
        "Golden suites cannot run without the shared portfolio artifact.",
    );
  }

  if (!fs.existsSync(ARTIFACT)) {
    throw new Error(
      `[test/global-setup] precompute reported success but ${ARTIFACT} is missing.`,
    );
  }

  createdByUs = true;
}

export async function teardown() {
  if (createdByUs && fs.existsSync(ARTIFACT)) {
    fs.rmSync(ARTIFACT);
    console.log(`[test/global-setup] removed test-created artifact ${ARTIFACT}`);
  }
}
