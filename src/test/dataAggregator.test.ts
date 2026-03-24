import { getPersonSummary, getGlobalSummary, getAllDates, getAllModels } from '../utils/dataAggregator';
import type { PersonData, ParsedRow } from '../types';

function makeRow(overrides: Partial<ParsedRow> = {}): ParsedRow {
  return {
    date: new Date('2026-03-16T10:00:00.000Z'),
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
    ...overrides,
  };
}

function makePerson(name: string, rows: ParsedRow[] = []): PersonData {
  return {
    name,
    fileName: `акк_${name.replace(/ /g, '_')}.csv`,
    rows,
    note: '',
  };
}

describe('getPersonSummary', () => {
  it('returns correct totals for a person with multiple rows', () => {
    const rows = [
      makeRow({ totalTokens: 1000 }),
      makeRow({ totalTokens: 2000 }),
      makeRow({ totalTokens: 3000 }),
    ];
    const person = makePerson('Тест Тестов', rows);
    const summary = getPersonSummary(person);

    expect(summary.name).toBe('Тест Тестов');
    expect(summary.totalRequests).toBe(3);
    expect(summary.totalTokens).toBe(6000);
  });

  it('calculates active days from unique dateStr values', () => {
    const rows = [
      makeRow({ dateStr: '2026-03-16' }),
      makeRow({ dateStr: '2026-03-16' }),
      makeRow({ dateStr: '2026-03-17' }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.activeDays).toBe(2);
  });

  it('calculates correct avgRequestsPerDay', () => {
    const rows = [
      makeRow({ dateStr: '2026-03-14' }),
      makeRow({ dateStr: '2026-03-14' }),
      makeRow({ dateStr: '2026-03-15' }),
      makeRow({ dateStr: '2026-03-16' }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.avgRequestsPerDay).toBeCloseTo(4 / 3);
  });

  it('builds daily activity sorted by date', () => {
    const rows = [
      makeRow({ dateStr: '2026-03-17', totalTokens: 200 }),
      makeRow({ dateStr: '2026-03-15', totalTokens: 100 }),
      makeRow({ dateStr: '2026-03-17', totalTokens: 300 }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.dailyActivity).toHaveLength(2);
    expect(summary.dailyActivity[0].date).toBe('2026-03-15');
    expect(summary.dailyActivity[0].count).toBe(1);
    expect(summary.dailyActivity[0].tokens).toBe(100);
    expect(summary.dailyActivity[1].date).toBe('2026-03-17');
    expect(summary.dailyActivity[1].count).toBe(2);
    expect(summary.dailyActivity[1].tokens).toBe(500);
  });

  it('produces 24 hourly activity bins', () => {
    const rows = [
      makeRow({ hour: 10 }),
      makeRow({ hour: 10 }),
      makeRow({ hour: 15 }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.hourlyActivity).toHaveLength(24);
    expect(summary.hourlyActivity[10].count).toBe(2);
    expect(summary.hourlyActivity[15].count).toBe(1);
    expect(summary.hourlyActivity[0].count).toBe(0);
  });

  it('aggregates model usage and sorts by count descending', () => {
    const rows = [
      makeRow({ model: 'claude-4.6-opus-high-thinking' }),
      makeRow({ model: 'composer-1.5' }),
      makeRow({ model: 'claude-4.6-opus-high-thinking' }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.modelUsage[0].model).toBe('claude-4.6-opus-high-thinking');
    expect(summary.modelUsage[0].count).toBe(2);
    expect(summary.modelUsage[0].percentage).toBeCloseTo(66.67, 0);
    expect(summary.modelUsage[1].model).toBe('composer-1.5');
    expect(summary.modelUsage[1].count).toBe(1);
  });

  it('returns correct date range', () => {
    const rows = [
      makeRow({ dateStr: '2026-03-17' }),
      makeRow({ dateStr: '2026-03-14' }),
      makeRow({ dateStr: '2026-03-20' }),
    ];
    const summary = getPersonSummary(makePerson('Тест', rows));
    expect(summary.firstDate).toBe('2026-03-14');
    expect(summary.lastDate).toBe('2026-03-20');
  });

  it('handles empty rows', () => {
    const summary = getPersonSummary(makePerson('Тест'));
    expect(summary.totalRequests).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.activeDays).toBe(0);
    expect(summary.avgRequestsPerDay).toBe(0);
    expect(summary.firstDate).toBe('');
    expect(summary.lastDate).toBe('');
  });
});

describe('getGlobalSummary', () => {
  it('aggregates totals across multiple people', () => {
    const people = [
      makePerson('A', [makeRow({ totalTokens: 1000 }), makeRow({ totalTokens: 2000 })]),
      makePerson('B', [makeRow({ totalTokens: 3000 })]),
    ];
    const summary = getGlobalSummary(people);
    expect(summary.totalDevelopers).toBe(2);
    expect(summary.totalRequests).toBe(3);
    expect(summary.totalTokens).toBe(6000);
  });

  it('calculates avgRequestsPerDay based on unique date set', () => {
    const people = [
      makePerson('A', [
        makeRow({ dateStr: '2026-03-14' }),
        makeRow({ dateStr: '2026-03-15' }),
      ]),
      makePerson('B', [
        makeRow({ dateStr: '2026-03-14' }),
        makeRow({ dateStr: '2026-03-16' }),
      ]),
    ];
    const summary = getGlobalSummary(people);
    // 4 requests / 3 unique days
    expect(summary.avgRequestsPerDay).toBeCloseTo(4 / 3);
  });

  it('returns date range across all people', () => {
    const people = [
      makePerson('A', [makeRow({ dateStr: '2026-03-20' })]),
      makePerson('B', [makeRow({ dateStr: '2026-03-10' })]),
    ];
    const summary = getGlobalSummary(people);
    expect(summary.dateRange.start).toBe('2026-03-10');
    expect(summary.dateRange.end).toBe('2026-03-20');
  });

  it('handles empty people', () => {
    const summary = getGlobalSummary([]);
    expect(summary.totalDevelopers).toBe(0);
    expect(summary.totalRequests).toBe(0);
    expect(summary.avgRequestsPerDay).toBe(0);
  });

  it('handles people with no rows', () => {
    const summary = getGlobalSummary([makePerson('A'), makePerson('B')]);
    expect(summary.totalDevelopers).toBe(2);
    expect(summary.totalRequests).toBe(0);
    expect(summary.dateRange.start).toBe('');
  });
});

describe('getAllDates', () => {
  it('returns sorted unique dates across all people', () => {
    const people = [
      makePerson('A', [makeRow({ dateStr: '2026-03-17' }), makeRow({ dateStr: '2026-03-15' })]),
      makePerson('B', [makeRow({ dateStr: '2026-03-15' }), makeRow({ dateStr: '2026-03-20' })]),
    ];
    expect(getAllDates(people)).toEqual(['2026-03-15', '2026-03-17', '2026-03-20']);
  });

  it('returns empty array for no people', () => {
    expect(getAllDates([])).toEqual([]);
  });
});

describe('getAllModels', () => {
  it('aggregates model counts across all people', () => {
    const people = [
      makePerson('A', [makeRow({ model: 'claude' }), makeRow({ model: 'gpt' })]),
      makePerson('B', [makeRow({ model: 'claude' })]),
    ];
    const models = getAllModels(people);
    expect(models.get('claude')).toBe(2);
    expect(models.get('gpt')).toBe(1);
  });

  it('returns empty map for no people', () => {
    expect(getAllModels([]).size).toBe(0);
  });
});
