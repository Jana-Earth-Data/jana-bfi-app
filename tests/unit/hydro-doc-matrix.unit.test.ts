/**
 * UNIT TESTS — NRB Circular 22 Annex 2 hydropower documentation matrix.
 * jana-bfi-app · P1.5 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/hydro/doc-matrix.ts — the capacity-band bucketing, the
 *     band→label / band→assessment maps, and the three document-lookup helpers
 *     (requiredDocumentsForCapacity / documentsForBand / findHydroDocument).
 *
 * WHY
 * ---
 * The band a borrower's installed capacity falls into decides which Annex 2
 * documents the officer must collect before a hydropower loan can be approved.
 * A wrong boundary (e.g. treating exactly 50 MW as >50 MW) would demand an EIA
 * approval letter the project never needed — or hide one it did. P1.5 pins every
 * band boundary and every helper branch, including the `findHydroDocument`
 * undefined miss.
 */
import { describe, expect, it } from "vitest";
import {
  HYDRO_CAPACITY_BAND_ASSESSMENT,
  HYDRO_CAPACITY_BAND_LABEL,
  HYDRO_DOCUMENTS,
  HYDRO_DOCUMENT_STATUSES,
  documentsForBand,
  findHydroDocument,
  hydroCapacityBand,
  requiredDocumentsForCapacity,
  type HydroCapacityBand,
} from "@/lib/regulatory/hydro/doc-matrix";

// ---------------------------------------------------------------------------
// hydroCapacityBand — the three Annex 2 bands + both boundaries.
// ---------------------------------------------------------------------------

describe("hydroCapacityBand", () => {
  it.each<[number, HydroCapacityBand]>([
    [0.5, "under-1mw"],
    [0.999, "under-1mw"],
    [1, "1-to-50mw"], // inclusive lower boundary
    [25, "1-to-50mw"],
    [50, "1-to-50mw"], // inclusive upper boundary
    [50.0001, "over-50mw"],
    [456, "over-50mw"],
  ])("buckets %d MW into %s", (mw, band) => {
    expect(hydroCapacityBand(mw)).toBe(band);
  });
});

// ---------------------------------------------------------------------------
// Band maps — every band has a label + an assessment level.
// ---------------------------------------------------------------------------

describe("band label + assessment maps", () => {
  const bands: HydroCapacityBand[] = ["under-1mw", "1-to-50mw", "over-50mw"];

  it("covers every band in both maps", () => {
    for (const band of bands) {
      expect(HYDRO_CAPACITY_BAND_LABEL[band]).toBeTruthy();
      expect(HYDRO_CAPACITY_BAND_ASSESSMENT[band]).toBeTruthy();
    }
  });

  it("pins the source assessment level per band (EIA / IEE / none)", () => {
    expect(HYDRO_CAPACITY_BAND_ASSESSMENT["over-50mw"]).toBe("EIA");
    expect(HYDRO_CAPACITY_BAND_ASSESSMENT["1-to-50mw"]).toBe("IEE");
    expect(HYDRO_CAPACITY_BAND_ASSESSMENT["under-1mw"]).toContain("None");
  });

  it("exposes the officer-facing status lifecycle (no not-required)", () => {
    expect(HYDRO_DOCUMENT_STATUSES).toEqual([
      "not-collected",
      "in-progress",
      "received",
      "verified",
    ]);
  });
});

// ---------------------------------------------------------------------------
// requiredDocumentsForCapacity / documentsForBand — subset selection.
// ---------------------------------------------------------------------------

describe("document selection by capacity / band", () => {
  it(">50 MW requires the EIA approval letter, not the IEE one", () => {
    const ids = requiredDocumentsForCapacity(100).map((d) => d.id);
    expect(ids).toContain("eia-approval-letter");
    expect(ids).not.toContain("iee-approval-letter");
    expect(ids).toContain("power-purchase-agreement");
  });

  it("1-50 MW requires the IEE approval letter, not the EIA one", () => {
    const ids = requiredDocumentsForCapacity(25).map((d) => d.id);
    expect(ids).toContain("iee-approval-letter");
    expect(ids).not.toContain("eia-approval-letter");
  });

  it("<1 MW resolves to only the DEOD prescribed-info note", () => {
    const docs = requiredDocumentsForCapacity(0.5);
    expect(docs.map((d) => d.id)).toEqual(["deod-prescribed-info"]);
  });

  it("documentsForBand agrees with requiredDocumentsForCapacity", () => {
    expect(documentsForBand("over-50mw")).toEqual(requiredDocumentsForCapacity(100));
    expect(documentsForBand("1-to-50mw")).toEqual(requiredDocumentsForCapacity(25));
    expect(documentsForBand("under-1mw")).toEqual(requiredDocumentsForCapacity(0.5));
  });

  it("returns documents in catalogue (source-table) order", () => {
    const docs = documentsForBand("over-50mw");
    const catalogueOrder = HYDRO_DOCUMENTS.filter((d) =>
      d.requiredForBands.includes("over-50mw"),
    );
    expect(docs).toEqual(catalogueOrder);
  });
});

// ---------------------------------------------------------------------------
// findHydroDocument — hit + miss.
// ---------------------------------------------------------------------------

describe("findHydroDocument", () => {
  it("finds a catalogue document by id", () => {
    const doc = findHydroDocument("power-purchase-agreement");
    expect(doc?.id).toBe("power-purchase-agreement");
    expect(doc?.citation).toContain("Annex 2");
  });

  it("returns undefined for an unknown id", () => {
    expect(findHydroDocument("nonexistent-doc-id")).toBeUndefined();
  });
});
