/**
 * UNIT TESTS — PCAF evidence document matrix.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 * lib/regulatory/pcaf/evidence-matrix.ts — the module that turns officer-
 * recorded document statuses into the availability flags PCAF scoring actually
 * consumes, and records WHY each flag is what it is (the audit basis).
 *
 * WHY EXHAUSTIVE
 * --------------
 * This module encodes the "only a verified, in-year document establishes a
 * claim" rule and its precedence ladder (document > inference, in both
 * directions). Every rung of that ladder is a disclosure-affecting branch:
 *   • verified in-year        → flag true, basis "document"
 *   • verified but stale      → flag false, basis "document-stale"
 *   • unavailable/n-a         → flag false, basis "document-absent"
 *   • received (unread)       → basis "unevidenced" (does NOT establish)
 *   • not-collected/requested → basis "unevidenced"
 *   • no document at all      → basis "inference" (pass-through)
 *   • Score-1-subsumes-Score-2 coherence fix
 * plus the borrower-vs-activity scoping (§5.3 project-finance numerator) and
 * the staleness / progress helpers. P1.5 pins each.
 */
import { describe, expect, it } from "vitest";
import {
  PCAF_EVIDENCE_BY_ID,
  PCAF_EVIDENCE_DOCUMENTS,
  PCAF_EVIDENCE_STATUSES,
  PCAF_EVIDENCE_STATUS_LABEL,
  evidenceAttachmentKey,
  evidenceProgress,
  evidenceScopeKey,
  isResolved,
  isStale,
  recordFor,
  resolveAvailability,
  supportsClaim,
  type PcafEvidenceRecord,
  type PcafEvidenceStatus,
} from "@/lib/regulatory/pcaf/evidence-matrix";
import type { PcafDataAvailability } from "@/lib/regulatory/pcaf/types";

const DISCLOSURE_YEAR = 2024;

/** All-false inference baseline (nothing established from Jana's own data). */
function inferredNone(overrides: Partial<PcafDataAvailability> = {}): PcafDataAvailability {
  return {
    borrower_publishes_verified: false,
    borrower_publishes_unverified: false,
    energy_consumption_data_available: false,
    physical_activity_data_available: false,
    revenue_data_available: false,
    sector_average_only: false,
    ...overrides,
  };
}

