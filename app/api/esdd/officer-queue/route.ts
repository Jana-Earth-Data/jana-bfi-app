/**
 * GET /api/esdd/officer-queue
 *
 * Loan-oriented view of the signed-in officer's work. One row per loan
 * that carries the officer's ESDD state AND (when applicable) the
 * loan's taxonomy state. The officer's work isn't split by flow — it's
 * split by loan status.
 *
 * Response shape:
 *   {
 *     officer:         { id, name, role },
 *     needsAttention:  LoanCard[],   // anything mandatory is incomplete or escalated
 *     inReview:        LoanCard[],   // both required flows saved; awaiting manager/committee
 *     recentlyClosed:  LoanCard[],   // loans no longer under-review (stub for now)
 *   }
 *
 * LoanCard = one row per loan with combined ESDD + Taxonomy state and a
 * short reason string explaining why the card sits in its section.
 *
 * Assignment logic:
 *   - When the officer has any loans assigned via bfi_loan_assignments,
 *     "awaiting" candidates are drawn from their assignments only.
 *   - Otherwise (early demo state), fall back to the top-N under-review
 *     loans so the queue is never empty.
 */

import { NextResponse } from "next/server";
import { resolveCurrentTenant } from "@/lib/tenants";

import { getBfiDemoData } from "@/lib/api/bfi";
import { applicationQueue } from "@/lib/data/portfolio-query";
import { fullChecklist } from "@/lib/regulatory/esdd/annex5-questions";
import { isTaxonomyExpected } from "@/lib/regulatory/taxonomy/applicability";
import { findActivityById } from "@/lib/regulatory/taxonomy/activities";
import { isProjectFinanceLoanWithOverride } from "@/lib/regulatory/esdd/pf-loan-gate";
import { ANNEX5B_ALL } from "@/lib/regulatory/esdd/annex5b-pf-questions";
import { inferEmissionsFlag } from "@/lib/regulatory/climate/infer";
import { apiError, requireOfficer, requireCaptureClient } from "@/lib/api/route-helpers";

export const dynamic = "force-dynamic";

const AWAITING_SLICE = 20; // fallback top-N when no assignments exist

type RiskClass = "low" | "medium" | "high" | "extreme";
type TaxColor = "green" | "amber" | "red" | "unclassified";

export type LoanCard = {
  loanId: string;
  borrowerId: string;
  borrowerName: string;
  sector: string;
  outstandingNpr: number;
  lastActivityAt: string | null;
  reason: string;
  esdd: {
    answered: number;
    total: number;
    riskClass: RiskClass | null;
    escalated: boolean;
  };
  taxonomy: {
    applicable: boolean;
    color: TaxColor | null;
    activityId: string | null;
    activityName: string | null;
  };
  /**
   * NRB ESRM 2022 §4.3 climate flag — inferred from the borrower's
   * estimated annual emissions and reduction-target status. The loan
   * card badge fires when `aboveThreshold && !reductionTargetOnFile`.
   */
  climate: {
    aboveThreshold: boolean;
    reductionTargetOnFile: boolean;
    estimatedAnnualTco2e: number;
  };
  /**
   * NRB ESRM 2022 Annex 5b — Project Finance Screening Questionnaire
   * status. `required` is true only for Project Finance loans; on all
   * other loans the whole flow is skipped and the values are inert.
   *
   * `itemsTotal` is emitted as a constant (148 = ANNEX5B_ALL.length)
   * so the client doesn't have to import the catalog just to render
   * "Continue N/148" on the loan card.
   */
  pfScreening: {
    required: boolean;
    itemsAnswered: number;
    itemsTotal: number;
    riskClass: "low" | "medium" | "high" | "critical" | null;
    completed: boolean;
  };
  /**
   * PCAF Global GHG Standard Part A §5 data-availability confirmation.
   * Required on every loan under NFRS. The demo represents the four
   * flags as a single row in bfi_pcaf_availability (per-borrower); once
   * the row exists the four flags have been confirmed together, so
   * flagsConfirmed jumps 0 → 4 on first save.
   */
  pcafAvailability: {
    flagsConfirmed: number;
    flagsTotal: 4;
    completed: boolean;
  };
  /**
   * NRB ESRM Guideline 2022 §7.3.5 CAP + covenants + monitoring status.
   *
   * Populated for every candidate loan, but the loan card only renders
   * the CAP CTA when the loan's ESRR risk class is Medium / High /
   * Extreme (§7.3.5 does not require a CAP for Low-risk loans).
   *
   * `total`     — count of bfi_cap_items rows for this loan
   * `completed` — subset with status = 'completed'
   * `overdue`   — subset with status != 'completed' AND deadline < today
   *               (matches the projection GET /api/cap/[loanId] applies)
   */
  cap: {
    total: number;
    completed: number;
    overdue: number;
  };
};

