/**
 * Demo PCAF evidence seed — the fabricated document review that the synthetic
 * book would have if a bank had actually chased its borrowers' annual reports.
 *
 * Why this file exists
 * --------------------
 * PCAF Score 1 (Option 1a, third-party-verified emissions) and Score 2
 * (Option 1b, unverified published emissions) cannot be inferred: nothing Jana
 * observes tells you whether a borrower publishes an assured GHG inventory.
 * Someone has to open the annual report and look. lib/regulatory/pcaf/
 * evidence-matrix.ts models exactly that act — a catalogue of documents, a
 * per-borrower review status, and resolveAvailability() which turns a VERIFIED
 * in-year document into a data-availability flag.
 *
 * The demo has no officer doing reviews, so the top of the score histogram
 * would be empty. Previously the gap was filled by a hardcoded list of
 * borrower-name substrings (PCAF_NAME_FIXTURES_* in lib/demo/fixtures.ts) that
 * inferPcafAvailability() consumed directly. That put fabricated answers into
 * the scoring path: the two publish flags were set by a name match rather than
 * by evidence, so the mechanism the product is sold on — "the score rests on a
 * document an officer verified" — was bypassed for exactly the loans at the top
 * of the ladder (backlog N0.4).
 *
 * This module replaces that. Instead of asserting a FLAG, it fabricates the
 * EVIDENCE: a verified assurance opinion (reportingYear = the latest full year)
 * for the demo's Score-1 exemplar, and a verified published GHG inventory for
 * its Score-2 exemplars. Those records run through the SAME resolveAvailability
 * the live path uses. Demo and live now differ only in where the evidence comes
 * from — seeded here, or entered by an officer against a real report — not in
 * how a score is derived from it. A live build has no seed, so the two publish
 * flags start false and are established only by real document review.
 *
 * Arithmetic-neutral: the borrowers chosen below are the same names the old
 * fixtures matched, and a verified in-year document resolves to the same flag
 * the fixture asserted, so the disclosure histogram is unchanged
 * ({1: 5, 2: 39, 3: 991, 5: 79000}). What changed is the provenance: every
 * Score 1/2 attribution now traces to a document record, not a name.
 */

import type { Borrower } from "@/lib/types/bfi";
import type { PcafEvidenceRecord } from "@/lib/regulatory/pcaf/evidence-matrix";
import { LATEST_FULL_YEAR } from "@/lib/regulatory/reporting/period";

/**
 * Borrower whose name (lower-cased substring) is treated as publishing
 * third-party-VERIFIED emissions. Seeded as a verified `assurance-opinion`
 * document → borrower_publishes_verified → PCAF Option 1a → Score 1.
 *
 * Whether the real company commissions assurance is not asserted; this is the
 * demo's Score-1 exemplar so the disclosure histogram has a top end.
 */
const SEED_VERIFIED_NAMES = ["ghorahi"] as const;

/**
 * Borrowers treated as publishing UNVERIFIED emissions. Seeded as a verified
 * `ghg-inventory` document → borrower_publishes_unverified → Option 1b →
 * Score 2. Plausible for the NEPSE-listed subset whose annual reports carry
 * scope 1/2 without ISO 14064 assurance — but plausible is not established,
 * which is why this is a seed and a live build has none.
 */
const SEED_UNVERIFIED_NAMES = [
  "arghakhanchi",
  "hetauda cement",
  "butwal power",
] as const;

function nameMatches(borrowerName: string, needles: readonly string[]): boolean {
  const n = borrowerName.toLowerCase();
  return needles.some((s) => n.includes(s));
}

/**
 * A verified, in-year evidence record for one borrower-scoped document.
 *
 * `reportingYear` is the latest fully-reported year so the record is NOT stale
 * for a FY{LATEST_FULL_YEAR} disclosure (isStale() in evidence-matrix.ts drops
 * evidence covering an earlier year). `loanId` is null because both seeded
 * documents are company-level ("borrower" scope): one review serves every loan
 * to that borrower.
 */
function verifiedRecord(documentId: string): PcafEvidenceRecord {
  return {
    documentId,
    loanId: null,
    status: "verified",
    reportingYear: LATEST_FULL_YEAR,
    notes: "Demo seed — illustrative verified document (not a real review).",
    updatedAt: null,
    updatedBy: "demo-seed",
  };
}

/**
 * The seeded PCAF evidence records for one borrower.
 *
 * Returns a verified `assurance-opinion` (→ Score 1) for the demo's verified
 * exemplar, a verified `ghg-inventory` (→ Score 2) for its unverified
 * exemplars, and an empty array for everyone else. The records are handed to
 * resolveAvailability() alongside the inferred flags; the resolver's precedence
 * (a verified in-year document sets the flag true) reproduces the old
 * name-fixture outcome without the name-fixture mechanism.
 */
export function demoPcafEvidenceRecords(borrower: Borrower): PcafEvidenceRecord[] {
  if (nameMatches(borrower.name, SEED_VERIFIED_NAMES)) {
    return [verifiedRecord("assurance-opinion")];
  }
  if (nameMatches(borrower.name, SEED_UNVERIFIED_NAMES)) {
    return [verifiedRecord("ghg-inventory")];
  }
  return [];
}
