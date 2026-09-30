/**
 * Demo seeding for bank operational footprint (Scope 1 emissions).
 *
 * Generates realistic Scope 1 emissions for a Nepal bank with:
 * - Fuel: Branch heating (diesel/LPG), backup generators
 * - Fleet: Officer vehicles (cars, motorcycles)
 * - Refrigerants: HVAC system maintenance and leaks
 *
 * Created for N2.1. Demo mode only - live banks capture via officer forms.
 */

import type {
  BankOperationalFootprint,
  FuelEmission,
  FleetEmission,
  RefrigerantEmission,
  Scope1Emissions,
} from "@/lib/types/operational-footprint";
import {
  FUEL_EMISSION_FACTORS,
  FLEET_EMISSION_FACTORS,
  REFRIGERANT_GWP_AR5,
} from "@/lib/regulatory/emissions/factors";

/**
 * Hash a string to a deterministic float [0, 1).
 * Same pattern as used in other demo seeders for consistency.
 */
function hashToFloat(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) / 2147483647;
}

/**
 * Generate deterministic Scope 1 fuel emissions for a reporting period.
 * Simulates:
 * - Diesel generators for backup power (common in Nepal due to load shedding)
 * - LPG for branch heating (some branches)
 * - Natural gas for head office heating (if available)
 */
function generateFuelEmissions(
  reportingYear: number,
  numBranches: number,
): FuelEmission[] {
  const emissions: FuelEmission[] = [];
  let idCounter = 1;

  // Quarterly reporting periods
  const quarters = [
    { start: `${reportingYear}-01-01`, end: `${reportingYear}-03-31`, q: "Q1" },
    { start: `${reportingYear}-04-01`, end: `${reportingYear}-06-30`, q: "Q2" },
    { start: `${reportingYear}-07-01`, end: `${reportingYear}-09-30`, q: "Q3" },
    { start: `${reportingYear}-10-01`, end: `${reportingYear}-12-31`, q: "Q4" },
  ];

  for (const quarter of quarters) {
    // Diesel generators (backup power) - most branches have them
    // Nepal experiences power outages, so backup generators are common
    const dieselBranches = Math.floor(numBranches * 0.8); // 80% of branches
    for (let i = 0; i < dieselBranches; i++) {
      const seed = `diesel-${reportingYear}-${quarter.q}-${i}`;
      const variance = hashToFloat(seed);
      // Average ~50-100 liters per branch per quarter (varies by branch size)
      const liters = 50 + variance * 50;
      const factor = FUEL_EMISSION_FACTORS["diesel-liters"];
      const co2eTonnes = (liters * factor.kgCo2ePerUnit) / 1000;

      emissions.push({
        id: `fuel-${idCounter++}`,
        periodStart: quarter.start,
        periodEnd: quarter.end,
        fuelType: "diesel",
        quantity: Math.round(liters * 10) / 10,
        unit: "liters",
        emissionFactorKgCo2ePerUnit: factor.kgCo2ePerUnit,
        emissionFactorSource: factor.source,
        co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
        facility: `Branch ${i + 1}`,
        description: `Backup generator fuel (${quarter.q} ${reportingYear})`,
      });
    }

    // LPG for heating (winter quarters Q1, Q4) - some branches in mountain regions
    if (quarter.q === "Q1" || quarter.q === "Q4") {
      const lpgBranches = Math.floor(numBranches * 0.3); // 30% need heating
      for (let i = 0; i < lpgBranches; i++) {
        const seed = `lpg-${reportingYear}-${quarter.q}-${i}`;
        const variance = hashToFloat(seed);
        // Average ~20-40 kg LPG per branch per winter quarter
        const kg = 20 + variance * 20;
        const factor = FUEL_EMISSION_FACTORS["lpg-kg"];
        const co2eTonnes = (kg * factor.kgCo2ePerUnit) / 1000;

        emissions.push({
          id: `fuel-${idCounter++}`,
          periodStart: quarter.start,
          periodEnd: quarter.end,
          fuelType: "lpg",
          quantity: Math.round(kg * 10) / 10,
          unit: "kg",
          emissionFactorKgCo2ePerUnit: factor.kgCo2ePerUnit,
          emissionFactorSource: factor.source,
          co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
          facility: `Mountain Branch ${i + 1}`,
          description: `Heating fuel (${quarter.q} ${reportingYear})`,
        });
      }
    }

    // Natural gas for head office (if Q1/Q4 winter heating)
    if (quarter.q === "Q1" || quarter.q === "Q4") {
      const seed = `natgas-${reportingYear}-${quarter.q}`;
      const variance = hashToFloat(seed);
      // Head office uses more heating (larger building)
      const kWh = 1000 + variance * 500;
      const factor = FUEL_EMISSION_FACTORS["natural-gas-kwh"];
      const co2eTonnes = (kWh * factor.kgCo2ePerUnit) / 1000;

      emissions.push({
        id: `fuel-${idCounter++}`,
        periodStart: quarter.start,
        periodEnd: quarter.end,
        fuelType: "natural-gas",
        quantity: Math.round(kWh * 10) / 10,
        unit: "kWh",
        emissionFactorKgCo2ePerUnit: factor.kgCo2ePerUnit,
        emissionFactorSource: factor.source,
        co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
        facility: "Head Office",
        description: `Office heating (${quarter.q} ${reportingYear})`,
      });
    }
  }

  return emissions;
}

