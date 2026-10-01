/**
 * Prebuild gate: synthesize the demo portfolio.
 *
 * package.json runs this before every `next build`. As of P5.8, this ALWAYS
 * generates the precomputed demo portfolio — there is one build that includes
 * the demo capability, and JANA_DEMO is a runtime-only setting controlling
 * whether the demo switch is offered to users.
 *
 * The precomputed file is gitignored and takes ~20 seconds to generate
 * (80,035 loans). Generating it at build time avoids the cold-start delay
 * when a user first switches demo on.
 *
 * Written as .mjs so it runs under plain node with no TypeScript toolchain,
 * which keeps the gate working even if the dev dependencies are not
 * installed in the build environment.
 */

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

console.log("[precompute-guard] Synthesizing the demo portfolio...");
const result = spawnSync(
  "npx",
  ["tsx", "scripts/precompute-portfolio.ts"],
  { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" },
);

if (result.status !== 0) {
  console.error(
    "[precompute-guard] Synthesis failed. Refusing to continue: a build " +
      "without its portfolio would fall back to synthesizing on first " +
      "request, which is the ~20s cold start the precompute exists to avoid.",
  );
  process.exit(result.status ?? 1);
}

console.log("[precompute-guard] ✓ Portfolio precomputed.");
