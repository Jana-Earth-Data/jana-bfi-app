/**
 * Unit tests for emission factor registry (N2.6).
 * Tests basis flag (CO₂e vs gas-specific), registry structure, and B22/B29 compliance.
 *
 * Created for N2.6 (emission-factor registry).
 */

import { describe, it, expect } from "vitest";
import {
  FUEL_EMISSION_FACTORS,
  FLEET_EMISSION_FACTORS,
  REFRIGERANT_GWP_AR5,
  GRID_EMISSION_FACTORS,
  EMISSION_FACTOR_REGISTRY,
  type EmissionFactorBasis,
} from "@/lib/regulatory/emissions/factors";

describe("Emission Factor Basis (N2.6 - IFRS S2 B22)", () => {
  it("all fuel factors have co2e basis (B22 first sentence exemption)", () => {
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS) as Array<
      keyof typeof FUEL_EMISSION_FACTORS
    >;

    for (const key of fuelKeys) {
      const factor = FUEL_EMISSION_FACTORS[key];
      expect(factor.basis).toBe("co2e");
      expect(factor.source).toBeDefined();
    }
  });

  it("all fleet factors have co2e basis (B22 first sentence exemption)", () => {
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS) as Array<
      keyof typeof FLEET_EMISSION_FACTORS
    >;

    for (const key of fleetKeys) {
      const factor = FLEET_EMISSION_FACTORS[key];
      expect(factor.basis).toBe("co2e");
      expect(factor.source).toBeDefined();
    }
  });

  it("all refrigerant factors have gas-specific basis (B22 second sentence - require GWP)", () => {
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5) as Array<
      keyof typeof REFRIGERANT_GWP_AR5
    >;

    for (const key of refrigerantKeys) {
      const factor = REFRIGERANT_GWP_AR5[key];
      expect(factor.basis).toBe("gas-specific");
      expect(factor.source).toBeDefined();
      expect(factor.gwp100).toBeGreaterThan(0);
    }
  });

  it("all grid factors have co2e basis (B22 first sentence exemption)", () => {
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS) as Array<
      keyof typeof GRID_EMISSION_FACTORS
    >;

    for (const key of gridKeys) {
      const factor = GRID_EMISSION_FACTORS[key];
      expect(factor.basis).toBe("co2e");
      expect(factor.source).toBeDefined();
    }
  });

  it("basis flag is one of two valid values: co2e or gas-specific", () => {
    const validBasis: EmissionFactorBasis[] = ["co2e", "gas-specific"];

    // Check fuel
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS) as Array<
      keyof typeof FUEL_EMISSION_FACTORS
    >;
    for (const key of fuelKeys) {
      expect(validBasis).toContain(FUEL_EMISSION_FACTORS[key].basis);
    }

    // Check fleet
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS) as Array<
      keyof typeof FLEET_EMISSION_FACTORS
    >;
    for (const key of fleetKeys) {
      expect(validBasis).toContain(FLEET_EMISSION_FACTORS[key].basis);
    }

    // Check refrigerants
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5) as Array<
      keyof typeof REFRIGERANT_GWP_AR5
    >;
    for (const key of refrigerantKeys) {
      expect(validBasis).toContain(REFRIGERANT_GWP_AR5[key].basis);
    }

    // Check grid
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS) as Array<
      keyof typeof GRID_EMISSION_FACTORS
    >;
    for (const key of gridKeys) {
      expect(validBasis).toContain(GRID_EMISSION_FACTORS[key].basis);
    }
  });

  it("refrigerants are the only gas-specific factors (all others are co2e)", () => {
    // Count gas-specific factors
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5) as Array<
      keyof typeof REFRIGERANT_GWP_AR5
    >;
    const gasSpecificCount = refrigerantKeys.length;

    // All other factors should be co2e
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS);
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS);
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS);
    const co2eCount = fuelKeys.length + fleetKeys.length + gridKeys.length;

    expect(gasSpecificCount).toBe(8); // 8 refrigerants
    expect(co2eCount).toBeGreaterThan(20); // Many fuel + fleet + grid factors
  });
});