/**
 * Generate deterministic Scope 1 fleet emissions for a reporting period.
 * Simulates:
 * - Officer vehicles (cars for senior staff)
 * - Motorcycles (field officers, common in Nepal)
 * - Light commercial vehicles (vans for document transport)
 */
function generateFleetEmissions(
  reportingYear: number,
  numVehicles: number,
): FleetEmission[] {
  const emissions: FleetEmission[] = [];
  let idCounter = 1;

  const quarters = [
    { start: `${reportingYear}-01-01`, end: `${reportingYear}-03-31`, q: "Q1" },
    { start: `${reportingYear}-04-01`, end: `${reportingYear}-06-30`, q: "Q2" },
    { start: `${reportingYear}-07-01`, end: `${reportingYear}-09-30`, q: "Q3" },
    { start: `${reportingYear}-10-01`, end: `${reportingYear}-12-31`, q: "Q4" },
  ];

  // Fleet composition (typical Nepal bank)
  // For small fleets (< 10 vehicles), distribute manually to avoid all zeros
  let fleetMix: Array<{ type: string; fuel: string; count: number }>;
  if (numVehicles < 10) {
    // Small fleet: at least 1 of the most common types
    const remainingAfterMotorcycle = Math.max(0, numVehicles - 1);
    const remainingAfterCar = Math.max(0, remainingAfterMotorcycle - 1);
    fleetMix = [
      { type: "motorcycle", fuel: "petrol", count: Math.min(1, numVehicles) }, // Most common first
      { type: "car", fuel: "petrol", count: Math.min(1, remainingAfterMotorcycle) },
      { type: "car", fuel: "diesel", count: Math.min(1, remainingAfterCar) },
      { type: "van", fuel: "diesel", count: Math.max(0, numVehicles - 3) },
    ];
  } else {
    // Large fleet: use proportions
    fleetMix = [
      { type: "car", fuel: "petrol", count: Math.floor(numVehicles * 0.3) }, // 30% cars
      { type: "car", fuel: "diesel", count: Math.floor(numVehicles * 0.2) }, // 20% diesel cars
      { type: "motorcycle", fuel: "petrol", count: Math.floor(numVehicles * 0.4) }, // 40% motorcycles
      { type: "van", fuel: "diesel", count: Math.floor(numVehicles * 0.1) }, // 10% vans
    ];
  }

  for (const quarter of quarters) {
    for (const vehicleClass of fleetMix) {
      for (let i = 0; i < vehicleClass.count; i++) {
        const seed = `fleet-${vehicleClass.type}-${vehicleClass.fuel}-${reportingYear}-${quarter.q}-${i}`;
        const variance = hashToFloat(seed);

        // Generate distance-based emissions (more common for fleet reporting)
        let distanceKm: number;
        let factorKey: keyof typeof FLEET_EMISSION_FACTORS;

        if (vehicleClass.type === "car") {
          // Cars: 1000-3000 km per quarter
          distanceKm = 1000 + variance * 2000;
          factorKey =
            vehicleClass.fuel === "petrol"
              ? "car-petrol-distance"
              : "car-diesel-distance";
        } else if (vehicleClass.type === "motorcycle") {
          // Motorcycles: 500-1500 km per quarter (shorter trips)
          distanceKm = 500 + variance * 1000;
          factorKey = "motorcycle-petrol-distance";
        } else {
          // Vans: 800-2000 km per quarter
          distanceKm = 800 + variance * 1200;
          factorKey = "van-diesel-distance";
        }

        const factor = FLEET_EMISSION_FACTORS[factorKey];
        if (!("kgCo2ePerKm" in factor)) continue; // skip if no distance factor

        const co2eTonnes = (distanceKm * factor.kgCo2ePerKm) / 1000;

        emissions.push({
          id: `fleet-${idCounter++}`,
          periodStart: quarter.start,
          periodEnd: quarter.end,
          vehicleId: `${vehicleClass.type.toUpperCase()}-${i + 1}`,
          vehicleType: vehicleClass.type as "car" | "motorcycle" | "van",
          fuelType: vehicleClass.fuel as "petrol" | "diesel",
          distanceKm: Math.round(distanceKm * 10) / 10,
          emissionFactorKgCo2ePerKm: factor.kgCo2ePerKm,
          emissionFactorSource: factor.source,
          co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
          description: `${vehicleClass.type} (${vehicleClass.fuel}) - ${quarter.q} ${reportingYear}`,
        });
      }
    }
  }

  return emissions;
}

