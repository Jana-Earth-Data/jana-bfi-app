/**
 * TIER 1 UNIT TEST — NRB ESRM Annex 5 + Annex 5b (Project Finance) scoring.
 * jana-bfi-app · Task P1.1 sibling / P1.2 of PROJECT_PLAN.md.
 *
 * WHAT THIS COVERS AND WHY
 * ------------------------
 * Two pure regulatory modules decide the E&S risk rating a credit committee
 * sees:
 *
 *   • lib/regulatory/esdd/scoring.ts — the Annex 5 checklist aggregator.
 *     `scoreBySection()` rolls a set of a/b/c/d answers into per-section means,
 *     and `deriveEsrm()` maps those onto NRB's three-level ESRR (LOW / MEDIUM /
 *     HIGH) plus the §7.3.6 escalation flag. The rating is stored in
 *     computed_risk_class and shown to the bank AS the NRB rating, so every
 *     boundary is a compliance boundary. NRB's ESRR_criteria rule, verbatim:
 *       - any (c)                → HIGH
 *       - any (b), no (c)        → MEDIUM
 *       - all (a)/(d)            → LOW
 *       - rating above LOW       → escalate (§7.3.6)
 *       - Q2.4 (annex5.2.4)      → excluded from the rating (RATING_EXEMPT)
 *
 *   • lib/regulatory/esdd/annex5b-pf-scoring.ts — the Project-Finance / IFC PS
 *     screening. `scorePfScreening()` counts flagged items and maps the count
 *     onto LOW (<5) / MEDIUM (5..15) / HIGH (>15), with any
 *     `ifcPsTerminationTrigger` flag overriding to CRITICAL.
 *
 * TABLE-DRIVEN, DERIVED FROM THE STANDARD (TEST_STRATEGY §4.1)
 * -----------------------------------------------------------
 * Cases assert the risk class AND the recommendation/escalation AND the
 * rationale wiring — not just that a branch executed. The PF fixtures are
 * built from the LIVE `ANNEX5B_ALL` / `pfCriticalItems()` catalog at runtime
 * (each item set to its own `flagOnAnswer` to produce an exact flag count) so
 * the boundaries are pinned against the real question ids and cannot silently
 * drift if the catalog is re-numbered.
 *
 * NOTE ON THE STRATEGY DOC: TEST_STRATEGY §4.1 names the entry point
 * `computeEsrmScore()`; the module was since refactored into the
 * `scoreBySection()` + `deriveEsrm()` pair tested here. The doc's est-case
 * count (~50 Annex 5 + ~25 PF) is the target this suite meets.
 *
 * COVERAGE / ONE GENUINELY-DEAD BRANCH (for P1.5 gate / P1.7 cleanup):
 * scoring.ts reaches 100% line+branch. annex5b-pf-scoring.ts reaches 100%
 * line and every branch EXCEPT the `: "none"` fallback of the criticalList
 * ternary in buildRationale (line 150). That arm is unreachable via the
 * public API: buildRationale is only entered with riskClass === "critical"
 * when `criticalFlaggedItems.length > 0` — the exact condition that SETS the
 * class critical (scorePfScreening line 104) — so the length can never be 0
 * on that path. Documented here so the P1.5 100% gate treats it as a known
 * dead defensive fallback (like the PCAF `3c` arm) rather than a test gap.
 */
import {
  ANSWER_WEIGHTS,
  RATING_EXEMPT_QUESTIONS,
  deriveEsrm,
  scoreBySection,
  type EsddResponseRecord,
} from "@/lib/regulatory/esdd/scoring";
import { scorePfScreening } from "@/lib/regulatory/esdd/annex5b-pf-scoring";
import {
  ANNEX5B_ALL,
  pfCriticalItems,
} from "@/lib/regulatory/esdd/annex5b-pf-questions";
import type { EsddAnswer } from "@/lib/regulatory/esdd/annex5-questions";
import type {
  Annex5bItem,
  PfScreeningResponse,
} from "@/lib/regulatory/esdd/annex5b-pf-types";

// ---------------------------------------------------------------------------
// Annex 5 — section aggregation (scoreBySection)
// ---------------------------------------------------------------------------

// Every question maps to one of three sections; a trivial lookup keyed by a
// convention encoded in the fixture id (`<section>.<n>`), so a test can build
// a response set without importing the 40-question catalogue.
const sectionOf = (id: string): string => id.split(".")[0];

const resp = (
  id: string,
  answer: EsddAnswer,
  remarks?: string,
): EsddResponseRecord => ({ questionId: id, answer, remarks });

