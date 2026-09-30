/**
 * Verify JANA_DEMO reaches the Docker image — at build time AND at runtime.
 *
 * Why this exists
 * ---------------
 * Docker is one environment the app runs in with the demo switch available.
 * But Phase 1 wired the demo flag through npm only, so the Dockerfile ran a
 * bare `npm run build` with JANA_DEMO unset -- which means no precomputed
 * portfolio and, at runtime, no demo switch. Rebuilding the image would have
 * produced a container with an empty loan book and no Demo menu, and nothing
 * would have errored. It would simply have looked like the data had vanished.
 *
 * There are two halves and both are required:
 *
 *   build ARG  -- decides whether the precomputed portfolio file is
 *                 generated. (The demo code is in the bundle either way;
 *                 nothing is compiled out.)
 *   runtime ENV -- isDemoBuild() reads process.env in the running server to
 *                 gate the Demo menu, the toggle route and the provider's
 *                 dynamic import. This is what makes the demo switch
 *                 available.
 *
 * Setting only the ARG yields the worst case: an image built with the
 * precomputed portfolio that never offers the demo switch, failing silently.
 *
 * Usage:  node scripts/check-docker-demo-flag.mjs
 * Exit 0 = wired, 1 = a stage or compose file would silently lose the demo
 * switch.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

// --- Dockerfile: both stages need the flag ---------------------------------
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

  for (const stage of stages) {
    const hasEnv = /^ENV\s+JANA_DEMO=/m.test(stage.body);
    if (!hasEnv) {
      failures.push(
        `Dockerfile stage "${stage.name}": no \`ENV JANA_DEMO=\`. ` +
          (stage.name === "builder"
            ? "next build will run unflagged and skip the precomputed " +
              "portfolio file."
            : "The running server reads process.env.JANA_DEMO; without it the " +
              "Demo menu and /api/demo/mode disappear, even though the demo " +
              "code is in the image."),
      );
    }
    if (!/^ARG\s+JANA_DEMO/m.test(stage.body)) {
      failures.push(
        `Dockerfile stage "${stage.name}": no \`ARG JANA_DEMO\`. ARGs do not ` +
          `cross FROM boundaries, so each stage must re-declare it.`,
      );
    }
  }
}

// --- compose files: build arg AND runtime environment ----------------------
for (const file of ["docker-compose.yml", "docker-compose.offline.yml"]) {
  const p = join(repoRoot, file);
  if (!existsSync(p)) continue;
  const body = readFileSync(p, "utf8");

  // Under `args:` (build-time) -- YAML mapping form `JANA_DEMO: ...`
  const inArgs = /^\s+JANA_DEMO:\s*\S/m.test(body);
  // Under `environment:` -- either mapping or `- JANA_DEMO=...` list form
  const inEnv = /^\s+-?\s*JANA_DEMO[=:]\s*\S/m.test(body);

  if (!inArgs) {
    failures.push(
      `${file}: no JANA_DEMO under build \`args:\`. The image would be built ` +
        `unflagged regardless of the Dockerfile default being overridden.`,
    );
  }
  if (!inEnv) {
    failures.push(
      `${file}: no JANA_DEMO under \`environment:\`. The container would run ` +
        `without the runtime flag.`,
    );
  }
}

if (failures.length > 0) {
  console.error("\nJANA_DEMO does not reach the Docker image.\n");
  for (const f of failures) console.error(`  - ${f}\n`);
  console.error(
    "Without JANA_DEMO the Docker deployment loses the demo switch silently:\n" +
      "an empty product with no error explaining itself.\n",
  );
  process.exit(1);
}

console.log(
  "[check-docker-demo-flag] JANA_DEMO reaches both Dockerfile stages and " +
    "both compose files (build args + runtime env).",
);
