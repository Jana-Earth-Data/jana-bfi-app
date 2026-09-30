/**
 * Bank Operational Footprint - Scope 1 and Scope 2 Emissions
 *
 * Per IFRS S2 §29(a)(i), an entity shall disclose its absolute gross greenhouse gas
 * emissions generated during the reporting period, classified into Scope 1, Scope 2,
 * and Scope 3. This module models the bank's own operational emissions (Scopes 1 and 2),
 * separate from Scope 3 Category 15 financed emissions (which are in lib/types/bfi.ts).
 *
 * **Scope 1** (§29(a)(i)): Direct GHG emissions from sources the bank owns or controls.
 * Per GHG Protocol Corporate Standard, this includes:
 * - Stationary combustion (fuel for heating, backup generators)
 * - Mobile combustion (bank-owned vehicles - fleet)
 * - Fugitive emissions (refrigerants from HVAC and cooling systems)
 *
 * **Scope 2** (§29(a)(v), B30-B31): Indirect emissions from purchased electricity,
 * steam, heating, or cooling. B30 mandates location-based method; market-based is
 * optional additional disclosure where contractual instruments exist.
 *
 * Created for N2.1 (Scope 1) and N2.2 (Scope 2).
 */

// ---------------------------------------------------------------------------
// Scope 1: Direct emissions
// ---------------------------------------------------------------------------

/**
 * Fuel combustion emissions (stationary sources).
 * Covers heating fuel, backup generators, and other stationary combustion equipment.
 */
export type FuelEmission = {
  /** Unique identifier for this emission record */
  id: string;
  /** Reporting period start date (ISO 8601) */
  periodStart: string;
  /** Reporting period end date (ISO 8601) */
  periodEnd: string;
  /** Type of fuel consumed */
  fuelType:
    | "natural-gas"
    | "diesel"
    | "heating-oil"
    | "lpg" // Liquefied Petroleum Gas
    | "petrol"
    | "coal"
    | "biomass"
    | "other";
  /** Quantity of fuel consumed during the period */
  quantity: number;
  /** Unit of measurement for quantity */
  unit: "liters" | "kg" | "m3" | "kWh" | "tonnes";
  /**
   * Emission factor in kg CO2e per unit.
   * Per IFRS S2 B29, source and basis (CO2e-converted or gas-specific) must be
   * disclosed. If gas-specific, GWP100 conversion per B22 is applied elsewhere.
   */
  emissionFactorKgCo2ePerUnit: number;
  /** Emission factor source (e.g., "IPCC 2006 Vol.2 Ch.2", "DEFRA 2024", custom measurement) */
  emissionFactorSource: string;
  /** Total emissions in CO2e tonnes for this record */
  co2eTonnes: number;
  /** Branch or facility name where fuel was consumed (optional) */
  facility?: string;
  /** Description or notes (e.g., "Head office heating", "Branch generator backup") */
  description?: string;
  /** URL to supporting evidence (invoice, receipt, meter reading) */
  evidenceUrl?: string;
};

/**
 * Fleet vehicle emissions (mobile combustion).
 * Emissions from bank-owned or controlled vehicles.
 */
