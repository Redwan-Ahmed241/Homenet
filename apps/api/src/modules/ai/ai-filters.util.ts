import { ListingType, PropertyType } from '@prisma/client';

/** Platform amenity tags (PROPERTY_TYPES_SPECIFICATION.md §5) → JSON keys that may hold them in Property.amenities. */
export const AMENITY_KEYS = {
  parking: ['parking'],
  lift: ['lift'],
  generator: ['generator'],
  security: ['security'],
  gas: ['gas', 'gas_connection'],
  pool: ['pool', 'swimming_pool'],
  gym: ['gym'],
  rooftop: ['rooftop'],
  loading_dock: ['loading_dock'],
  cctv: ['cctv'],
  road_access: ['road_access'],
  electricity: ['electricity'],
  water: ['water', 'water_supply'],
  covered: ['covered'],
  ev_charging: ['ev_charging'],
} as const satisfies Record<string, readonly string[]>;

export type AmenityTag = keyof typeof AMENITY_KEYS;
export const AMENITY_TAGS = Object.keys(AMENITY_KEYS) as AmenityTag[];

export interface SearchFilters {
  area: string | null;
  listing_type: ListingType | null;
  type: PropertyType | null;
  min_price: number | null;
  max_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  amenities: AmenityTag[];
}

/** Strips control characters and our prompt delimiters so user text cannot break out of its data block. */
export function sanitizeUserText(text: string, maxLength: number): string {
  return (
    text
      // eslint-disable-next-line no-control-regex -- stripping control characters is the point
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ')
      .replace(/<<<|>>>|```/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, maxLength)
  );
}

/** Accepts only the whitelisted filter shape from the model; anything unexpected is dropped. */
export function sanitizeSearchFilters(
  raw: Record<string, unknown>,
): SearchFilters {
  let minPrice = toPositiveNumber(raw.min_price);
  let maxPrice = toPositiveNumber(raw.max_price);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    area: toAreaName(raw.area),
    listing_type: toEnumValue(raw.listing_type, Object.values(ListingType)),
    type: toEnumValue(raw.type, Object.values(PropertyType)),
    min_price: minPrice,
    max_price: maxPrice,
    bedrooms: toCount(raw.bedrooms),
    bathrooms: toCount(raw.bathrooms),
    amenities: toAmenityTags(raw.amenities),
  };
}

export function toAmenityTags(raw: unknown): AmenityTag[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter((a): a is AmenityTag =>
        AMENITY_TAGS.includes(a as AmenityTag),
      ),
    ),
  ];
}

export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function toPositiveNumber(value: unknown): number | null {
  const num =
    typeof value === 'string' ? Number(value.replace(/,/g, '')) : value;
  return typeof num === 'number' && Number.isFinite(num) && num > 0
    ? num
    : null;
}

function toCount(value: unknown): number | null {
  const num = toPositiveNumber(value);
  return num !== null && num <= 20 ? Math.floor(num) : null;
}

function toAreaName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, 60);
  return name.length >= 2 ? name : null;
}

function toEnumValue<T extends string>(value: unknown, allowed: T[]): T | null {
  return typeof value === 'string' && allowed.includes(value.toLowerCase() as T)
    ? (value.toLowerCase() as T)
    : null;
}
