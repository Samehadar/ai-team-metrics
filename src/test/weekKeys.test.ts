import { getWeekKey, enumerateWeeks } from '../utils/weekKeys';

describe('weekKeys', () => {
  describe('getWeekKey', () => {
    it('returns the same Monday for any day of that ISO week', () => {
      expect(getWeekKey('2026-04-27')).toBe('2026-04-27');
      expect(getWeekKey('2026-04-28')).toBe('2026-04-27');
      expect(getWeekKey('2026-04-30')).toBe('2026-04-27');
      expect(getWeekKey('2026-05-03')).toBe('2026-04-27');
    });

    it('crosses year boundary correctly for Sundays', () => {
      expect(getWeekKey('2026-01-04')).toBe('2025-12-29');
      expect(getWeekKey('2026-01-05')).toBe('2026-01-05');
    });

    it('handles February 1 (Sunday in 2026) correctly', () => {
      expect(getWeekKey('2026-02-01')).toBe('2026-01-26');
      expect(getWeekKey('2026-02-02')).toBe('2026-02-02');
    });

    it('produces lexicographically sortable keys', () => {
      const a = getWeekKey('2026-01-26');
      const b = getWeekKey('2026-03-02');
      const c = getWeekKey('2026-04-27');
      expect([c, a, b].sort()).toEqual([a, b, c]);
    });
  });

  describe('enumerateWeeks', () => {
    it('lists every Monday inclusive', () => {
      expect(enumerateWeeks('2026-04-06', '2026-04-27')).toEqual([
        '2026-04-06',
        '2026-04-13',
        '2026-04-20',
        '2026-04-27',
      ]);
    });

    it('returns a single week if start equals end', () => {
      expect(enumerateWeeks('2026-04-27', '2026-04-27')).toEqual(['2026-04-27']);
    });

    it('returns empty list when end is before start', () => {
      expect(enumerateWeeks('2026-04-27', '2026-04-06')).toEqual([]);
    });

    it('crosses year boundary', () => {
      const out = enumerateWeeks('2025-12-29', '2026-01-12');
      expect(out).toEqual(['2025-12-29', '2026-01-05', '2026-01-12']);
    });

    it('fills missing weeks between sparse activity', () => {
      const out = enumerateWeeks('2026-01-05', '2026-04-27');
      expect(out[0]).toBe('2026-01-05');
      expect(out[out.length - 1]).toBe('2026-04-27');
      expect(out.length).toBe(17);
      const keys = new Set(out);
      expect(keys.has('2026-02-02')).toBe(true);
      expect(keys.has('2026-03-09')).toBe(true);
    });
  });
});