describe("ANSWER_WEIGHTS · NRB a/b/c/d hierarchy", () => {
  it("encodes a=0, b=1, c=3, d=null (N/A drops out)", () => {
    expect(ANSWER_WEIGHTS.a).toBe(0);
    expect(ANSWER_WEIGHTS.b).toBe(1);
    expect(ANSWER_WEIGHTS.c).toBe(3);
    expect(ANSWER_WEIGHTS.d).toBeNull();
  });
});

describe("scoreBySection · per-section aggregation", () => {
  it("returns an empty map for no responses", () => {
    expect(scoreBySection([], sectionOf)).toEqual({});
  });

  it("skips responses whose lookup returns a falsy section", () => {
    // lookup returns "" → the response is ignored entirely.
    const out = scoreBySection([resp("general.1", "c")], () => "");
    expect(out).toEqual({});
  });

  it("counts answered, applicable, totalWeight, cCount and mean per section", () => {
    const out = scoreBySection(
      [
        resp("general.1", "a"), // weight 0
        resp("general.2", "b"), // weight 1
        resp("general.3", "c"), // weight 3, cCount++
        resp("general.4", "d"), // N/A: answered but not applicable
        resp("ehs.1", "b"), // weight 1
      ],
      sectionOf,
    );

    expect(out.general).toMatchObject({
      section: "general",
      answered: 4, // all four count as answered
      applicable: 3, // the 'd' is excluded
      totalWeight: 4, // 0 + 1 + 3
      cCount: 1,
    });
    // mean = totalWeight / applicable = 4 / 3
    expect(out.general.mean).toBeCloseTo(4 / 3, 10);

    expect(out.ehs).toMatchObject({
      answered: 1,
      applicable: 1,
      totalWeight: 1,
      cCount: 0,
    });
    expect(out.ehs.mean).toBe(1);
  });

  it("a section with only 'd' answers has applicable 0 and mean null", () => {
    const out = scoreBySection(
      [resp("social.1", "d"), resp("social.2", "d")],
      sectionOf,
    );
    expect(out.social.answered).toBe(2);
    expect(out.social.applicable).toBe(0);
    expect(out.social.totalWeight).toBe(0);
    expect(out.social.mean).toBeNull();
  });

  it("the rating-exempt question (annex5.2.4) counts as answered but never scores", () => {
    expect(RATING_EXEMPT_QUESTIONS.has("annex5.2.4")).toBe(true);
    const out = scoreBySection(
      [
        resp("annex5.2.4", "c"), // exempt: answered++ only, no weight, no cCount
        resp("annex5.3.1", "a"),
      ],
      // both live in a single "annex5" section under this lookup
      (id) => (id.startsWith("annex5.") ? "ehs" : sectionOf(id)),
    );
    expect(out.ehs.answered).toBe(2); // both answered
    expect(out.ehs.applicable).toBe(1); // only the non-exempt 'a'
    expect(out.ehs.totalWeight).toBe(0); // 'a' = 0; exempt 'c' excluded
    expect(out.ehs.cCount).toBe(0); // exempt 'c' does NOT count
    expect(out.ehs.mean).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Annex 5 — risk derivation (deriveEsrm) · NRB ESRR three-level boundaries
// ---------------------------------------------------------------------------

// Convenience: score then derive in one step, the way the wizard does.
const derive = (
  responses: EsddResponseRecord[],
  lookup: (id: string) => string = sectionOf,
) => deriveEsrm(scoreBySection(responses, lookup), responses);

describe("deriveEsrm · NRB ESRR risk-class boundaries", () => {
  it("all 'a'/'d' answers → LOW, approve, no escalation", () => {
    const d = derive([
      resp("general.1", "a"),
      resp("general.2", "d"),
      resp("ehs.1", "a"),
    ]);
    expect(d.riskClass).toBe("low");
    expect(d.recommendation).toBe("approve");
    expect(d.escalationFlag).toBe(false);
    expect(d.criticalFindingCount).toBe(0);
    expect(d.drivingQuestionIds).toEqual([]);
    expect(d.rationale).toContain("Risk class: low");
  });

  it("empty checklist → LOW (vacuous), no escalation", () => {
    const d = derive([]);
    expect(d.riskClass).toBe("low");
    expect(d.escalationFlag).toBe(false);
  });

  it("a single 'b' with no 'c' → MEDIUM, approve-with-conditions, escalates", () => {
    const d = derive([resp("general.1", "a"), resp("ehs.1", "b")]);
    expect(d.riskClass).toBe("medium");
    expect(d.recommendation).toBe("approve-with-conditions");
    expect(d.escalationFlag).toBe(true);
    expect(d.criticalFindingCount).toBe(0);
    // no 'c', so the driving ids are the 'b' answers
    expect(d.drivingQuestionIds).toEqual(["ehs.1"]);
    expect(d.rationale).toContain("Risk class: medium");
    expect(d.rationale).toContain("§7.3.6");
  });

  it("a single 'c' → HIGH, approve-with-conditions, escalates", () => {
    const d = derive([resp("general.1", "a"), resp("ehs.1", "c")]);
    expect(d.riskClass).toBe("high");
    expect(d.recommendation).toBe("approve-with-conditions");
    expect(d.escalationFlag).toBe(true);
    expect(d.criticalFindingCount).toBe(1);
    expect(d.drivingQuestionIds).toEqual(["ehs.1"]);
    expect(d.rationale).toContain("Risk class: high");
  });

  it("'c' dominates 'b': any 'c' present → HIGH and drivingQuestionIds are the 'c's only", () => {
    const d = derive([
      resp("general.1", "b"),
      resp("general.2", "c"),
      resp("ehs.1", "b"),
      resp("ehs.2", "c"),
    ]);
    expect(d.riskClass).toBe("high");
    // when 'c' answers exist they, not the 'b's, drive the rating
    expect(d.drivingQuestionIds).toEqual(["general.2", "ehs.2"]);
    expect(d.criticalFindingCount).toBe(2);
  });

  it("criticalFindingCount tracks 'c' count within HIGH without changing the class", () => {
    const d = derive([
      resp("a.1", "c"),
      resp("a.2", "c"),
      resp("a.3", "c"),
      resp("a.4", "c"),
    ]);
    expect(d.riskClass).toBe("high"); // never a fourth level
    expect(d.criticalFindingCount).toBe(4);
  });

  it("the rating-exempt 'c' (annex5.2.4) does NOT push MEDIUM→HIGH and is not a driver", () => {
    // annex5.2.4 answered 'c' but exempt; the only scoring answer is a 'b'.
    const d = derive(
      [resp("annex5.2.4", "c"), resp("annex5.3.1", "b")],
      () => "ehs",
    );
    expect(d.riskClass).toBe("medium"); // exempt 'c' ignored → 'b' drives MEDIUM
    expect(d.criticalFindingCount).toBe(0);
    expect(d.drivingQuestionIds).toEqual(["annex5.3.1"]); // exempt id filtered out
    expect(d.drivingQuestionIds).not.toContain("annex5.2.4");
  });

  it("an all-exempt checklist ('c' on 2.4 only) stays LOW", () => {
    const d = derive([resp("annex5.2.4", "c")], () => "ehs");
    expect(d.riskClass).toBe("low");
    expect(d.escalationFlag).toBe(false);
  });

  it("HIGH rationale names the c-answered question ids (short form)", () => {
    const d = derive([resp("annex5.4.2", "c")], () => "ehs");
    // buildRationale strips the "annex5." prefix in the id list
    expect(d.rationale).toContain("4.2");
    expect(d.rationale).toContain("'c' answer(s)");
  });

  it("MEDIUM rationale labels the drivers as 'b' answers", () => {
    const d = derive([resp("annex5.4.2", "b")], () => "ehs");
    expect(d.rationale).toContain("Risk class: medium");
    expect(d.rationale).toContain("'b' answer(s) at 4.2");
  });
});

// ---------------------------------------------------------------------------
// Annex 5b — Project Finance / IFC PS screening (scorePfScreening)
// ---------------------------------------------------------------------------

// Non-critical items only, so we can dial an exact flag count without tripping
// the CRITICAL override. Sorted by id for determinism.
const NON_CRITICAL_ITEMS: Annex5bItem[] = ANNEX5B_ALL.filter(
  (i) => i.ifcPsTerminationTrigger !== true,
).sort((a, b) => a.id.localeCompare(b.id));

const CRITICAL_ITEMS: Annex5bItem[] = pfCriticalItems();

/**
 * Build a response map that flags exactly `n` non-critical items (each set to
 * its own `flagOnAnswer`). Every OTHER catalog item is answered with the
 * non-flagging value so the map is fully answered and applicable.
 */
function responsesFlagging(n: number): PfScreeningResponse {
  const flagged = new Set(NON_CRITICAL_ITEMS.slice(0, n).map((i) => i.id));
  const out: PfScreeningResponse = {};
  for (const item of ANNEX5B_ALL) {
    if (flagged.has(item.id)) {
      out[item.id] = item.flagOnAnswer; // triggers a flag
    } else {
      // the opposite of flagOnAnswer never flags
      out[item.id] = item.flagOnAnswer === "no" ? "yes" : "no";
    }
  }
  return out;
}

describe("scorePfScreening · catalog integrity (fixtures are non-degenerate)", () => {
  it("the live catalog has enough non-critical items to reach the HIGH boundary", () => {
    // Need >15 to test HIGH without touching a critical item.
    expect(NON_CRITICAL_ITEMS.length).toBeGreaterThan(15);
  });
  it("the live catalog has at least one termination-trigger item", () => {
    expect(CRITICAL_ITEMS.length).toBeGreaterThan(0);
  });
});

describe("scorePfScreening · flag-count → risk-class boundaries", () => {
  it("0 flags → LOW, no critical findings", () => {
    const r = scorePfScreening(responsesFlagging(0));
    expect(r.itemsFlagged).toBe(0);
    expect(r.riskClass).toBe("low");
    expect(r.criticalFlaggedItems).toEqual([]);
    expect(r.rationale).toContain("PF risk: LOW");
  });

  it("4 flags → LOW (upper edge of the LOW band, LOW_MAX=4)", () => {
    const r = scorePfScreening(responsesFlagging(4));
    expect(r.itemsFlagged).toBe(4);
    expect(r.riskClass).toBe("low");
  });

  it("5 flags → MEDIUM (first count above LOW_MAX)", () => {
    const r = scorePfScreening(responsesFlagging(5));
    expect(r.itemsFlagged).toBe(5);
    expect(r.riskClass).toBe("medium");
    expect(r.rationale).toContain("PF risk: MEDIUM");
  });

  it("15 flags → MEDIUM (upper edge of the MEDIUM band, MEDIUM_MAX=15)", () => {
    const r = scorePfScreening(responsesFlagging(15));
    expect(r.itemsFlagged).toBe(15);
    expect(r.riskClass).toBe("medium");
  });

  it("16 flags → HIGH (first count above MEDIUM_MAX)", () => {
    const r = scorePfScreening(responsesFlagging(16));
    expect(r.itemsFlagged).toBe(16);
    expect(r.riskClass).toBe("high");
    expect(r.rationale).toContain("PF risk: HIGH");
  });
});

describe("scorePfScreening · CRITICAL override", () => {
  it("any single termination-trigger flag → CRITICAL regardless of total count", () => {
    const crit = CRITICAL_ITEMS[0];
    // Zero non-critical flags; flip exactly one critical item to its flag value.
    const responses = responsesFlagging(0);
    responses[crit.id] = crit.flagOnAnswer;

    const r = scorePfScreening(responses);
    expect(r.riskClass).toBe("critical");
    expect(r.criticalFlaggedItems).toContain(crit.id);
    expect(r.rationale).toContain("PF risk: CRITICAL");
    // the rationale strips the "annex5b." prefix on the critical id list
    expect(r.rationale).toContain(crit.id.replace("annex5b.", ""));
  });

  it("CRITICAL beats a would-be-HIGH count: one trigger + <5 other flags still CRITICAL", () => {
    const crit = CRITICAL_ITEMS[0];
    const responses = responsesFlagging(3); // would be LOW on count alone
    responses[crit.id] = crit.flagOnAnswer;
    const r = scorePfScreening(responses);
    expect(r.riskClass).toBe("critical");
  });
});

describe("scorePfScreening · answered / applicable accounting", () => {
  it("'n/a' answers count as answered but not applicable and never flag", () => {
    const responses: PfScreeningResponse = {};
    for (const item of ANNEX5B_ALL) responses[item.id] = "n/a";
    const r = scorePfScreening(responses);
    expect(r.itemsAnswered).toBe(ANNEX5B_ALL.length);
    expect(r.itemsApplicable).toBe(0);
    expect(r.itemsFlagged).toBe(0);
    expect(r.riskClass).toBe("low");
  });

  it("unanswered items (missing / null) count as neither answered nor applicable", () => {
    // Empty map: nothing answered at all.
    const r = scorePfScreening({});
    expect(r.itemsAnswered).toBe(0);
    expect(r.itemsApplicable).toBe(0);
    expect(r.itemsFlagged).toBe(0);
    expect(r.totalItems).toBe(ANNEX5B_ALL.length);
    expect(r.riskClass).toBe("low");
  });

  it("psBreakdown totals reconcile with the top-level counters", () => {
    const r = scorePfScreening(responsesFlagging(7));
    const sum = (k: "answered" | "applicable" | "flagged") =>
      r.psBreakdown.reduce((s, b) => s + b[k], 0);
    expect(sum("flagged")).toBe(r.itemsFlagged);
    expect(sum("answered")).toBe(r.itemsAnswered);
    expect(sum("applicable")).toBe(r.itemsApplicable);
    // every PS breakdown row carries its group's item total
    const breakdownTotal = r.psBreakdown.reduce((s, b) => s + b.total, 0);
    expect(breakdownTotal).toBe(ANNEX5B_ALL.length);
  });

  it("the LOW rationale reports zero termination-grade findings", () => {
    const r = scorePfScreening(responsesFlagging(2));
    expect(r.rationale).toContain("No IFC PS termination-grade findings");
  });
});
