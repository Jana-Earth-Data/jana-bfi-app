/**
 * UNIT TESTS — ESDD shared helpers.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/esdd/sector-slug.ts   — free-form NRB sector label →
 *     stable supplement slug (or undefined).
 *   • lib/regulatory/esdd/pf-loan-gate.ts  — the single "is this a Project
 *     Finance loan?" gate + its override-aware variant (P45).
 *
 * WHY
 * ---
 * These two helpers are the single points of truth the wizard, the drawer, the
 * officer/manager queue APIs and the scoring engine all defer to. A silent
 * regression here (a mis-mapped slug, or a PF loan slipping the gate) would
 * desync every one of those callers. P1.5 pins every branch of both.
 */
import { describe, expect, it } from "vitest";
import { sectorSlugFor } from "@/lib/regulatory/esdd/sector-slug";
import {
  isProjectFinanceLoan,
  isProjectFinanceLoanWithOverride,
} from "@/lib/regulatory/esdd/pf-loan-gate";
import type { Loan } from "@/lib/types/bfi";

// The gate only reads businessUnit + category, so tests use the same narrow
// Pick the helpers accept. businessUnit is the strict BusinessUnit union
// ("Retail" | "SME" | "Corporate" | "Project Finance"); we use "SME" for the
// generic non-PF cases rather than a free-form string.
type PfLoanFields = Pick<Loan, "businessUnit" | "category">;

// ---------------------------------------------------------------------------
// sectorSlugFor — one row per branch, plus case-insensitivity + no-match.
// ---------------------------------------------------------------------------

describe("sectorSlugFor", () => {
  it.each([
    ["Hydropower Generation", "hydropower"],
    ["Cement & Clinker", "cement"],
    ["Textile Manufacturing", "textiles"],
    ["Steel Rolling", "steel"],
    ["Chemical Products", "chemicals"],
    ["Brick Kilns", "brick"],
    ["Agriculture & Agro-processing", "agriculture"],
  ])("maps %s → %s", (label, slug) => {
    expect(sectorSlugFor(label)).toBe(slug);
  });

  it("is case-insensitive (upper-case input still matches)", () => {
    expect(sectorSlugFor("HYDROPOWER")).toBe("hydropower");
    expect(sectorSlugFor("CEMENT")).toBe("cement");
  });

  it("returns undefined for a sector with no supplement", () => {
    expect(sectorSlugFor("Financial Services")).toBeUndefined();
    expect(sectorSlugFor("")).toBeUndefined();
  });

  it("matches on the first applicable rung (hydropower precedes cement)", () => {
    // A label that contains an earlier keyword resolves to that keyword's slug.
    expect(sectorSlugFor("Hydropower with cement works")).toBe("hydropower");
  });
});

// ---------------------------------------------------------------------------
// isProjectFinanceLoan — businessUnit OR category suffix.
// ---------------------------------------------------------------------------

describe("isProjectFinanceLoan", () => {
  it("is PF when businessUnit === 'Project Finance'", () => {
    expect(
      isProjectFinanceLoan({ businessUnit: "Project Finance", category: "commercial-term-loan" }),
    ).toBe(true);
  });

  it("is PF when category ends with 'project-finance'", () => {
    expect(
      isProjectFinanceLoan({ businessUnit: "Corporate", category: "corporate-project-finance" }),
    ).toBe(true);
    expect(
      isProjectFinanceLoan({ businessUnit: "SME", category: "commercial-project-finance" }),
    ).toBe(true);
  });

  it("is NOT PF for a plain term loan (neither signal present)", () => {
    expect(
      isProjectFinanceLoan({ businessUnit: "SME", category: "commercial-term-loan" }),
    ).toBe(false);
  });

  it("is NOT PF when category is undefined and businessUnit is not PF", () => {
    expect(isProjectFinanceLoan({ businessUnit: "Retail", category: undefined })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isProjectFinanceLoanWithOverride — override wins, else falls back.
// ---------------------------------------------------------------------------

describe("isProjectFinanceLoanWithOverride", () => {
  const nonPfLoan: PfLoanFields = { businessUnit: "SME", category: "commercial-term-loan" };
  const pfLoan: PfLoanFields = { businessUnit: "Project Finance", category: "commercial-term-loan" };

  it("override 'project-finance' forces PF even for a non-PF loan", () => {
    expect(isProjectFinanceLoanWithOverride(nonPfLoan, "project-finance")).toBe(true);
  });

  it("a non-empty override that is NOT 'project-finance' forces not-PF, even for a PF loan", () => {
    expect(isProjectFinanceLoanWithOverride(pfLoan, "small")).toBe(false);
    expect(isProjectFinanceLoanWithOverride(pfLoan, "bwc-term")).toBe(false);
  });

  it.each([[null], [undefined], [""]])(
    "override %p falls back to isProjectFinanceLoan(loan)",
    (override) => {
      expect(isProjectFinanceLoanWithOverride(pfLoan, override)).toBe(true);
      expect(isProjectFinanceLoanWithOverride(nonPfLoan, override)).toBe(false);
    },
  );
});