export async function GET() {
  const [sbClient, sbErr] = await requireCaptureClient();
  if (sbErr) return sbErr;
  const supabase = sbClient!;
  const tenant = await resolveCurrentTenant();
  const [officer, offErr] = await requireOfficer("viewing the queue");
  if (offErr) return offErr;

  // Pull demo loans + borrowers upfront so we can look up meta by id.
  const data = await getBfiDemoData();
  const loanById = new Map(data.loans.map((l) => [l.id, l]));
  const borrowerById = new Map(data.borrowers.map((b) => [b.id, b]));

  // ==================================================================
  // PHASE 1 — Two independent queries in parallel: ESDD responses and
  // loan assignments. Neither depends on the other.
  // ==================================================================
  type AssignRow = {
    loan_id: string;
    officer_id: string;
    loan_category_override?: string | null;
  };

  async function fetchAssignments(): Promise<AssignRow[]> {
    const { data, error } = await supabase
      .from("bfi_loan_assignments")
      .select("loan_id, officer_id, loan_category_override")
      .eq("bank_id", tenant.id);
    if (error) {
      console.error(
        "[officer-queue] assignment query with loan_category_override failed:",
        error.message,
        "- retrying without it. Apply scripts/supabase-loan-category-override.sql.",
      );
      const retry = await supabase
        .from("bfi_loan_assignments")
        .select("loan_id, officer_id")
        .eq("bank_id", tenant.id);
      if (retry.error) throw new Error(`Assignment query failed: ${retry.error.message}`);
      return retry.data ?? [];
    }
    return data ?? [];
  }

  const [responsesResult, assignResult] = await Promise.all([
    supabase
      .from("bfi_esdd_responses")
      .select("loan_id, borrower_id, question_id, captured_at")
      .eq("bank_id", tenant.id)
      .eq("officer_id", officer.id)
      .order("captured_at", { ascending: false }),
    fetchAssignments(),
  ]);

  if (responsesResult.error) {
    return NextResponse.json(
      { error: `Response query failed: ${responsesResult.error.message}` },
      { status: 500 },
    );
  }
  const rawResponses = responsesResult.data;

  // Aggregate ESDD responses by loan.
  type Agg = {
    loanId: string;
    borrowerId: string;
    distinctQuestionIds: Set<string>;
    lastActivityAt: string;
  };
  const byLoan = new Map<string, Agg>();
  for (const r of rawResponses ?? []) {
    const existing = byLoan.get(r.loan_id);
    if (existing) {
      existing.distinctQuestionIds.add(r.question_id);
    } else {
      byLoan.set(r.loan_id, {
        loanId: r.loan_id,
        borrowerId: r.borrower_id,
        distinctQuestionIds: new Set([r.question_id]),
        lastActivityAt: r.captured_at,
      });
    }
  }

  // Process assignments.
  const allAssigns = assignResult;
  const assignedLoanIds = new Set<string>();
  const myAssignedLoanIds = new Set<string>();
  const categoryOverrideByLoan = new Map<string, string | null>();
  for (const a of allAssigns) {
    assignedLoanIds.add(a.loan_id);
    if (a.officer_id === officer.id) myAssignedLoanIds.add(a.loan_id);
    categoryOverrideByLoan.set(
      a.loan_id,
      (a.loan_category_override as string | null | undefined) ?? null,
    );
  }

  // ==================================================================
  // PHASE 2 — Build the screening lookup set (needs responses +
  // assignments) and the candidate loan set. Query screenings.
  // ==================================================================
  const touchedLoanIds = Array.from(byLoan.keys());
  const screeningLookupIds = Array.from(
    new Set([...touchedLoanIds, ...myAssignedLoanIds]),
  );

  // Candidate loan set — three sources:
  //   (a) touched by this officer  (b) assigned to this officer
  //   (c) under-review and unassigned (available to pick up)
  const candidateLoanIds = new Set<string>();
  for (const id of byLoan.keys()) candidateLoanIds.add(id);
  for (const id of myAssignedLoanIds) candidateLoanIds.add(id);
  const underReview = applicationQueue(data, AWAITING_SLICE * 4);
  for (const app of underReview) {
    if (!assignedLoanIds.has(app.loan.id)) {
      candidateLoanIds.add(app.loan.id);
    }
  }
  const candidateArray = Array.from(candidateLoanIds);
  const candidateBorrowerIds = Array.from(
    new Set(
      candidateArray
        .map((id) => loanById.get(id)?.borrowerId)
        .filter((v): v is string => typeof v === "string"),
    ),
  );

  // ==================================================================
  // PHASE 3 — Six queries in parallel: screenings + taxonomy +
  // PF responses + PF results + PCAF availability + CAP items.
  // Screenings filter on screeningLookupIds; the rest filter on
  // candidateArray / candidateBorrowerIds.
  // ==================================================================
  const noRows = { data: [] as never[], error: null };
  const [
    screeningsResult,
    taxResult,
    pfRespResult,
    pfResResult,
    pcafResult,
    capResult,
  ] = await Promise.all([
    // Screenings
    screeningLookupIds.length > 0
      ? supabase
          .from("bfi_esrm_screenings")
          .select("loan_id, computed_risk_class, escalation_flag, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", screeningLookupIds.concat(["__never__"]))
          .order("captured_at", { ascending: false })
      : noRows,
    // Taxonomy assessments
    candidateArray.length > 0
      ? supabase
          .from("bfi_taxonomy_assessments")
          .select("loan_id, activity_id, computed_color, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : noRows,
    // PF screening responses
    candidateArray.length > 0
      ? supabase
          .from("bfi_pf_screening_responses")
          .select("loan_id, item_id, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : noRows,
    // PF screening results
    candidateArray.length > 0
      ? supabase
          .from("bfi_pf_screening_results")
          .select("loan_id, computed_risk_class, items_flagged, captured_at")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
          .order("captured_at", { ascending: false })
      : noRows,
    // PCAF data-availability (per borrower)
    candidateBorrowerIds.length > 0
      ? supabase
          .from("bfi_pcaf_availability")
          .select("borrower_id")
          .eq("bank_id", tenant.id)
          .in("borrower_id", candidateBorrowerIds)
      : noRows,
    // CAP items
    candidateArray.length > 0
      ? supabase
          .from("bfi_cap_items")
          .select("loan_id, status, deadline_date")
          .eq("bank_id", tenant.id)
          .in("loan_id", candidateArray)
      : noRows,
  ]);

  // Check for errors from the parallel batch.
  if (screeningsResult.error) {
    return NextResponse.json(
      { error: `Screening query failed: ${screeningsResult.error.message}` },
      { status: 500 },
    );
  }
  if (taxResult.error) {
    return NextResponse.json(
      { error: `Taxonomy query failed: ${taxResult.error.message}` },
      { status: 500 },
    );
  }
  if (pfRespResult.error) {
    return NextResponse.json(
      { error: `PF response query failed: ${pfRespResult.error.message}` },
      { status: 500 },
    );
  }
  if (pfResResult.error) {
    return NextResponse.json(
      { error: `PF result query failed: ${pfResResult.error.message}` },
      { status: 500 },
    );
  }
  if (pcafResult.error) {
    return NextResponse.json(
      { error: `PCAF availability query failed: ${pcafResult.error.message}` },
      { status: 500 },
    );
  }
  if (capResult.error) {
    return NextResponse.json(
      { error: `CAP item query failed: ${capResult.error.message}` },
      { status: 500 },
    );
  }

  // ------------------------------------------------------------------
  // Process screenings
  // ------------------------------------------------------------------
  const screeningByLoan = new Map<
    string,
    { riskClass: RiskClass; escalated: boolean; capturedAt: string }
  >();
  for (const s of screeningsResult.data ?? []) {
    if (screeningByLoan.has(s.loan_id)) continue;
    screeningByLoan.set(s.loan_id, {
      riskClass: s.computed_risk_class as RiskClass,
      escalated: s.escalation_flag,
      capturedAt: s.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // Process taxonomy assessments
  // ------------------------------------------------------------------
  const taxByLoan = new Map<
    string,
    { activityId: string; color: TaxColor; capturedAt: string }
  >();
  for (const t of taxResult.data ?? []) {
    if (taxByLoan.has(t.loan_id)) continue;
    taxByLoan.set(t.loan_id, {
      activityId: t.activity_id,
      color: t.computed_color as TaxColor,
      capturedAt: t.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // Process PF screening responses + results
  // ------------------------------------------------------------------
  const pfTotalItems = ANNEX5B_ALL.length;
  const pfAnsweredByLoan = new Map<string, Set<string>>();
  const pfLastActivityByLoan = new Map<string, string>();
  for (const row of pfRespResult.data ?? []) {
    let set = pfAnsweredByLoan.get(row.loan_id);
    if (!set) {
      set = new Set<string>();
      pfAnsweredByLoan.set(row.loan_id, set);
      pfLastActivityByLoan.set(row.loan_id, row.captured_at);
    }
    set.add(row.item_id);
  }
  const pfResultByLoan = new Map<
    string,
    { riskClass: "low" | "medium" | "high" | "critical"; capturedAt: string }
  >();
  for (const r of pfResResult.data ?? []) {
    if (pfResultByLoan.has(r.loan_id)) continue;
    pfResultByLoan.set(r.loan_id, {
      riskClass: r.computed_risk_class as
        | "low"
        | "medium"
        | "high"
        | "critical",
      capturedAt: r.captured_at,
    });
  }

  // ------------------------------------------------------------------
  // Process PCAF availability
  // ------------------------------------------------------------------
  const pcafConfirmedBorrowerIds = new Set<string>();
  for (const row of pcafResult.data ?? []) {
    pcafConfirmedBorrowerIds.add(row.borrower_id);
  }

  // ------------------------------------------------------------------
  // Process CAP items
  // ------------------------------------------------------------------
  const today = new Date().toISOString().slice(0, 10);
  type CapAgg = { total: number; completed: number; overdue: number };
  const capByLoan = new Map<string, CapAgg>();
  for (const row of capResult.data ?? []) {
    const agg = capByLoan.get(row.loan_id) ?? {
      total: 0,
      completed: 0,
      overdue: 0,
    };
    agg.total += 1;
    if (row.status === "completed") {
      agg.completed += 1;
    } else if (row.deadline_date && row.deadline_date < today) {
      agg.overdue += 1;
    }
    capByLoan.set(row.loan_id, agg);
  }

  // ------------------------------------------------------------------
  // 6. Build a LoanCard for every candidate loan, then bucket.
  // ------------------------------------------------------------------
  const cards: LoanCard[] = [];
  for (const loanId of candidateLoanIds) {
    const loan = loanById.get(loanId);
    if (!loan) continue;
    const borrower = borrowerById.get(loan.borrowerId);
    if (!borrower) continue;

    // NRB ESRM Guideline 2022: 13-question sector-agnostic Annex 5
    // checklist. No supplement.
    const total = fullChecklist().length;
    const esddAgg = byLoan.get(loanId);
    const answered = esddAgg?.distinctQuestionIds.size ?? 0;
    const screening = screeningByLoan.get(loanId);
    const taxApplicable = isTaxonomyExpected(borrower.nrbSector);
    const tax = taxByLoan.get(loanId);
    const activityName = tax
      ? findActivityById(tax.activityId)?.name ?? null
      : null;

    const esddDone = screening !== undefined;
    const taxDone = tax !== undefined;
    const escalated = screening?.escalated ?? false;

    // PF screening (Annex 5b) applicability + completion state.
    // P45 — honour the officer's ESDD-wizard loan-category override
    // when present; otherwise fall through to the raw
    // loan.category / businessUnit check.
    const pfRequired = isProjectFinanceLoanWithOverride(
      loan,
      categoryOverrideByLoan.get(loanId) ?? null,
    );
    const pfAnsweredSet = pfAnsweredByLoan.get(loanId);
    const pfAnswered = pfAnsweredSet?.size ?? 0;
    const pfResult = pfResultByLoan.get(loanId);
    const pfDone = pfResult !== undefined;

    // Reason string for the card header — human summary of what needs
    // to happen next. Priority ordering matches how the card gets bucketed.
    // Annex 5b PF screening state weaves in only for Project-Finance loans:
    // a PF loan is NOT ready-for-review until the Annex 5b screening
    // completes.
    let reason = "";
    if (escalated) {
      reason = "Escalated to next-higher credit approval authority";
    } else if (!esddDone && answered === 0) {
      reason = "ESDD checklist not started";
    } else if (!esddDone && answered > 0) {
      reason = `ESDD checklist ${answered}/${total} answered`;
    } else if (pfRequired && !pfDone) {
      // ESDD is done, but this is a Project-Finance loan and Annex 5b is
      // still open — flag PF screening as the next required step.
      reason =
        pfAnswered === 0
          ? "PF screening pending (Annex 5b not started)"
          : `PF screening pending (${pfAnswered}/${pfTotalItems} Annex 5b items answered)`;
    } else if (esddDone && taxApplicable && !taxDone) {
      reason = "ESDD complete — taxonomy classification pending";
    } else {
      reason = "Ready for review";
    }

    const climateFlag = inferEmissionsFlag(borrower);

    cards.push({
      loanId,
      borrowerId: borrower.id,
      borrowerName: borrower.name,
      sector: borrower.nrbSector,
      outstandingNpr: loan.outstandingNpr,
      lastActivityAt:
        esddAgg?.lastActivityAt ??
        pfLastActivityByLoan.get(loanId) ??
        tax?.capturedAt ??
        screening?.capturedAt ??
        null,
      reason,
      esdd: {
        answered,
        total,
        riskClass: screening?.riskClass ?? null,
        escalated,
      },
      taxonomy: {
        applicable: taxApplicable,
        color: tax?.color ?? null,
        activityId: tax?.activityId ?? null,
        activityName,
      },
      climate: {
        aboveThreshold: climateFlag.exceedsReportingThreshold,
        reductionTargetOnFile: climateFlag.reductionTargetOnFile,
        estimatedAnnualTco2e: climateFlag.estimatedAnnualTco2e,
      },
      pfScreening: {
        required: pfRequired,
        itemsAnswered: pfAnswered,
        itemsTotal: pfTotalItems,
        riskClass: pfResult?.riskClass ?? null,
        completed: pfDone,
      },
      pcafAvailability: {
        // The four §5 flags are saved as a single row per borrower —
        // the row's presence means the officer has confirmed the set.
        flagsConfirmed: pcafConfirmedBorrowerIds.has(borrower.id) ? 4 : 0,
        flagsTotal: 4,
        completed: pcafConfirmedBorrowerIds.has(borrower.id),
      },
      cap: capByLoan.get(loanId) ?? { total: 0, completed: 0, overdue: 0 },
    });
  }

  const needsAttention: LoanCard[] = [];
  const inReview: LoanCard[] = [];
  const recentlyClosed: LoanCard[] = []; // stub — needs a loan-status change model

  for (const c of cards) {
    const esddDone = c.esdd.riskClass !== null;
    const taxOk = !c.taxonomy.applicable || c.taxonomy.color !== null;
    // Annex 5b PF screening: for Project-Finance loans, the loan is not
    // ready-for-review until the Annex 5b screening is complete AND has
    // not been auto-escalated to CRITICAL. NRB ESRM 2022 requires both
    // the sector-agnostic Annex 5 flow AND the Annex 5b PF questionnaire.
    const pfOk = !c.pfScreening.required || c.pfScreening.completed;
    const pfCritical =
      c.pfScreening.required && c.pfScreening.riskClass === "critical";
    if (c.esdd.escalated || pfCritical) {
      needsAttention.push(c);
    } else if (esddDone && taxOk && pfOk) {
      inReview.push(c);
    } else {
      needsAttention.push(c);
    }
  }

  // Ordering: needs-attention by last-activity desc (recent first),
  // then in-review by last-activity desc (most recent completion first).
  needsAttention.sort((a, b) => {
    // Escalated bubbles to top.
    if (a.esdd.escalated !== b.esdd.escalated)
      return a.esdd.escalated ? -1 : 1;
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });
  inReview.sort((a, b) => {
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });

  // ------------------------------------------------------------------
  // P36 — split the cards into two officer-facing sections:
  //
  //   myLoans          = loans owned by this officer (assigned via
  //                      bfi_loan_assignments) OR touched by this
  //                      officer (has attributed ESDD activity). Every
  //                      compliance CTA is available.
  //   availableToClaim = loans currently unassigned and untouched by
  //                      this officer. Renders as a simple row with an
  //                      Open CTA — clicking navigates to the wizard,
  //                      which auto-claims on load.
  //
  // A loan the officer has touched but not yet been auto-claimed for
  // (should be rare given P34/P36) stays in myLoans.
  // ------------------------------------------------------------------
  const myLoans: LoanCard[] = [];
  const availableToClaim: LoanCard[] = [];
  for (const c of cards) {
    const owned = myAssignedLoanIds.has(c.loanId);
    const touched = byLoan.has(c.loanId);
    if (owned || touched) {
      myLoans.push(c);
    } else if (!assignedLoanIds.has(c.loanId)) {
      availableToClaim.push(c);
    }
    // Loans assigned to a different officer are intentionally excluded
    // from both sections — the officer picker / manager reassignment
    // paths are how those become visible.
  }
  // My loans: escalated first, then most-recently-active first.
  myLoans.sort((a, b) => {
    if (a.esdd.escalated !== b.esdd.escalated)
      return a.esdd.escalated ? -1 : 1;
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at);
  });
  // Available: newest applications first (proxy via lastActivityAt);
  // this is stable-ish for the demo without a loan-created timestamp.
  availableToClaim.sort((a, b) => {
    const at = a.lastActivityAt ?? "";
    const bt = b.lastActivityAt ?? "";
    return bt.localeCompare(at) || a.borrowerName.localeCompare(b.borrowerName);
  });

  return NextResponse.json({
    ok: true,
    officer: { id: officer.id, name: officer.name, role: officer.role },
    // New split view (P36).
    myLoans,
    availableToClaim,
    // Legacy fields — kept for callers that haven't migrated to the
    // split view. Compute unchanged.
    needsAttention,
    inReview,
    recentlyClosed,
  });
}
