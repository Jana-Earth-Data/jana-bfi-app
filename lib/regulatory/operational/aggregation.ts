/**
 * Operational footprint aggregation (N2.7).
 *
 * Aggregates the bank's own Scope 1 and Scope 2 emissions with organizational
 * boundary disaggregation per IFRS S2 §29(a)(iv).
 *
 * **One computation, two providers:**
 * - Demo: generates hash-seeded emission records, calls these functions
 * - Live: reads officer-captured emission records from Supabase, calls these functions
 *
 * Both paths produce identical aggregation logic (this module), satisfying the
 * PR0 architectural principle that disclosed numbers are a function of data,
 * not code path.
 *
 * Created for N2.7 (move aggregation from lib/demo into lib/regulatory).
 */

import type {
  FuelEmission,
  FleetEmission,
  RefrigerantEmission,
  Scope1Emissions,
  LocationBasedScope2Emission,
  MarketBasedScope2Emission,
  Scope2Emissions,
} from "@/lib/types/operational-footprint";

/**
 * Organizational entity for boundary disaggregation.
 * Used to determine whether emissions belong to the consolidated accounting
 * group or other investees (associates, joint ventures).
 *
 * Per IFRS S2 §29(a)(iv) and B27, emissions must be disaggregated between:
 * - Consolidated group: entities on the consolidated balance sheet
 * - Other investees: associates, joint ventures, equity investments not consolidated
 */
export type OrganizationalEntity = {
  /** Entity identifier */
  entityId: string;
  /** Entity name */
  entityName: string;
  /**
   * Ownership percentage (0-100).
   * - 100%: fully owned subsidiary (consolidated group)
   * - 50-100%: controlled subsidiary (consolidated group under control approach)
   * - <50%: associate or joint venture (other investees)
   * - 0%: not owned (excluded from operational footprint)
   */
  ownershipPercent: number;
  /**
   * Whether this entity is part of the consolidated accounting group.
   * - true: emissions are 100% attributed to consolidated group
   * - false: emissions are attributed to other investees based on ownership percent
   *
   * This field captures the accounting consolidation decision, which may differ
   * from the ownership percent (e.g., 40% ownership but significant influence → consolidated).
   */
  isConsolidated: boolean;
};

/**
 * Aggregate Scope 1 emissions by category.
 *
 * Per IFRS S2 §29(a)(iv) (N2.5), disaggregates emissions between consolidated
 * accounting group and other investees.
 *
 * @param fuel Fuel combustion emissions
 * @param fleet Fleet vehicle emissions
 * @param refrigerants Refrigerant fugitive emissions
 * @param entities Optional list of organizational entities for disaggregation.
 *   If undefined, assumes all emissions are from the consolidated group (100%/0% split).
 *   For banks with associates/JVs, provide entity ownership data.
 * @returns Aggregated Scope 1 emissions with organizational boundary disaggregation
 */
export function aggregateScope1(
  fuel: FuelEmission[],
  fleet: FleetEmission[],
  refrigerants: RefrigerantEmission[],
  entities?: OrganizationalEntity[],
): Scope1Emissions {
  const fuelCo2eTonnes = fuel.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const fleetCo2eTonnes = fleet.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const refrigerantsCo2eTonnes = refrigerants.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const totalCo2eTonnes = fuelCo2eTonnes + fleetCo2eTonnes + refrigerantsCo2eTonnes;

  // Organizational boundary disaggregation (N2.5, §29(a)(iv))
  // Default: 100% consolidated group, 0% other investees (typical for banks with no associates/JVs)
  // Future: N2.8 will wire entity-based disaggregation for live capture
  const consolidatedGroupCo2eTonnes = totalCo2eTonnes; // TODO N2.8: calculate from entities
  const otherInvesteesCo2eTonnes = 0; // TODO N2.8: calculate from entities

  // Suppress unused variable warning (entities parameter reserved for N2.8)
  void entities;

  const roundedTotal = Math.round(totalCo2eTonnes * 1000) / 1000;
  const roundedConsolidated = Math.round(consolidatedGroupCo2eTonnes * 1000) / 1000;
  const roundedOtherInvestees = Math.round(otherInvesteesCo2eTonnes * 1000) / 1000;

  return {
    fuel,
    fleet,
    refrigerants,
    totalCo2eTonnes: roundedTotal,
    fuelCo2eTonnes: Math.round(fuelCo2eTonnes * 1000) / 1000,
    fleetCo2eTonnes: Math.round(fleetCo2eTonnes * 1000) / 1000,
    refrigerantsCo2eTonnes: Math.round(refrigerantsCo2eTonnes * 1000) / 1000,
    // Organizational boundary disaggregation (N2.5)
    consolidatedGroupCo2eTonnes: roundedConsolidated,
    otherInvesteesCo2eTonnes: roundedOtherInvestees,
  };
}

