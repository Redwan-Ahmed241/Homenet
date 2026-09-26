import { PrismaPropertyRepository } from './prisma-property.repository.js';

/**
 * The search filters that were live bugs on 27 Sep 2026:
 *  - "min 2 bedrooms" matched exactly 2 (returned nothing for 3, 4, 5-bed flats)
 *  - a bathrooms filter silently overwrote the bedrooms filter
 *  - apartment / house could not be searched separately
 */
/** The private where-builder, typed for the test. */
interface WhereBuilder {
  buildWhereFromQuery(query: Record<string, unknown>): {
    AND?: unknown[];
    OR?: unknown[];
    [key: string]: unknown;
  };
}

describe('PrismaPropertyRepository search filters', () => {
  const repo = new PrismaPropertyRepository({} as never, {} as never);
  const where = (query: Record<string, unknown>) =>
    (repo as unknown as WhereBuilder).buildWhereFromQuery(query);

  it('treats bedrooms as a minimum', () => {
    expect(where({ bedrooms: 2 }).AND).toEqual([
      { amenities: { path: ['bedrooms'], gte: 2 } },
    ]);
  });

  it('keeps bedrooms and bathrooms as separate conditions instead of overwriting', () => {
    expect(where({ bedrooms: 3, bathrooms: 2 }).AND).toEqual([
      { amenities: { path: ['bedrooms'], gte: 3 } },
      { amenities: { path: ['bathrooms'], gte: 2 } },
    ]);
  });

  it('supports an explicit bedroom range', () => {
    expect(where({ min_bedrooms: 2, max_bedrooms: 4 }).AND).toEqual([
      { amenities: { path: ['bedrooms'], gte: 2 } },
      { amenities: { path: ['bedrooms'], lte: 4 } },
    ]);
  });

  it('prefers min_bedrooms over the legacy bedrooms parameter', () => {
    expect(where({ bedrooms: 1, min_bedrooms: 3 }).AND).toEqual([
      { amenities: { path: ['bedrooms'], gte: 3 } },
    ]);
  });

  it('adds no room conditions when none are asked for', () => {
    expect(where({ type: 'residential' }).AND).toBeUndefined();
  });

  it('filters by subtype, case-insensitively', () => {
    expect(where({ type: 'residential', subtype: 'Apartment' })).toMatchObject({
      type: 'residential',
      subtype: { equals: 'Apartment', mode: 'insensitive' },
    });
  });

  it('combines room conditions with a text search', () => {
    const result = where({ bedrooms: 2, search: 'Gulshan' });
    expect(result.AND).toHaveLength(1);
    expect(result.OR).toBeDefined();
  });
});