export type FleetEmission = {
  /** Unique identifier for this emission record */
  id: string;
  /** Reporting period start date (ISO 8601) */
  periodStart: string;
  /** Reporting period end date (ISO 8601) */
  periodEnd: string;
  /** Vehicle identifier (registration number, asset ID, etc.) - optional */
  vehicleId?: string;
  /** Type of vehicle */
  vehicleType: "car" | "motorcycle" | "truck" | "van" | "bus" | "other";
  /** Fuel type used by the vehicle */
  fuelType:
    | "petrol"
    | "diesel"
    | "cng" // Compressed Natural Gas
    | "lpg"
    | "electric" // for completeness, though Scope 2
    | "hybrid"
    | "other";
  /**
   * Distance traveled in kilometers (optional).
   * Use when emission factor is per-km (e.g., average vehicle consumption).
   */
  distanceKm?: number;
  /**
   * Fuel consumed in liters (optional).
   * Use when emission factor is per-liter (direct fuel purchase method).
   */
  fuelConsumedLiters?: number;
  /**
   * Emission factor in kg CO2e per liter (if using fuel consumption method).
   * Per IFRS S2 B29, source must be disclosed.
   */
  emissionFactorKgCo2ePerLiter?: number;
  /**
   * Emission factor in kg CO2e per km (if using distance method).
   * Typically used with fleet-average factors.
   */
  emissionFactorKgCo2ePerKm?: number;
  /** Emission factor source */
  emissionFactorSource: string;
  /** Total emissions in CO2e tonnes for this record */
  co2eTonnes: number;
  /** Description or notes (e.g., "Officer vehicle - Kathmandu region") */
  description?: string;
  /** URL to supporting evidence (fuel receipt, logbook, odometer reading) */
  evidenceUrl?: string;
};

/**
 * Refrigerant emissions (fugitive emissions).
 * Per GHG Protocol, fugitive emissions are intentional or unintentional releases
 * of GHGs (e.g., leaks from HVAC systems, server room cooling, refrigeration).
 * Refrigerants have high Global Warming Potential (GWP).
 */
export type RefrigerantEmission = {
  /** Unique identifier for this emission record */
  id: string;
  /** Reporting period start date (ISO 8601) */
  periodStart: string;
  /** Reporting period end date (ISO 8601) */
  periodEnd: string;
  /**
   * Refrigerant type (chemical designation).
   * Common refrigerants and their GWP100 (AR5):
   * - R-410A: GWP 2,088 (common in HVAC)
   * - R-134a: GWP 1,430 (older HVAC, automotive AC)
   * - R-32: GWP 675 (newer HVAC, lower impact)
   * - R-22: GWP 1,810 (older HVAC, being phased out)
   * - R-404A: GWP 3,922 (commercial refrigeration)
   */
  refrigerantType:
    | "R-410A"
    | "R-134a"
    | "R-32"
    | "R-22"
    | "R-404A"
    | "R-407C"
    | "R-744" // CO2 (natural refrigerant, GWP=1)
    | "R-290" // Propane (natural, GWP=3)
    | "other";
  /** Quantity of refrigerant leaked or recharged, in kilograms */
  quantityKg: number;
  /**
   * Global Warming Potential (100-year time horizon) for this refrigerant.
   * Per IFRS S2 B21, use latest IPCC GWP values. Per B22, if the factor is
   * gas-specific (not pre-converted to CO2e), entity must apply GWP100.
   * Source: IPCC AR5 or AR6 (disclose which).
   */
  gwp100: number;
  /** GWP source (e.g., "IPCC AR5", "IPCC AR6") */
  gwpSource: string;
  /** Total emissions in CO2e tonnes = (quantityKg / 1000) × gwp100 */
  co2eTonnes: number;
  /** Branch or facility name where refrigerant was used/leaked (optional) */
  facility?: string;
  /** Type of system that used the refrigerant */
  systemType:
    | "hvac" // Heating, Ventilation, Air Conditioning
    | "server-cooling" // Data center / IT cooling
    | "refrigerator" // Commercial refrigerator
    | "freezer"
    | "chiller"
    | "other";
  /** Description or notes (e.g., "Annual HVAC maintenance recharge", "Emergency leak repair") */
  description?: string;
  /** URL to supporting evidence (service invoice, refrigerant receipt) */
  evidenceUrl?: string;
};

/**
 * Aggregated Scope 1 emissions.
 * Per IFRS S2 §29(a)(i), disclose absolute gross Scope 1 GHG emissions in metric
 * tonnes of CO2 equivalent.
 */