/**
 * Aggregate Scope 2 location-based and market-based emissions.
 *
 * Per IFRS S2 §29(a)(iv) (N2.5), disaggregates emissions between consolidated
 * accounting group and other investees.
 *
 * Per IFRS S2 B30, location-based method is mandatory; market-based is optional
 * additional disclosure where contractual instruments exist.
 *
 * @param locationBased Location-based Scope 2 emissions (mandatory)
 * @param marketBased Market-based Scope 2 emissions (optional, only where contractual instruments exist)
 * @param entities Optional list of organizational entities for disaggregation.
 *   If undefined, assumes all emissions are from the consolidated group (100%/0% split).
 * @returns Aggregated Scope 2 emissions with organizational boundary disaggregation
 */
export function aggregateScope2(
  locationBased: LocationBasedScope2Emission[],
  marketBased?: MarketBasedScope2Emission[],
  entities?: OrganizationalEntity[],
): Scope2Emissions {
  const totalLocationBasedCo2eTonnes = locationBased.reduce((sum, e) => sum + e.co2eTonnes, 0);
  const totalMarketBasedCo2eTonnes = marketBased
    ? marketBased.reduce((sum, e) => sum + e.co2eTonnes, 0)
    : undefined;

  // Organizational boundary disaggregation (N2.5, §29(a)(iv))
  // Default: 100% consolidated group, 0% other investees
  // Future: N2.8 will wire entity-based disaggregation for live capture
  const consolidatedGroupLocationBasedCo2eTonnes = totalLocationBasedCo2eTonnes; // TODO N2.8: calculate from entities
  const otherInvesteesLocationBasedCo2eTonnes = 0; // TODO N2.8: calculate from entities

  const consolidatedGroupMarketBasedCo2eTonnes: number | undefined = totalMarketBasedCo2eTonnes;
  const otherInvesteesMarketBasedCo2eTonnes: number | undefined =
    totalMarketBasedCo2eTonnes !== undefined ? 0 : undefined;

  // Suppress unused variable warning (entities parameter reserved for N2.8)
  void entities;

  const roundedLocationBased = Math.round(totalLocationBasedCo2eTonnes * 1000) / 1000;
  const roundedConsolidatedLocationBased =
    Math.round(consolidatedGroupLocationBasedCo2eTonnes * 1000) / 1000;
  const roundedOtherInvesteesLocationBased =
    Math.round(otherInvesteesLocationBasedCo2eTonnes * 1000) / 1000;

  const result: Scope2Emissions = {
    locationBased,
    marketBased,
    totalLocationBasedCo2eTonnes: roundedLocationBased,
    totalMarketBasedCo2eTonnes:
      totalMarketBasedCo2eTonnes !== undefined
        ? Math.round(totalMarketBasedCo2eTonnes * 1000) / 1000
        : undefined,
    // Organizational boundary disaggregation (N2.5)
    consolidatedGroupLocationBasedCo2eTonnes: roundedConsolidatedLocationBased,
    otherInvesteesLocationBasedCo2eTonnes: roundedOtherInvesteesLocationBased,
  };

  // Only include market-based disaggregation if market-based emissions exist
  if (consolidatedGroupMarketBasedCo2eTonnes !== undefined) {
    result.consolidatedGroupMarketBasedCo2eTonnes =
      Math.round(consolidatedGroupMarketBasedCo2eTonnes * 1000) / 1000;
  }
  if (otherInvesteesMarketBasedCo2eTonnes !== undefined) {
    result.otherInvesteesMarketBasedCo2eTonnes =
      Math.round(otherInvesteesMarketBasedCo2eTonnes * 1000) / 1000;
  }

  return result;
}
