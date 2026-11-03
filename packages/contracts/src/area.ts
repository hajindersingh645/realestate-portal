export interface AreaConversion {
  unitId: string;
  /** A city id, or null for the default that applies wherever a city has no row of its own. */
  locationId: string | null;
  /** How many base area units (PLATFORM_AREA_BASE_UNIT) one of this unit equals. */
  factor: number;
}

/**
 * Converts an area to the platform's base unit. A marla is not the same size everywhere,
 * so the city's own factor wins and the default is the fallback. Returns null when neither exists.
 */
export function convertToBaseArea(
  conversions: AreaConversion[],
  unitId: string,
  cityId: string | null,
  value: number,
): number | null {
  const forUnit = conversions.filter((conversion) => conversion.unitId === unitId);
  const match =
    forUnit.find((conversion) => cityId !== null && conversion.locationId === cityId) ??
    forUnit.find((conversion) => conversion.locationId === null);
  return match === undefined ? null : value * match.factor;
}
