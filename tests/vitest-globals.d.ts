/**
 * Ambient Vitest globals — jana-bfi-app (Task P0.4 of PROJECT_PLAN.md).
 *
 * WHY THIS EXISTS
 * ---------------
 * `vitest.config.mts` sets `globals: true`, so test files call `describe`,
 * `it`, `expect`, etc. WITHOUT importing them. The Vitest runner injects those
 * at runtime, but `tsc --noEmit` (the CI type-check step) does not know about
 * them and fails with TS2582 / TS2304.
 *
 * We pull in Vitest's global type declarations here rather than adding
 * `"types": ["vitest/globals"]` to tsconfig.json, because an explicit `types`
 * array DISABLES TypeScript's automatic inclusion of every other `@types/*`
 * package (node, react, …) that the Next.js app relies on — it would fix the
 * tests and break the app build. A single reference file scoped to tests keeps
 * the app's type environment untouched while giving the suites their globals.
 *
 * The file is picked up by tsconfig's TS-glob include; it emits nothing.
 */
/// <reference types="vitest/globals" />

export {};
