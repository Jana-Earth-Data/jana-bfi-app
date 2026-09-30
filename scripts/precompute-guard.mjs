/**
 * Prebuild gate: synthesize the demo portfolio, or refuse to.
 *
 * package.json runs this before every `next build`. It used to run the
 * synthesizer unconditionally, which meant a build for a deployment without
 * the demo switch would spend ~20 seconds inventing 80,035 loans and ship a
 * 2.7 MB file nothing there could use.
 *
 * Now the flag decides. JANA_DEMO=1 (demo switch available) generates the
 * precomputed portfolio file; anything else skips it and actively removes a
 * stale one left by an earlier JANA_DEMO=1 build in the same working tree
 * (the file is gitignored and long-lived). Note this governs only the
 * precomputed FILE: the synthesizer code in lib/demo ships in every bundle,
 * and keeping fabricated data out of the bank's data is the job of the
 * lib/demo/provider.ts boundary and the `origin` provenance column.
 *
 * Written as .mjs so it runs under plain node with no TypeScript toolchain,
 * which keeps the gate working even if the dev dependencies are not
 * installed in the build environment.
 */

import { existsSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const ARTIFACT_NAME = "precomputed-portfolio.json.gz";
const artifact = join(repoRoot, "lib/demo", ARTIFACT_NAME);
const isDemo = process.env.JANA_DEMO === "1";

/**
 * INVARIANT: a build never destroys customer data.
 *
 * The build touches no database. It reads source, writes .next, and manages
 * exactly one generated file -- the synthesized portfolio below, which is
 * gitignored, reproducible from source in about twenty seconds, and contains
 * nothing a bank has entered.
 *
 * Everything a customer creates lives in Postgres: ESDD answers, screenings,
 * taxonomy assessments, corrective actions, evidence attachments, PCAF
 * document review. None of it is reachable from here, and purging seeded rows
 * in a live environment must always be an explicit operator action rather than
 * a side effect of deploying.
 *
 * The deletion below is guarded rather than trusted. A path computed from
 * __dirname is normally right, but "normally right" is how a delete gets
 * pointed somewhere unintended after a refactor, and the cost of being wrong
 * here is asymmetric.
 */
function assertSafeToDelete(target) {
  if (basename(target) !== ARTIFACT_NAME) {
    throw new Error(
      `[precompute-guard] refusing to delete ${target}: name is not ` +
        `${ARTIFACT_NAME}. This script deletes exactly one generated file.`,
    );
  }
  if (!target.startsWith(join(repoRoot, "lib/demo") + "/")) {
    throw new Error(
      `[precompute-guard] refusing to delete ${target}: outside lib/demo.`,
    );
  }
  const st = statSync(target);
  if (!st.isFile()) {
    throw new Error(
      `[precompute-guard] refusing to delete ${target}: not a regular file.`,
    );
  }
}

if (!isDemo) {
  console.log(
    "[precompute-guard] JANA_DEMO is not set — building WITHOUT the demo switch; the precomputed portfolio is not generated.",
  );
  if (existsSync(artifact)) {
    assertSafeToDelete(artifact);
    rmSync(artifact);
    console.log(
      "[precompute-guard] Removed a stale precomputed portfolio left by an " +
        "earlier JANA_DEMO=1 build. A deployment without the demo switch " +
        "does not carry the precomputed portfolio.",
    );
  }
  console.log(
    "[precompute-guard] The loan book will be empty until core-banking " +
      "import is available. This is expected.",
  );
  process.exit(0);
}

console.log("[precompute-guard] JANA_DEMO=1 — synthesizing the demo portfolio.");
const result = spawnSync(
  "npx",
  ["tsx", "scripts/precompute-portfolio.ts"],
  { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) {
  console.error(
    "[precompute-guard] Synthesis failed. Refusing to continue: a JANA_DEMO=1 build " +
      "without its portfolio would fall back to synthesizing on first " +
      "request, which is the ~20s cold start the precompute exists to avoid.",
  );
  process.exit(result.status ?? 1);
}