/**
 * Generate deterministic Scope 1 refrigerant emissions for a reporting period.
 * Simulates:
 * - Annual HVAC maintenance (planned refrigerant recharges)
 * - Emergency leaks (occasional)
 * Common in Nepal: R-410A (modern HVAC), R-134a (older systems)
 */
function generateRefrigerantEmissions(
  reportingYear: number,
  numBranches: number,
): RefrigerantEmission[] {
  const emissions: RefrigerantEmission[] = [];
  let idCounter = 1;

  // Annual HVAC maintenance (typically once per year, middle of year)
  const maintenanceMonth = "06"; // June
  const numSystemsWithMaintenance = Math.floor(numBranches * 0.7); // 70% of branches

  for (let i = 0; i < numSystemsWithMaintenance; i++) {
    const seed = `hvac-maint-${reportingYear}-${i}`;
    const variance = hashToFloat(seed);

    // Determine refrigerant type (modern vs. older systems)
    const refrigerantType = variance < 0.6 ? "R-410A" : "R-134a"; // 60% modern, 40% older
    const gwp = REFRIGERANT_GWP_AR5[refrigerantType];

    // Annual recharge: 0.5-2 kg (typical for split AC systems)
    const quantityKg = 0.5 + variance * 1.5;
    const co2eTonnes = (quantityKg * gwp.gwp100) / 1000;

    emissions.push({
      id: `refrig-${idCounter++}`,
      periodStart: `${reportingYear}-${maintenanceMonth}-01`,
      periodEnd: `${reportingYear}-${maintenanceMonth}-30`,
      refrigerantType,
      quantityKg: Math.round(quantityKg * 100) / 100,
      gwp100: gwp.gwp100,
      gwpSource: gwp.source,
      co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
      facility: `Branch ${i + 1}`,
      systemType: "hvac",
      description: `Annual HVAC maintenance (${reportingYear})`,
    });
  }

  // Emergency leaks (occasional, 10-15% of systems per year)
  const numLeaks = Math.floor(numBranches * 0.12);
  for (let i = 0; i < numLeaks; i++) {
    const seed = `hvac-leak-${reportingYear}-${i}`;
    const variance = hashToFloat(seed);

    // Leak month (random throughout year)
    const leakMonth = String(Math.floor(variance * 12) + 1).padStart(2, "0");

    const refrigerantType = variance < 0.5 ? "R-410A" : "R-22"; // Leaks more common in older R-22 systems
    const gwp = REFRIGERANT_GWP_AR5[refrigerantType];

    // Emergency leak: 1-4 kg (larger than maintenance recharge)
    const quantityKg = 1 + variance * 3;
    const co2eTonnes = (quantityKg * gwp.gwp100) / 1000;

    emissions.push({
      id: `refrig-${idCounter++}`,
      periodStart: `${reportingYear}-${leakMonth}-01`,
      periodEnd: `${reportingYear}-${leakMonth}-28`,
      refrigerantType,
      quantityKg: Math.round(quantityKg * 100) / 100,
      gwp100: gwp.gwp100,
      gwpSource: gwp.source,
      co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
      facility: `Branch ${i + numSystemsWithMaintenance + 1}`,
      systemType: "hvac",
      description: `Emergency leak repair (${reportingYear})`,
    });
  }

  // Server room cooling (head office) - annual maintenance
  {
    const seed = `server-cooling-${reportingYear}`;
    const variance = hashToFloat(seed);
    const refrigerantType = "R-134a"; // Common for precision cooling
    const gwp = REFRIGERANT_GWP_AR5[refrigerantType];
    const quantityKg = 1 + variance * 2; // 1-3 kg for server room system
    const co2eTonnes = (quantityKg * gwp.gwp100) / 1000;

    emissions.push({
      id: `refrig-${idCounter++}`,
      periodStart: `${reportingYear}-08-01`,
      periodEnd: `${reportingYear}-08-31`,
      refrigerantType,
      quantityKg: Math.round(quantityKg * 100) / 100,
      gwp100: gwp.gwp100,
      gwpSource: gwp.source,
      co2eTonnes: Math.round(co2eTonnes * 1000) / 1000,
      facility: "Head Office - Data Center",
      systemType: "server-cooling",
      description: `Server room cooling maintenance (${reportingYear})`,
    });
  }

  return emissions;
}

