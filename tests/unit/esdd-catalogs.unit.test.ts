/**
 * UNIT TESTS — ESDD question catalogs (executable surfaces).
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/esdd/annex5-questions.ts     — NRB ESRM Annex 5 ESDD
 *     checklist (General + EHS + Social) and fullChecklist().
 *   • lib/regulatory/esdd/annex5b-pf-questions.ts — IFC PS Annex 5b PF
 *     screening catalog, ANNEX5B_BY_PS, pfScreeningChecklist(),
 *     pfCriticalItems().
 *
 * WHY
 * ---
 * Most of both files is verbatim catalog *data*, but the executable wrappers
 * (fullChecklist / pfScreeningChecklist / pfCriticalItems) are what the wizard
 * renders and what the scorer counts against. P1.5 pins:
 *   - the catalog assembles to the expected shape (each section spread once),
 *   - the wrappers return the assembled catalog (not a stale copy),
 *   - pfCriticalItems() actually filters on the termination-trigger marker.
 * These are structural invariants; the per-item wording is asserted implicitly
 * by the golden snapshots exercised elsewhere.
 */
import { describe, expect, it } from "vitest";
import {
  ANNEX5_EHS_RISK,
  ANNEX5_GENERAL_RISK,
  ANNEX5_SOCIAL_RISK,
  ESDD_LOAN_CATEGORY_LABEL,
  ESDD_LOAN_CATEGORY_ORDER,
  fullChecklist,
} from "@/lib/regulatory/esdd/annex5-questions";
import {
  ANNEX5B_ALL,
  ANNEX5B_BY_PS,
  pfCriticalItems,
  pfScreeningChecklist,
} from "@/lib/regulatory/esdd/annex5b-pf-questions";

// ---------------------------------------------------------------------------
// Annex 5 — ESDD checklist.
// ---------------------------------------------------------------------------

describe("annex5-questions — fullChecklist", () => {
  it("concatenates General + EHS + Social sections, in that order", () => {
    const list = fullChecklist();
    expect(list).toHaveLength(
      ANNEX5_GENERAL_RISK.length + ANNEX5_EHS_RISK.length + ANNEX5_SOCIAL_RISK.length,
    );
    // First rung is the first General question; last is the last Social question.
    expect(list[0]).toBe(ANNEX5_GENERAL_RISK[0]);
    expect(list[list.length - 1]).toBe(ANNEX5_SOCIAL_RISK[ANNEX5_SOCIAL_RISK.length - 1]);
  });

  it("ignores the optional sector-slug argument (returns the same list)", () => {
    // The slug param is reserved for future sector supplements; today it is a
    // no-op — both call shapes must return an identical checklist.
    expect(fullChecklist("hydropower")).toEqual(fullChecklist());
  });

  it("every question id is unique across the assembled checklist", () => {
    const ids = fullChecklist().map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("loan-category label map covers every ordered category", () => {
    for (const category of ESDD_LOAN_CATEGORY_ORDER) {
      expect(ESDD_LOAN_CATEGORY_LABEL[category]).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Annex 5b — IFC PS PF screening catalog.
// ---------------------------------------------------------------------------

describe("annex5b-pf-questions — screening catalog", () => {
  it("pfScreeningChecklist() returns the full assembled catalog", () => {
    expect(pfScreeningChecklist()).toBe(ANNEX5B_ALL);
    expect(pfScreeningChecklist().length).toBeGreaterThan(0);
  });

  it("ANNEX5B_BY_PS partitions the catalog across PS1..PS8 with no loss", () => {
    const grouped = Object.values(ANNEX5B_BY_PS).reduce((n, items) => n + items.length, 0);
    expect(grouped).toBe(ANNEX5B_ALL.length);
  });

  it("every catalog item carries a PS that has a bucket in ANNEX5B_BY_PS", () => {
    for (const item of ANNEX5B_ALL) {
      expect(ANNEX5B_BY_PS[item.ifcPS]).toContain(item);
    }
  });

  it("pfCriticalItems() returns exactly the termination-trigger items", () => {
    const critical = pfCriticalItems();
    // Non-empty (the catalog carries termination-grade markers) …
    expect(critical.length).toBeGreaterThan(0);
    // … and every returned item is a trigger, every trigger is returned.
    expect(critical.every((i) => i.ifcPsTerminationTrigger === true)).toBe(true);
    expect(critical.length).toBe(
      ANNEX5B_ALL.filter((i) => i.ifcPsTerminationTrigger === true).length,
    );
  });
});