export type Scope1Emissions = {
  /** Individual fuel combustion records */
  fuel: FuelEmission[];
  /** Individual fleet vehicle records */
  fleet: FleetEmission[];
  /** Individual refrigerant leak/recharge records */
  refrigerants: RefrigerantEmission[];
  /** Total Scope 1 emissions (sum of all categories) in CO2e tonnes */
  totalCo2eTonnes: number;
  /** Subtotal: fuel combustion emissions in CO2e tonnes */
  fuelCo2eTonnes: number;
  /** Subtotal: fleet (mobile combustion) emissions in CO2e tonnes */
  fleetCo2eTonnes: number;
  /** Subtotal: refrigerant (fugitive) emissions in CO2e tonnes */
  refrigerantsCo2eTonnes: number;
};

// ---------------------------------------------------------------------------
// Scope 2: Indirect emissions from purchased energy (N2.2 - not yet implemented)
// ---------------------------------------------------------------------------

/**
 * Scope 2 location-based electricity emissions.
 * Per IFRS S2 B30, location-based method is mandatory. Market-based is optional
 * additional disclosure where contractual instruments (e.g., renewable energy
 * certificates) exist.
 *
 * Placeholder for N2.2 implementation.
 */
export type LocationBasedScope2Emission = {
  id: string;
  periodStart: string;
  periodEnd: string;
  electricityConsumedKWh: number;
  gridEmissionFactorKgCo2ePerKWh: number; // Location-based grid average
  emissionFactorSource: string;
  co2eTonnes: number;
  facility?: string;
  description?: string;
  evidenceUrl?: string;
};

/**
 * Scope 2 market-based electricity emissions (optional, per B30).
 * Only disclosed when contractual instruments exist (e.g., renewable energy
 * contracts, unbundled RECs).
 *
 * Placeholder for N2.2 implementation.
 */
export type MarketBasedScope2Emission = {
  id: string;
  periodStart: string;
  periodEnd: string;
  electricityConsumedKWh: number;
  contractualEmissionFactorKgCo2ePerKWh: number; // From contractual instrument
  contractType: "renewable-energy-certificate" | "power-purchase-agreement" | "green-tariff" | "other";
  contractDetails?: string;
  emissionFactorSource: string;
  co2eTonnes: number;
  facility?: string;
  description?: string;
  evidenceUrl?: string;
};

/**
 * Aggregated Scope 2 emissions (placeholder for N2.2).
 * Per IFRS S2 §29(a)(v) and B30, disclose location-based Scope 2 emissions
 * (mandatory) and optionally market-based where contractual instruments exist.
 */
export type Scope2Emissions = {
  locationBased: LocationBasedScope2Emission[];
  marketBased?: MarketBasedScope2Emission[];
  totalLocationBasedCo2eTonnes: number;
  totalMarketBasedCo2eTonnes?: number;
};

// ---------------------------------------------------------------------------
// Top-level operational footprint
// ---------------------------------------------------------------------------

/**
 * The bank's own operational emissions (Scopes 1 and 2).
 * Per IFRS S2 §29(a)(i), entity shall disclose absolute gross GHG emissions
 * for Scope 1 (direct emissions from owned/controlled sources) and Scope 2
 * (indirect emissions from purchased energy), separate from Scope 3 Category 15
 * financed emissions (which are disclosed in the PortfolioSummary).
 *
 * This is the bank's own carbon footprint, not the financed emissions from its
 * loan portfolio.
 */
export type BankOperationalFootprint = {
  /** Reporting period start date (ISO 8601) - typically fiscal year start */
  reportingPeriodStart: string;
  /** Reporting period end date (ISO 8601) - typically fiscal year end */
  reportingPeriodEnd: string;
  /** Scope 1: Direct emissions from owned/controlled sources (N2.1) */
  scope1: Scope1Emissions;
  /** Scope 2: Indirect emissions from purchased energy (N2.2 - not yet implemented) */
  scope2?: Scope2Emissions;
};
