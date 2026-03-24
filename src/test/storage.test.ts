import { saveData, loadData, clearData } from '../utils/storage';
import type { PersonData } from '../types';

function makePerson(overrides: Partial<PersonData> = {}): PersonData {
  return {
    name: 'Алексей Смирнов',
    fileName: 'акк_Алексей_Смирнов.csv',
    rows: [],
    note: '',
    ...overrides,
  };
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveData / loadData roundtrip', () => {
    it('saves and loads empty array', () => {
      saveData([]);
      expect(loadData()).toEqual([]);
    });

    it('saves and loads a person with no rows', () => {
      const people = [makePerson()];
      saveData(people);
      const loaded = loadData();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].name).toBe('Алексей Смирнов');
      expect(loaded[0].rows).toEqual([]);
    });

    it('preserves Date objects after save/load cycle', () => {
      const date = new Date('2026-03-16T10:00:00.000Z');
      const people = [
        makePerson({
          rows: [
            {
              date,
              dateStr: '2026-03-16',
              hour: 13,
              kind: 'Included',
              model: 'composer-1.5',
              maxMode: false,
              inputWithCache: 0,
              inputWithoutCache: 100,
              cacheRead: 200,
              outputTokens: 50,
              totalTokens: 350,
            },
          ],
        }),
      ];
      saveData(people);
      const loaded = loadData();
      expect(loaded[0].rows[0].date).toBeInstanceOf(Date);
      expect(loaded[0].rows[0].date.getTime()).toBe(date.getTime());
      expect(loaded[0].rows[0].dateStr).toBe('2026-03-16');
      expect(loaded[0].rows[0].model).toBe('composer-1.5');
    });

    it('preserves dailyApiMetrics after save/load cycle', () => {
      const people = [
        makePerson({
          dailyApiMetrics: [
            {
              dateStr: '2026-03-16',
              agentRequests: 15,
              linesAdded: 500,
              linesDeleted: 100,
              acceptedLinesAdded: 300,
              acceptedLinesDeleted: 50,
              totalApplies: 10,
              totalAccepts: 8,
              totalRejects: 2,
              totalTabsShown: 20,
              totalTabsAccepted: 15,
              modelUsage: [{ name: 'claude', count: 5 }],
              extensionUsage: [{ name: '.ts', count: 10 }],
            },
          ],
        }),
      ];
      saveData(people);
      const loaded = loadData();
      expect(loaded[0].dailyApiMetrics).toHaveLength(1);
      expect(loaded[0].dailyApiMetrics![0].dateStr).toBe('2026-03-16');
      expect(loaded[0].dailyApiMetrics![0].linesAdded).toBe(500);
      expect(loaded[0].dailyApiMetrics![0].extensionUsage).toEqual([{ name: '.ts', count: 10 }]);
    });

    it('preserves notes', () => {
      const people = [makePerson({ note: 'Отпуск до 20.03' })];
      saveData(people);
      const loaded = loadData();
      expect(loaded[0].note).toBe('Отпуск до 20.03');
    });

    it('saves and loads multiple people', () => {
      const people = [
        makePerson({ name: 'Алексей Смирнов' }),
        makePerson({ name: 'Борис Козлов', fileName: 'акк_Борис_Козлов.csv' }),
        makePerson({ name: 'Виктор Морозов', fileName: 'акк_Виктор_Морозов.csv' }),
      ];
      saveData(people);
      const loaded = loadData();
      expect(loaded).toHaveLength(3);
      expect(loaded.map((p) => p.name)).toEqual([
        'Алексей Смирнов',
        'Борис Козлов',
        'Виктор Морозов',
      ]);
    });
  });

  describe('clearData', () => {
    it('removes data from localStorage', () => {
      saveData([makePerson()]);
      clearData();
      expect(loadData()).toEqual([]);
    });
  });

  describe('loadData error handling', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(loadData()).toEqual([]);
    });

    it('returns empty array when localStorage contains invalid JSON', () => {
      localStorage.setItem('cursor-analytics-data', '{invalid json');
      expect(loadData()).toEqual([]);
    });
  });
});