function makeRecord(overrides: Partial<PcafEvidenceRecord> & { documentId: string }): PcafEvidenceRecord {
  return {
    loanId: null,
    status: "not-collected",
    reportingYear: null,
    notes: null,
    updatedAt: null,
    updatedBy: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Catalogue + simple predicates.
// ---------------------------------------------------------------------------

describe("catalogue", () => {
  it("indexes every document by id", () => {
    for (const doc of PCAF_EVIDENCE_DOCUMENTS) {
      expect(PCAF_EVIDENCE_BY_ID[doc.id]).toBe(doc);
    }
  });

  it("labels every dropdown status", () => {
    for (const status of PCAF_EVIDENCE_STATUSES) {
      expect(PCAF_EVIDENCE_STATUS_LABEL[status]).toBeTruthy();
    }
  });
});

describe("supportsClaim", () => {
  it("is true ONLY for verified", () => {
    expect(supportsClaim("verified")).toBe(true);
    for (const s of ["not-applicable", "not-collected", "requested", "received", "unavailable"] as PcafEvidenceStatus[]) {
      expect(supportsClaim(s)).toBe(false);
    }
  });
});

describe("isResolved", () => {
  it("is true for verified / unavailable / not-applicable", () => {
    for (const s of ["verified", "unavailable", "not-applicable"] as PcafEvidenceStatus[]) {
      expect(isResolved(s)).toBe(true);
    }
  });
  it("is false for the in-progress statuses", () => {
    for (const s of ["not-collected", "requested", "received"] as PcafEvidenceStatus[]) {
      expect(isResolved(s)).toBe(false);
    }
  });
});

describe("isStale", () => {
  it("is false for a non-verified record", () => {
    expect(isStale(makeRecord({ documentId: "ghg-inventory", status: "received", reportingYear: 2020 }), DISCLOSURE_YEAR)).toBe(false);
  });
  it("is false for a verified record with no reporting year", () => {
    expect(isStale(makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: null }), DISCLOSURE_YEAR)).toBe(false);
  });
  it("is true for a verified record covering an earlier year", () => {
    expect(isStale(makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: 2023 }), DISCLOSURE_YEAR)).toBe(true);
  });
  it("is false for a verified record covering the disclosure year", () => {
    expect(isStale(makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: 2024 }), DISCLOSURE_YEAR)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Scoping keys.
// ---------------------------------------------------------------------------

describe("evidenceAttachmentKey", () => {
  it("is `doc_<id>` with no loan component", () => {
    const doc = PCAF_EVIDENCE_BY_ID["assurance-opinion"];
    expect(evidenceAttachmentKey(doc)).toBe("doc_assurance-opinion");
  });
});

describe("evidenceScopeKey", () => {
  it("is null for a borrower-scoped document regardless of PF", () => {
    const doc = PCAF_EVIDENCE_BY_ID["assurance-opinion"]; // scope: borrower
    expect(evidenceScopeKey(doc, "l-1", true)).toBeNull();
    expect(evidenceScopeKey(doc, "l-1", false)).toBeNull();
  });
  it("is the loanId for an activity document on a PF loan (§5.3)", () => {
    const doc = PCAF_EVIDENCE_BY_ID["production-records"]; // scope: activity
    expect(evidenceScopeKey(doc, "l-1", true)).toBe("l-1");
  });
  it("is null for an activity document on a non-PF loan", () => {
    const doc = PCAF_EVIDENCE_BY_ID["production-records"];
    expect(evidenceScopeKey(doc, "l-1", false)).toBeNull();
  });
});

describe("recordFor", () => {
  const doc = PCAF_EVIDENCE_BY_ID["production-records"]; // activity-scoped

  it("picks the loan-scoped row for a PF loan", () => {
    const loanScoped = makeRecord({ documentId: "production-records", loanId: "l-1", status: "verified" });
    const borrowerScoped = makeRecord({ documentId: "production-records", loanId: null, status: "unavailable" });
    expect(recordFor(doc, [borrowerScoped, loanScoped], "l-1", true)).toBe(loanScoped);
  });

  it("picks the borrower-scoped row for a non-PF loan", () => {
    const borrowerScoped = makeRecord({ documentId: "production-records", loanId: null, status: "verified" });
    expect(recordFor(doc, [borrowerScoped], "l-1", false)).toBe(borrowerScoped);
  });

  it("returns undefined when no matching row exists", () => {
    expect(recordFor(doc, [], "l-1", false)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// resolveAvailability — the precedence ladder.
// ---------------------------------------------------------------------------

describe("resolveAvailability", () => {
  const ctx = { loanId: "l-1", isProjectFinance: false };

  it("keeps the inferred flag value but marks a document-backed flag unevidenced when no row exists", () => {
    const inferred = inferredNone({ physical_activity_data_available: true, sector_average_only: true });
    const { flags, basis } = resolveAvailability(inferred, [], DISCLOSURE_YEAR, ctx);
    // The flag VALUE is untouched (the no-row branch only annotates the basis)…
    expect(flags.physical_activity_data_available).toBe(true);
    // …but because a document (production-records) *could* establish it and none
    // was supplied, its basis downgrades from inference to unevidenced.
    expect(basis.physical_activity_data_available).toEqual({ source: "unevidenced" });
    // sector_average_only is established by NO document, so it stays inference.
    expect(flags.sector_average_only).toBe(true);
    expect(basis.sector_average_only).toEqual({ source: "inference" });
  });

  it("a verified in-year document establishes the flag (basis document)", () => {
    const rec = makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: 2024 });
    const { flags, basis } = resolveAvailability(inferredNone(), [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_unverified).toBe(true);
    expect(basis.borrower_publishes_unverified).toMatchObject({ source: "document", documentId: "ghg-inventory", reportingYear: 2024 });
  });

  it("a verified in-year document with null reportingYear still establishes the flag", () => {
    const rec = makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: null });
    const { flags, basis } = resolveAvailability(inferredNone(), [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_unverified).toBe(true);
    expect(basis.borrower_publishes_unverified).toMatchObject({ source: "document", reportingYear: null });
  });

  it("a verified but stale document clears the flag (basis document-stale)", () => {
    const inferred = inferredNone({ borrower_publishes_unverified: true }); // inference said yes
    const rec = makeRecord({ documentId: "ghg-inventory", status: "verified", reportingYear: 2023 });
    const { flags, basis } = resolveAvailability(inferred, [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_unverified).toBe(false);
    expect(basis.borrower_publishes_unverified).toMatchObject({ source: "document-stale", reportingYear: 2023 });
  });

  it("confirmed-unavailable clears the flag (basis document-absent)", () => {
    const inferred = inferredNone({ borrower_publishes_unverified: true });
    const rec = makeRecord({ documentId: "ghg-inventory", status: "unavailable" });
    const { flags, basis } = resolveAvailability(inferred, [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_unverified).toBe(false);
    expect(basis.borrower_publishes_unverified).toMatchObject({ source: "document-absent", documentId: "ghg-inventory" });
  });

  it("not-applicable also clears the flag (basis document-absent)", () => {
    const rec = makeRecord({ documentId: "assurance-opinion", status: "not-applicable" });
    const { flags, basis } = resolveAvailability(inferredNone({ borrower_publishes_verified: true }), [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_verified).toBe(false);
    expect(basis.borrower_publishes_verified).toMatchObject({ source: "document-absent" });
  });

  it("received (unread) does NOT establish the flag (basis unevidenced)", () => {
    const rec = makeRecord({ documentId: "ghg-inventory", status: "received", reportingYear: 2024 });
    const { flags, basis } = resolveAvailability(inferredNone(), [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_unverified).toBe(false);
    expect(basis.borrower_publishes_unverified).toEqual({ source: "unevidenced" });
  });

  it("not-collected / requested rows read as unevidenced (not inference)", () => {
    const collected = makeRecord({ documentId: "ghg-inventory", status: "not-collected" });
    const requested = makeRecord({ documentId: "financial-statements", status: "requested" });
    const { basis } = resolveAvailability(inferredNone(), [collected, requested], DISCLOSURE_YEAR, ctx);
    expect(basis.borrower_publishes_unverified).toEqual({ source: "unevidenced" });
    expect(basis.revenue_data_available).toEqual({ source: "unevidenced" });
  });

  it("Score-1 subsumes Score-2: verified assurance forces publishes_unverified true", () => {
    const rec = makeRecord({ documentId: "assurance-opinion", status: "verified", reportingYear: 2024 });
    const { flags } = resolveAvailability(inferredNone(), [rec], DISCLOSURE_YEAR, ctx);
    expect(flags.borrower_publishes_verified).toBe(true);
    expect(flags.borrower_publishes_unverified).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evidenceProgress.
// ---------------------------------------------------------------------------

describe("evidenceProgress", () => {
  it("counts resolved documents out of the catalogue total", () => {
    const records = [
      makeRecord({ documentId: "assurance-opinion", status: "verified" }),
      makeRecord({ documentId: "ghg-inventory", status: "unavailable" }),
      makeRecord({ documentId: "energy-records", status: "requested" }), // NOT resolved
    ];
    const { resolved, total } = evidenceProgress(records);
    expect(resolved).toBe(2);
    expect(total).toBe(PCAF_EVIDENCE_DOCUMENTS.length);
  });

  it("is zero-resolved when nothing has been reviewed", () => {
    expect(evidenceProgress([]).resolved).toBe(0);
  });
});
