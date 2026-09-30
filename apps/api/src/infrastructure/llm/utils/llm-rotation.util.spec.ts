import {
  buildInterleavedRing,
  parseDurationSeconds,
  pickSlotIndex,
} from './llm-rotation.util.js';

describe('llm-rotation.util', () => {
  describe('buildInterleavedRing', () => {
    it('alternates accounts and wraps accounts with fewer keys', () => {
      const rows = [
        { key_alias: 'k-05', account_id: 'acct-02' },
        { key_alias: 'k-01', account_id: 'acct-01' },
        { key_alias: 'k-03', account_id: 'acct-01' },
        { key_alias: 'k-04', account_id: 'acct-02' },
        { key_alias: 'k-02', account_id: 'acct-01' },
        { key_alias: 'k-06', account_id: 'acct-03' },
      ];
      expect(buildInterleavedRing(rows).map((r) => r.key_alias)).toEqual([
        'k-01',
        'k-04',
        'k-06',
        'k-02',
        'k-05',
        'k-03',
      ]);
    });

    it('is independent of input order', () => {
      const rows = [
        { key_alias: 'b', account_id: 'x' },
        { key_alias: 'a', account_id: 'y' },
        { key_alias: 'c', account_id: 'x' },
      ];
      expect(buildInterleavedRing(rows)).toEqual(
        buildInterleavedRing([...rows].reverse()),
      );
    });
  });

  describe('pickSlotIndex', () => {
    it('maps the counter onto the ring', () => {
      expect(pickSlotIndex(5, 0, () => true)).toBe(0);
      expect(pickSlotIndex(5, 7, () => true)).toBe(2);
    });

    it('walks forward past ineligible slots and wraps', () => {
      expect(pickSlotIndex(5, 3, (i) => i === 1)).toBe(1);
    });

    it('returns null when nothing is eligible', () => {
      expect(pickSlotIndex(5, 3, () => false)).toBeNull();
      expect(pickSlotIndex(0, 3, () => true)).toBeNull();
    });
  });

  describe('parseDurationSeconds', () => {
    it.each([
      ['1m26s', 86],
      ['2m59.56s', 180],
      ['7.66s', 8],
      ['250ms', 1],
      ['1h2m', 3720],
      ['60', 60],
    ])('parses %s', (input, expected) => {
      expect(parseDurationSeconds(input)).toBe(expected);
    });

    it.each([null, undefined, '', 'soon', '5 minutes', '1m26x'])(
      'rejects %p',
      (input) => {
        expect(parseDurationSeconds(input)).toBeNull();
      },
    );
  });
});
