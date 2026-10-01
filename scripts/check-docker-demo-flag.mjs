/**
 * Verify JANA_DEMO reaches the Docker runtime (P5.8 update).
 *
 * Why this exists
 * ---------------
 * As of P5.8, JANA_DEMO is a runtime-only setting that controls whether the
 * demo switch is offered to users. The build ALWAYS generates the precomputed
 * portfolio, so there is no build-time flag anymore.
 *
 * This guard verifies that JANA_DEMO is set as an ENV in the Dockerfile
 * runner stage (not as a build ARG) and in docker-compose files' runtime
 * environment.
 *
 * The demo code and precomputed portfolio are in every image; JANA_DEMO gates
 * the Demo menu, the /api/demo/mode toggle route, and isDemoBuild() reads
 * process.env.JANA_DEMO to decide whether to offer the demo switch.
 *
 * Usage:  node scripts/check-docker-demo-flag.mjs
 * Exit 0 = wired correctly, 1 = runtime would silently lose the demo switch.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// --- Dockerfile: runner stage needs runtime ENV (not build ARG) -----------
const dockerfilePath = join(repoRoot, "Dockerfile");
if (!existsSync(dockerfilePath)) {
  // No Dockerfile means we are not in a Docker build (e.g. Vercel).
  // This guard only applies to Docker — skip it entirely.
  console.log(
    "[check-docker-demo-flag] No Dockerfile present (Vercel build) — skipping Docker-specific checks.",
  );
  process.exit(0);
} else {
  const df = readFileSync(dockerfilePath, "utf8");
  // Split on FROM ... AS <stage> so each stage can be checked independently.
  const stages = df
    .split(/^FROM /m)
    .slice(1)
    .map((chunk) => {
      const name = chunk.match(/AS\s+(\S+)/i)?.[1] ?? "(unnamed)";
      return { name, body: chunk };
    });

  const runnerStage = stages.find((s) => s.name === "runner");
  if (!runnerStage) {
    failures.push(
      "Dockerfile: no 'runner' stage found. The runtime ENV cannot be verified.",
    );
  } else {
    const hasEnv = /^ENV\s+JANA_DEMO=/m.test(runnerStage.body);
    if (!hasEnv) {
      failures.push(
        `Dockerfile stage "runner": no \`ENV JANA_DEMO=\`. ` +
          "The running server reads process.env.JANA_DEMO; without it the " +
          "Demo menu and /api/demo/mode disappear.",
      );
    }
  }

  // P5.8: build ARGs should be removed (no longer needed)
  const builderStage = stages.find((s) => s.name === "builder");
  if (builderStage && /^ARG\s+JANA_DEMO/m.test(builderStage.body)) {
    failures.push(
      `Dockerfile stage "builder": \`ARG JANA_DEMO\` found but no longer needed. ` +
        "P5.8: the build always generates the portfolio; remove the build ARG.",
    );
  }
}

// --- compose files: runtime environment only (no build args) ---------------
for (const file of ["docker-compose.yml", "docker-compose.offline.yml"]) {
  const p = join(repoRoot, file);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, "utf8");

  // Under `environment:` -- either mapping or `- JANA_DEMO=...` list form
  const inEnv = /^\s+-?\s*JANA_DEMO[=:]\s*\S/m.test(body);
  if (!inEnv) {
    failures.push(
      `${file}: no JANA_DEMO under \`environment:\`. The container would run ` +
        `without the runtime flag.`,
    );
  }

  // P5.8: build args should be removed (no longer needed)
  const inArgs = /^\s+args:\s*\n.*JANA_DEMO:/ms.test(body);
  if (inArgs) {
    failures.push(
      `${file}: JANA_DEMO found under build \`args:\` but no longer needed. ` +
        "P5.8: the build always generates the portfolio; remove the build arg.",
    );
  }
}

if (failures.length > 0) {
  console.error("\nJANA_DEMO wiring incorrect for P5.8.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    "P5.8: JANA_DEMO is runtime-only. The build always generates the portfolio.\n" +
      "Remove build ARGs; keep runtime ENV.\n",
  );
  process.exit(1);
}

console.log(
  "[check-docker-demo-flag] ✓ JANA_DEMO runtime ENV present, build ARGs removed (P5.8).",
);
