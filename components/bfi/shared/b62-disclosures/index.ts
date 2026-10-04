/**
 * IFRS S2 B62 Disclosure Components
 *
 * Barrel export for all B62 disclosure components used in the NFRS tab.
 */

export { GrossExposureMatrix } from "./gross-exposure-matrix";
export type { GrossExposureMatrixRow } from "./gross-exposure-matrix";

export { CoverageDisclosure } from "./coverage-disclosure";
export type { GrossExposureCoverage } from "./coverage-disclosure";

export { MethodologyDisclosure } from "./methodology-disclosure";
export type { MethodologyDisclosure as MethodologyDisclosureType } from "./methodology-disclosure";

export { DataExtentDisclosure } from "./data-extent-disclosure";
export type { DataExtentDisclosure as DataExtentDisclosureType } from "./data-extent-disclosure";

export { ConsolidationApproach } from "./consolidation-approach";
export type { ConsolidationApproach as ConsolidationApproachType } from "./consolidation-approach";
