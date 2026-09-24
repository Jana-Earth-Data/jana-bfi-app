/**
 * Harness smoke test — jana-bfi-app (Task P0.2 of PROJECT_PLAN.md).
 *
 * WHY THIS EXISTS
 * ---------------
 * P0's exit criterion requires `npm test` to exist and run green even with a
 * single trivial test. This file is that trivial test: it proves the Vitest
 * runner, the `node` environment, the `globals: true` API (describe/it/expect
 * with no import), and the `@/` alias all resolve inside CI and Docker before
 * the Tier-3 golden suites (Phase B) land. It intentionally exercises the
 * alias so a mis-wired tsconfig/vitest path fails here loudly, not in a golden.
 */
import { NPR_PER_USD } from "@/lib/units";

describe("harness smoke", () => {
  it("runs the vitest runner with globals enabled", () => {
    expect(1 + 1).toBe(2);
  });

  it("resolves the @/ alias to the repo root", () => {
    // If the alias is wrong this import is undefined and the assertion fails.
    expect(typeof NPR_PER_USD).toBe("number");
    expect(NPR_PER_USD).toBeGreaterThan(0);
  });
});
