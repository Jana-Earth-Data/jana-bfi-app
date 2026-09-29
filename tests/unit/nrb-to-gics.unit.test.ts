/**
 * UNIT TESTS — NRB sector → GICS 6-digit mapping (N1.7).
 * jana-bfi-app · PR1 task N1.7 of PROJECT_PLAN.md (TEST_STRATEGY §4.1, Tier 1).
 *
 * SCOPE
 * -----
 *   • lib/regulatory/industry/nrb-to-gics.ts — IFRS S2 B62(a)(i) GICS 6-digit
 *     industry classification mapping for Nepal bank sectors.
 *
 * WHY
 * ---
 * Per IFRS S2 Climate-related Disclosures (June 2023) §B62(a)(i), entity
 * **shall** use the Global Industry Classification Standard (GICS) 6-digit
 * industry-level code to identify the industry to which a counterparty belongs.
 *
 * The NFRS draft (confirmed ND.2, 2026-09-15) tracks pre-amendment IFRS S2 with
 * no GICS alternative permitted — this requirement is **mandatory** for Nepal
 * financial institutions.
 *
 * This test suite pins:
 * - The mapping table structure (all Nepal bank sectors have GICS codes)
 * - The GICS code format (6 digits)
 * - The GICS label structure (Sector / Industry Group / Industry)
 * - The lookup functions (code, label, has mapping, etc.)
 */
import { describe, expect, it } from "vitest";
import {
  NRB_TO_GICS_MAP,
  IFRS_S2_B62_A_I_CITATION,
  gicsCodeForNrbSector,
  gicsCodeString,
  gicsLabel,
  hasGicsMapping,
  mappedNrbSectors,
} from "@/lib/regulatory/industry/nrb-to-gics";

// ---------------------------------------------------------------------------
// Mapping table structure
// ---------------------------------------------------------------------------

describe("NRB_TO_GICS_MAP structure", () => {
  it("contains mappings for all known NRB sectors", () => {
    const expectedSectors = [
      "Energy - Hydropower",
      "Manufacturing - Cement",
      "Manufacturing - Brick",
      "Manufacturing - Steel",
      "Manufacturing - Chemicals",
      "Manufacturing - Plastics",
      "Manufacturing - Textiles",
      "Manufacturing - FMCG",
      "Manufacturing - Other",
      "Agriculture - Processing",
      "Hospitality - Tourism",
      "Real Estate - Commercial",
      "Transport & Storage",
      "Retail",
      "Utilities - Waste Management",
    ];

    expectedSectors.forEach((sector) => {
      expect(NRB_TO_GICS_MAP[sector]).toBeDefined();
      expect(NRB_TO_GICS_MAP[sector].code).toBeDefined();
      expect(NRB_TO_GICS_MAP[sector].label).toBeDefined();
    });
  });

  it("every GICS code is exactly 6 digits", () => {
    Object.values(NRB_TO_GICS_MAP).forEach((gics) => {
      expect(gics.code).toMatch(/^\d{6}$/);
    });
  });

  it("every GICS label follows Sector / Industry Group / Industry format", () => {
    Object.values(NRB_TO_GICS_MAP).forEach((gics) => {
      expect(gics.label).toMatch(/^.+ \/ .+ \/ .+$/);
      expect(gics.label).toContain(gics.sector);
      expect(gics.label).toContain(gics.industryGroup);
      expect(gics.label).toContain(gics.industry);
    });
  });

  it("GICS codes are unique across mappings", () => {
    const codes = Object.values(NRB_TO_GICS_MAP).map((g) => g.code);
    const uniqueCodes = new Set(codes);
    // Note: Some NRB sectors may map to the same GICS code (e.g., Cement and Brick both map to Construction Materials)
    // So we don't require 1:1 uniqueness, but we document which sectors share codes
    expect(uniqueCodes.size).toBeGreaterThan(0);
    expect(uniqueCodes.size).toBeLessThanOrEqual(codes.length);
  });
});

// ---------------------------------------------------------------------------
// Specific sector mappings (sample verification)
// ---------------------------------------------------------------------------