/**
 * Aggregate Scope 1 emissions by category.
 */
function aggregateScope1(
  fuel: FuelEmission[],
  fleet: FleetEmission[],
  refrigerants: RefrigerantEmission[],
): Scope1Emissions {
  const fuelCo2eTonnes = fuel.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const fleetCo2eTonnes = fleet.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const refrigerantsCo2eTonnes = refrigerants.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const totalCo2eTonnes = fuelCo2eTonnes + fleetCo2eTonnes + refrigerantsCo2eTonnes;

  return {
    fuel,
    fleet,
    refrigerants,
    totalCo2eTonnes: Math.round(totalCo2eTonnes * 1000) / 1000,
    fuelCo2eTonnes: Math.round(fuelCo2eTonnes * 1000) / 1000,
    fleetCo2eTonnes: Math.round(fleetCo2eTonnes * 1000) / 1000,
    refrigerantsCo2eTonnes: Math.round(refrigerantsCo2eTonnes * 1000) / 1000,
  };
}

/**
 * Generate demo operational footprint for a Nepal bank.
 *
 * @param reportingYear Fiscal year (e.g., 2024)
 * @param numBranches Number of bank branches (default 25, typical mid-size Nepal bank)
 * @param numVehicles Number of fleet vehicles (default 20)
 * @returns Complete operational footprint with Scope 1 emissions
 */
export function generateOperationalFootprint(
  reportingYear = 2024,
  numBranches = 25,
  numVehicles = 20,
): BankOperationalFootprint {
  const fuel = generateFuelEmissions(reportingYear, numBranches);
  const fleet = generateFleetEmissions(reportingYear, numVehicles);
  const refrigerants = generateRefrigerantEmissions(reportingYear, numBranches);

  const scope1 = aggregateScope1(fuel, fleet, refrigerants);

  return {
    reportingPeriodStart: `${reportingYear}-01-01`,
    reportingPeriodEnd: `${reportingYear}-12-31`,
    scope1,
    // scope2 will be added in N2.2
  };
}
