import { normalizeAmenities, validateListingShape } from './property.rules.js';

describe('validateListingShape', () => {
  it('accepts a well-formed parking listing', () => {
    expect(
      validateListingShape({
        type: 'parking',
        subtype: 'covered',
        areaUnit: 'sqft',
        amenities: {
          covered: true,
          cctv: true,
          ev_charging: false,
          security: true,
          spaces: 2,
        },
      }),
    ).toEqual([]);
  });

  it('accepts older parking data that describes security in words', () => {
    expect(
      validateListingShape({
        type: 'parking',
        amenities: { security: 'cctv', covered: true },
      }),
    ).toEqual([]);
  });

  it('rejects bedrooms and bathrooms on a parking space', () => {
    expect(
      validateListingShape({
        type: 'parking',
        amenities: { bedrooms: 2, bathrooms: 1 },
      }),
    ).toEqual([
      'A parking listing cannot have bedrooms',
      'A parking listing cannot have bathrooms',
    ]);
  });

  it('rejects bedrooms on land', () => {
    expect(
      validateListingShape({ type: 'land', amenities: { bedrooms: 3 } }),
    ).toEqual(['A land listing cannot have bedrooms']);
  });

  it('rejects a parking subtype the app does not offer', () => {
    expect(
      validateListingShape({ type: 'parking', subtype: 'penthouse' }),
    ).toEqual(['Parking subtype must be one of: covered, open, garage']);
  });

  it('accepts parking subtypes regardless of case', () => {
    expect(
      validateListingShape({ type: 'parking', subtype: 'Garage' }),
    ).toEqual([]);
  });

  it('rejects land units for parking', () => {
    expect(
      validateListingShape({ type: 'parking', areaUnit: 'katha' }),
    ).toEqual(['Parking area must be measured in sqft or sqm']);
  });

  it('rejects zero or fractional spaces', () => {
    expect(
      validateListingShape({ type: 'parking', amenities: { spaces: 0 } }),
    ).toEqual(['spaces must be a whole number, 1 or more']);
    expect(
      validateListingShape({ type: 'parking', amenities: { spaces: 1.5 } }),
    ).toEqual(['spaces must be a whole number, 1 or more']);
  });

  it('rejects a non-boolean parking flag', () => {
    expect(
      validateListingShape({ type: 'parking', amenities: { covered: 'yes' } }),
    ).toEqual(['covered must be true or false']);
  });

  it('reports every problem at once', () => {
    expect(
      validateListingShape({
        type: 'parking',
        subtype: 'studio',
        areaUnit: 'bigha',
        amenities: { bedrooms: 1, cctv: 'on' },
      }),
    ).toHaveLength(4);
  });

  it('accepts residential room counts as numbers or numeric strings', () => {
    expect(
      validateListingShape({
        type: 'residential',
        amenities: { bedrooms: 3, bathrooms: '2' },
      }),
    ).toEqual([]);
  });

  it('rejects negative or fractional room counts', () => {
    expect(
      validateListingShape({
        type: 'residential',
        amenities: { bedrooms: -1 },
      }),
    ).toEqual(['bedrooms must be a whole number, 0 or more']);
    expect(
      validateListingShape({
        type: 'residential',
        amenities: { bathrooms: 1.5 },
      }),
    ).toEqual(['bathrooms must be a whole number, 0 or more']);
  });

  it('ignores blank room counts', () => {
    expect(
      validateListingShape({
        type: 'parking',
        amenities: { bedrooms: '', bathrooms: null },
      }),
    ).toEqual([]);
  });

  it('leaves keys it does not know alone', () => {
    expect(
      validateListingShape({
        type: 'residential',
        amenities: { rooftop: true, servant_quarter: 'yes' },
      }),
    ).toEqual([]);
  });

  it('rejects an unknown property type', () => {
    expect(validateListingShape({ type: 'castle' })).toEqual([
      'Unknown property type "castle"',
    ]);
  });
});

describe('normalizeAmenities', () => {
  it('turns numeric strings into numbers so range filters match', () => {
    expect(
      normalizeAmenities({
        bedrooms: '3',
        bathrooms: '2',
        spaces: '1',
        lift: true,
      }),
    ).toEqual({
      bedrooms: 3,
      bathrooms: 2,
      spaces: 1,
      lift: true,
    });
  });

  it('leaves non-numeric strings and other keys untouched', () => {
    expect(normalizeAmenities({ bedrooms: 'many', security: '24/7' })).toEqual({
      bedrooms: 'many',
      security: '24/7',
    });
  });

  it('passes empty values through', () => {
    expect(normalizeAmenities(undefined)).toBeUndefined();
    expect(normalizeAmenities(null)).toBeNull();
  });
});