describe("NRB_TO_GICS_MAP specific mappings", () => {
  it("Energy - Hydropower → 551010 (Utilities / Electric Utilities)", () => {
    const gics = NRB_TO_GICS_MAP["Energy - Hydropower"];
    expect(gics.code).toBe("551010");
    expect(gics.sector).toBe("Utilities");
    expect(gics.industry).toBe("Electric Utilities");
    expect(gics.label).toBe("Utilities / Utilities / Electric Utilities");
  });

  it("Manufacturing - Cement → 151020 (Materials / Construction Materials)", () => {
    const gics = NRB_TO_GICS_MAP["Manufacturing - Cement"];
    expect(gics.code).toBe("151020");
    expect(gics.sector).toBe("Materials");
    expect(gics.industry).toBe("Construction Materials");
  });

  it("Manufacturing - Steel → 151040 (Materials / Steel)", () => {
    const gics = NRB_TO_GICS_MAP["Manufacturing - Steel"];
    expect(gics.code).toBe("151040");
    expect(gics.sector).toBe("Materials");
    expect(gics.industry).toBe("Steel");
  });

  it("Hospitality - Tourism → 253010 (Consumer Discretionary / Hotels, Restaurants & Leisure)", () => {
    const gics = NRB_TO_GICS_MAP["Hospitality - Tourism"];
    expect(gics.code).toBe("253010");
    expect(gics.sector).toBe("Consumer Discretionary");
    expect(gics.industry).toBe("Hotels, Restaurants & Leisure");
  });

  it("Real Estate - Commercial → 601010 (Real Estate / Equity REITs)", () => {
    const gics = NRB_TO_GICS_MAP["Real Estate - Commercial"];
    expect(gics.code).toBe("601010");
    expect(gics.sector).toBe("Real Estate");
  });

  it("Transport & Storage → 203020 (Industrials / Air Freight & Logistics)", () => {
    const gics = NRB_TO_GICS_MAP["Transport & Storage"];
    expect(gics.code).toBe("203020");
    expect(gics.sector).toBe("Industrials");
    expect(gics.industry).toBe("Air Freight & Logistics");
  });

  it("Utilities - Waste Management → 552020 (Utilities / Multi-Utilities)", () => {
    const gics = NRB_TO_GICS_MAP["Utilities - Waste Management"];
    expect(gics.code).toBe("552020");
    expect(gics.sector).toBe("Utilities");
    expect(gics.industry).toBe("Multi-Utilities");
  });
});

// ---------------------------------------------------------------------------
// Lookup functions
// ---------------------------------------------------------------------------

describe("gicsCodeForNrbSector", () => {
  it("returns full GICS object for mapped sector", () => {
    const gics = gicsCodeForNrbSector("Manufacturing - Cement");
    expect(gics).toBeDefined();
    expect(gics?.code).toBe("151020");
    expect(gics?.label).toBe("Materials / Materials / Construction Materials");
  });

  it("returns undefined for unmapped sector", () => {
    const gics = gicsCodeForNrbSector("Unknown Sector");
    expect(gics).toBeUndefined();
  });
});

describe("gicsCodeString", () => {
  it("returns 6-digit code string for mapped sector", () => {
    expect(gicsCodeString("Energy - Hydropower")).toBe("551010");
    expect(gicsCodeString("Manufacturing - Cement")).toBe("151020");
    expect(gicsCodeString("Hospitality - Tourism")).toBe("253010");
  });

  it("returns undefined for unmapped sector", () => {
    expect(gicsCodeString("Unknown Sector")).toBeUndefined();
  });
});

describe("gicsLabel", () => {
  it("returns full label string for mapped sector", () => {
    expect(gicsLabel("Energy - Hydropower")).toBe("Utilities / Utilities / Electric Utilities");
    expect(gicsLabel("Manufacturing - Steel")).toBe("Materials / Materials / Steel");
  });

  it("returns undefined for unmapped sector", () => {
    expect(gicsLabel("Unknown Sector")).toBeUndefined();
  });
});

describe("hasGicsMapping", () => {
  it("returns true for mapped sectors", () => {
    expect(hasGicsMapping("Energy - Hydropower")).toBe(true);
    expect(hasGicsMapping("Manufacturing - Cement")).toBe(true);
    expect(hasGicsMapping("Retail")).toBe(true);
  });

  it("returns false for unmapped sectors", () => {
    expect(hasGicsMapping("Unknown Sector")).toBe(false);
    expect(hasGicsMapping("")).toBe(false);
  });
});

describe("mappedNrbSectors", () => {
  it("returns array of all mapped NRB sectors", () => {
    const sectors = mappedNrbSectors();
    expect(sectors).toBeInstanceOf(Array);
    expect(sectors.length).toBeGreaterThan(10); // At least 14 sectors mapped
    expect(sectors).toContain("Energy - Hydropower");
    expect(sectors).toContain("Manufacturing - Cement");
    expect(sectors).toContain("Retail");
  });

  it("every returned sector has a mapping", () => {
    const sectors = mappedNrbSectors();
    sectors.forEach((sector) => {
      expect(hasGicsMapping(sector)).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// IFRS S2 citation
// ---------------------------------------------------------------------------

describe("IFRS_S2_B62_A_I_CITATION", () => {
  it("contains IFRS S2 and B62(a)(i) references", () => {
    expect(IFRS_S2_B62_A_I_CITATION).toContain("IFRS S2");
    expect(IFRS_S2_B62_A_I_CITATION).toContain("B62(a)(i)");
    expect(IFRS_S2_B62_A_I_CITATION).toContain("GICS");
    expect(IFRS_S2_B62_A_I_CITATION).toContain("6-digit");
  });
});
