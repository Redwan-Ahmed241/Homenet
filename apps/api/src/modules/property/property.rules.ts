/**
 * Type-specific listing rules (FR-02). Pure functions: shared by create and
 * update, and tested directly in property.rules.spec.ts.
 *
 * Deliberately lenient about keys they do not know, so existing listings and
 * older app versions keep saving. They reject combinations that make a listing
 * wrong — a parking space with bedrooms, a garage measured in katha.
 */

export const PROPERTY_TYPES = [
  'residential',
  'commercial',
  'land',
  'parking',
] as const;

/** Matches the app's listing wizard (src/features/property/constants/propertyCategories.ts). */
export const PARKING_SUBTYPES = ['covered', 'open', 'garage'] as const;
export const PARKING_AREA_UNITS = ['sqft', 'sqm'] as const;

const PARKING_FLAGS = ['covered', 'cctv', 'ev_charging'] as const;
const ROOM_COUNTS = ['bedrooms', 'bathrooms'] as const;
const NUMERIC_AMENITIES = ['bedrooms', 'bathrooms', 'spaces'] as const;

export interface ListingShape {
  type: string;
  subtype?: string | null;
  areaUnit?: string | null;
  amenities?: Record<string, unknown> | null;
}

/** Every problem found, in plain words. An empty array means the listing is valid. */
export function validateListingShape({
  type,
  subtype,
  areaUnit,
  amenities,
}: ListingShape): string[] {
  if (!(PROPERTY_TYPES as readonly string[]).includes(type)) {
    return [`Unknown property type "${type}"`];
  }

  const problems: string[] = [];
  const values = amenities ?? {};
  const hasNoRooms = type === 'parking' || type === 'land';

  for (const key of ROOM_COUNTS) {
    const value = values[key];
    if (isBlank(value)) continue;
    if (hasNoRooms) {
      problems.push(`A ${type} listing cannot have ${key}`);
    } else if (!isWholeNumber(value, 0)) {
      problems.push(`${key} must be a whole number, 0 or more`);
    }
  }

  if (type === 'parking') {
    if (
      subtype &&
      !(PARKING_SUBTYPES as readonly string[]).includes(subtype.toLowerCase())
    ) {
      problems.push(
        `Parking subtype must be one of: ${PARKING_SUBTYPES.join(', ')}`,
      );
    }
    if (
      areaUnit &&
      !(PARKING_AREA_UNITS as readonly string[]).includes(areaUnit)
    ) {
      problems.push(
        `Parking area must be measured in ${PARKING_AREA_UNITS.join(' or ')}`,
      );
    }
    if (!isBlank(values.spaces) && !isWholeNumber(values.spaces, 1)) {
      problems.push('spaces must be a whole number, 1 or more');
    }
    for (const flag of PARKING_FLAGS) {
      if (values[flag] !== undefined && typeof values[flag] !== 'boolean') {
        problems.push(`${flag} must be true or false`);
      }
    }
    // true/false from the app; a short description such as "cctv" or "24/7" in older data.
    const security = values.security;
    if (
      security !== undefined &&
      typeof security !== 'boolean' &&
      typeof security !== 'string'
    ) {
      problems.push('security must be true/false or a short description');
    }
  }

  return problems;
}

/**
 * Stores room and space counts as numbers. Forms and AI parsing send "3"; the
 * range filters compare numerically, and a string "3" would never match.
 */
export function normalizeAmenities<
  T extends Record<string, unknown> | null | undefined,
>(amenities: T): T {
  if (!amenities) return amenities;
  const result: Record<string, unknown> = { ...amenities };
  for (const key of NUMERIC_AMENITIES) {
    const value = result[key];
    if (
      typeof value === 'string' &&
      value.trim() !== '' &&
      Number.isFinite(Number(value))
    ) {
      result[key] = Number(value);
    }
  }
  return result as T;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

function isWholeNumber(value: unknown, min: number): boolean {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= min;
}
