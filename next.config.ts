import type { NextConfig } from "next";

/**
 * JANA_DEMO decides whether the demo switch is available on this deployment
 * and, here, whether the precomputed demo portfolio file is traced into the
 * output. It does NOT remove the demo code: there is no alias for lib/demo,
 * so the demo layer is in every bundle. See lib/demo/provider.ts.
 */
const isDemoBuild = process.env.JANA_DEMO === "1";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" } : {}),

  // Force the standalone tracer to include the precomputed portfolio, but
  // ONLY when JANA_DEMO=1 (the demo switch is available on this deployment).
  //
  // Runtime code loads it through a dynamic fs.readFileSync path the tracer
  // cannot detect statically, so without this a standalone deployment with
  // the demo switch falls back to in-memory synthesis and pays a ~20s cold
  // start.
  //
  // The condition keeps the 2.7 MB portfolio file out of deployments where
  // demo mode cannot be switched on, since nothing there would use it. It is
  // not what keeps fabricated data out of the bank's data: the synthesizer
  // itself ships in every bundle, and that separation rests on the
  // lib/demo/provider.ts boundary and the `origin` provenance column.
  ...(isDemoBuild
    ? {
        outputFileTracingIncludes: {
          "/**/*": ["./lib/demo/precomputed-portfolio.json.gz"],
        },
      }
    : {}),
};

export default nextConfig;