describe("Emission Factor Registry (N2.6 - IFRS S2 B29)", () => {
  it("registry has all four categories: fuel, fleet, refrigerants, grid", () => {
    expect(EMISSION_FACTOR_REGISTRY).toHaveProperty("fuel");
    expect(EMISSION_FACTOR_REGISTRY).toHaveProperty("fleet");
    expect(EMISSION_FACTOR_REGISTRY).toHaveProperty("refrigerants");
    expect(EMISSION_FACTOR_REGISTRY).toHaveProperty("grid");
  });

  it("each registry entry has required B29 disclosure fields", () => {
    const categories = ["fuel", "fleet", "refrigerants", "grid"] as const;

    for (const category of categories) {
      const entry = EMISSION_FACTOR_REGISTRY[category];

      expect(entry).toHaveProperty("factors");
      expect(entry).toHaveProperty("scope");
      expect(entry).toHaveProperty("category");
      expect(entry).toHaveProperty("basis");
      expect(entry).toHaveProperty("sources");
      expect(entry).toHaveProperty("unit");

      // Sources should be an array with at least one source
      expect(Array.isArray(entry.sources)).toBe(true);
      expect(entry.sources.length).toBeGreaterThan(0);
    }
  });

  it("fuel registry entry has correct metadata", () => {
    const fuel = EMISSION_FACTOR_REGISTRY.fuel;

    expect(fuel.scope).toBe("Scope 1");
    expect(fuel.category).toBe("Stationary combustion (fuel)");
    expect(fuel.basis).toBe("co2e");
    expect(fuel.sources).toContain("DEFRA 2024");
    expect(fuel.unit).toContain("kg CO₂e");
    expect(fuel.factors).toBe(FUEL_EMISSION_FACTORS);
  });

  it("fleet registry entry has correct metadata", () => {
    const fleet = EMISSION_FACTOR_REGISTRY.fleet;

    expect(fleet.scope).toBe("Scope 1");
    expect(fleet.category).toBe("Mobile combustion (fleet)");
    expect(fleet.basis).toBe("co2e");
    expect(fleet.sources).toContain("DEFRA 2024");
    expect(fleet.unit).toContain("kg CO₂e");
    expect(fleet.factors).toBe(FLEET_EMISSION_FACTORS);
  });

  it("refrigerants registry entry has correct metadata", () => {
    const refrigerants = EMISSION_FACTOR_REGISTRY.refrigerants;

    expect(refrigerants.scope).toBe("Scope 1");
    expect(refrigerants.category).toBe("Fugitive emissions (refrigerants)");
    expect(refrigerants.basis).toBe("gas-specific");
    expect(refrigerants.sources).toContain("IPCC AR5");
    expect(refrigerants.unit).toContain("GWP");
    expect(refrigerants.factors).toBe(REFRIGERANT_GWP_AR5);
  });

  it("grid registry entry has correct metadata", () => {
    const grid = EMISSION_FACTOR_REGISTRY.grid;

    expect(grid.scope).toBe("Scope 2");
    expect(grid.category).toBe("Purchased electricity (location-based)");
    expect(grid.basis).toBe("co2e");
    expect(grid.sources).toContain("IEA 2024");
    expect(grid.unit).toContain("kg CO₂e per kWh");
    expect(grid.factors).toBe(GRID_EMISSION_FACTORS);
  });

  it("registry basis matches individual factor basis for all entries", () => {
    // Fuel registry says co2e, all fuel factors should say co2e
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS) as Array<
      keyof typeof FUEL_EMISSION_FACTORS
    >;
    for (const key of fuelKeys) {
      expect(FUEL_EMISSION_FACTORS[key].basis).toBe(EMISSION_FACTOR_REGISTRY.fuel.basis);
    }

    // Fleet registry says co2e, all fleet factors should say co2e
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS) as Array<
      keyof typeof FLEET_EMISSION_FACTORS
    >;
    for (const key of fleetKeys) {
      expect(FLEET_EMISSION_FACTORS[key].basis).toBe(EMISSION_FACTOR_REGISTRY.fleet.basis);
    }

    // Refrigerants registry says gas-specific, all refrigerant factors should say gas-specific
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5) as Array<
      keyof typeof REFRIGERANT_GWP_AR5
    >;
    for (const key of refrigerantKeys) {
      expect(REFRIGERANT_GWP_AR5[key].basis).toBe(
        EMISSION_FACTOR_REGISTRY.refrigerants.basis
      );
    }

    // Grid registry says co2e, all grid factors should say co2e
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS) as Array<
      keyof typeof GRID_EMISSION_FACTORS
    >;
    for (const key of gridKeys) {
      expect(GRID_EMISSION_FACTORS[key].basis).toBe(EMISSION_FACTOR_REGISTRY.grid.basis);
    }
  });

  it("registry provides full coverage of all emission factors in the module", () => {
    // Every factor in each constant should be referenced via the registry
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS);
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS);
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5);
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS);

    // Total factors in registry
    const registryFuelKeys = Object.keys(EMISSION_FACTOR_REGISTRY.fuel.factors);
    const registryFleetKeys = Object.keys(EMISSION_FACTOR_REGISTRY.fleet.factors);
    const registryRefrigerantKeys = Object.keys(EMISSION_FACTOR_REGISTRY.refrigerants.factors);
    const registryGridKeys = Object.keys(EMISSION_FACTOR_REGISTRY.grid.factors);

    expect(registryFuelKeys.length).toBe(fuelKeys.length);
    expect(registryFleetKeys.length).toBe(fleetKeys.length);
    expect(registryRefrigerantKeys.length).toBe(refrigerantKeys.length);
    expect(registryGridKeys.length).toBe(gridKeys.length);
  });
});

describe("Factor counts and inventory (N2.6)", () => {
  it("fuel factors: 10 factors (various fuels and units)", () => {
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS);
    expect(fuelKeys.length).toBe(10);
  });

  it("fleet factors: 13 factors (fuel-based and distance-based)", () => {
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS);
    expect(fleetKeys.length).toBe(13);
  });

  it("refrigerant factors: 8 factors (common HVAC refrigerants)", () => {
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5);
    expect(refrigerantKeys.length).toBe(8);
  });

  it("grid factors: 3 factors (Nepal, South Asia, India)", () => {
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS);
    expect(gridKeys.length).toBe(3);
  });

  it("total emission factors: 34 factors across all categories", () => {
    const fuelKeys = Object.keys(FUEL_EMISSION_FACTORS);
    const fleetKeys = Object.keys(FLEET_EMISSION_FACTORS);
    const refrigerantKeys = Object.keys(REFRIGERANT_GWP_AR5);
    const gridKeys = Object.keys(GRID_EMISSION_FACTORS);

    const totalFactors = fuelKeys.length + fleetKeys.length + refrigerantKeys.length + gridKeys.length;
    expect(totalFactors).toBe(34); // 10 fuel + 13 fleet + 8 refrigerants + 3 grid
  });
});
