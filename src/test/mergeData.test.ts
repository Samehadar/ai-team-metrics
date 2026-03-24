import { mergeFilesIntoPeople, type FileInput } from '../utils/mergeData';
import type { PersonData, ParsedRow, DailyApiMetric } from '../types';

const CSV_HEADER = 'Date,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost';

function csvRow(date: string): string {
  return `"${date}","Included","composer-1.5","No","0","100","200","50","350","Included"`;
}

function makeCsv(rows: string[]): string {
  return [CSV_HEADER, ...rows].join('\n');
}

function makeJsonFile(days: { date: string; linesAdded?: number; agentRequests?: number }[]): string {
  return JSON.stringify({
    dailyMetrics: days.map((d) => ({
      date: d.date,
      linesAdded: d.linesAdded ?? 100,
      agentRequests: d.agentRequests ?? 5,
    })),
  });
}

function makeRow(dateStr: string): ParsedRow {
  return {
    date: new Date(`${dateStr}T10:00:00.000Z`),
    dateStr,
    hour: 13,
    kind: 'Included',
    model: 'composer-1.5',
    maxMode: false,
    inputWithCache: 0,
    inputWithoutCache: 100,
    cacheRead: 200,
    outputTokens: 50,
    totalTokens: 350,
  };
}

function makeMetric(dateStr: string, linesAdded = 100): DailyApiMetric {
  return {
    dateStr,
    agentRequests: 5,
    linesAdded,
    linesDeleted: 10,
    acceptedLinesAdded: 80,
    acceptedLinesDeleted: 5,
    totalApplies: 10,
    totalAccepts: 8,
    totalRejects: 2,
    totalTabsShown: 20,
    totalTabsAccepted: 15,
    modelUsage: [],
    extensionUsage: [],
  };
}

function makePerson(name: string, rows: ParsedRow[] = [], metrics?: DailyApiMetric[]): PersonData {
  return {
    name,
    fileName: `акк_${name.replace(/ /g, '_')}.csv`,
    rows,
    dailyApiMetrics: metrics,
    note: '',
  };
}

describe('mergeFilesIntoPeople', () => {
  describe('CSV uploads from scratch', () => {
    it('creates a new person from a single CSV file', () => {
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Алексей Смирнов');
      expect(result[0].rows).toHaveLength(1);
    });

    it('creates multiple people from separate files', () => {
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]),
        },
        {
          name: 'акк_Борис_Козлов.csv',
          text: makeCsv([csvRow('2026-03-16T11:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Алексей Смирнов');
      expect(result[1].name).toBe('Борис Козлов');
    });
  });

  describe('CSV deduplication', () => {
    it('deduplicates rows by timestamp when uploading a CSV that overlaps', () => {
      const existing = [
        makePerson('Алексей Смирнов', [makeRow('2026-03-16')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([
            csvRow('2026-03-16T10:00:00.000Z'), // duplicate
            csvRow('2026-03-17T10:00:00.000Z'), // new
          ]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(2);
    });

    it('merges two CSV files for the same person uploaded simultaneously', () => {
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([csvRow('2026-03-14T10:00:00.000Z'), csvRow('2026-03-15T10:00:00.000Z')]),
        },
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([csvRow('2026-03-15T10:00:00.000Z'), csvRow('2026-03-16T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(3); // 14, 15, 16 (15 deduplicated)
    });

    it('does not add any rows if all are duplicates', () => {
      const existing = [
        makePerson('Тест', [makeRow('2026-03-16')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Тест.csv',
          text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result[0].rows).toHaveLength(1);
    });
  });

  describe('JSON uploads', () => {
    it('creates a new person from a single JSON file', () => {
      const ts = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.json',
          text: makeJsonFile([{ date: ts, linesAdded: 500 }]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Алексей Смирнов');
      expect(result[0].dailyApiMetrics).toHaveLength(1);
      expect(result[0].rows).toHaveLength(0);
    });

    it('deduplicates JSON metrics by dateStr when uploading overlapping data', () => {
      const ts16 = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const ts17 = String(Date.UTC(2026, 2, 17, 0, 0, 0));
      const existing = [
        makePerson('Тест', [], [makeMetric('2026-03-16')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([
            { date: ts16, linesAdded: 999 }, // duplicate date — should be ignored
            { date: ts17, linesAdded: 200 }, // new
          ]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result[0].dailyApiMetrics).toHaveLength(2);
      // Original data preserved for 03-16
      expect(result[0].dailyApiMetrics![0].linesAdded).toBe(100);
      // New data added for 03-17
      expect(result[0].dailyApiMetrics![1].linesAdded).toBe(200);
    });

    it('merges two JSON files for the same person uploaded simultaneously', () => {
      const ts14 = String(Date.UTC(2026, 2, 14, 0, 0, 0));
      const ts15 = String(Date.UTC(2026, 2, 15, 0, 0, 0));
      const ts16 = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const files: FileInput[] = [
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts14 }, { date: ts15 }]),
        },
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts15 }, { date: ts16 }]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].dailyApiMetrics).toHaveLength(3); // 14, 15, 16 (15 deduplicated)
    });
  });

  describe('Mixed CSV + JSON uploads', () => {
    it('merges CSV and JSON for the same person — same name extraction', () => {
      const ts = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const files: FileInput[] = [
        {
          name: 'акк_Алексей_Смирнов.csv',
          text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]),
        },
        {
          name: 'акк_Алексей_Смирнов.json',
          text: makeJsonFile([{ date: ts, linesAdded: 500 }]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Алексей Смирнов');
      expect(result[0].rows).toHaveLength(1);
      expect(result[0].dailyApiMetrics).toHaveLength(1);
    });

    it('merges CSV then JSON into existing person data', () => {
      const ts = String(Date.UTC(2026, 2, 17, 0, 0, 0));
      const existing = [
        makePerson('Тест', [makeRow('2026-03-16')], [makeMetric('2026-03-15')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Тест.csv',
          text: makeCsv([csvRow('2026-03-17T10:00:00.000Z')]),
        },
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts }]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result[0].rows).toHaveLength(2); // 16 + 17
      expect(result[0].dailyApiMetrics).toHaveLength(2); // 15 + 17
    });

    it('handles mix of different people with CSV and JSON', () => {
      const ts = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const files: FileInput[] = [
        {
          name: 'акк_Иван_Петров.csv',
          text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]),
        },
        {
          name: 'акк_Мария_Иванова.json',
          text: makeJsonFile([{ date: ts }]),
        },
        {
          name: 'акк_Иван_Петров.json',
          text: makeJsonFile([{ date: ts }]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Иван Петров');
      expect(result[0].rows).toHaveLength(1);
      expect(result[0].dailyApiMetrics).toHaveLength(1);
      expect(result[1].name).toBe('Мария Иванова');
      expect(result[1].dailyApiMetrics).toHaveLength(1);
      expect(result[1].rows).toHaveLength(0);
    });
  });

  describe('Incremental loading scenarios', () => {
    it('adds new data to an existing developer without losing old data', () => {
      const existing = [
        makePerson('Тест', [makeRow('2026-03-14'), makeRow('2026-03-15')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Тест.csv',
          text: makeCsv([
            csvRow('2026-03-16T10:00:00.000Z'),
            csvRow('2026-03-17T10:00:00.000Z'),
          ]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result[0].rows).toHaveLength(4);
    });

    it('preserves notes when merging new data', () => {
      const existing = [
        makePerson('Тест', [makeRow('2026-03-14')]),
      ];
      existing[0].note = 'Важная заметка';
      const files: FileInput[] = [
        {
          name: 'акк_Тест.csv',
          text: makeCsv([csvRow('2026-03-15T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result[0].note).toBe('Важная заметка');
    });

    it('does not modify existing people when uploading for a new person', () => {
      const existing = [
        makePerson('Старый', [makeRow('2026-03-14')]),
      ];
      const files: FileInput[] = [
        {
          name: 'акк_Новый.csv',
          text: makeCsv([csvRow('2026-03-15T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople(existing, files);
      expect(result).toHaveLength(2);
      expect(result[0].rows).toHaveLength(1);
      expect(result[0].name).toBe('Старый');
    });

    it('handles sequential JSON uploads for the same person (no race condition)', () => {
      const ts14 = String(Date.UTC(2026, 2, 14, 0, 0, 0));
      const ts15 = String(Date.UTC(2026, 2, 15, 0, 0, 0));
      const ts16 = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const ts17 = String(Date.UTC(2026, 2, 17, 0, 0, 0));

      const files: FileInput[] = [
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts14 }, { date: ts15 }]),
        },
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts16 }, { date: ts17 }]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].dailyApiMetrics).toHaveLength(4);
    });

    it('handles simultaneous CSV+JSON+CSV for same person without duplication', () => {
      const ts = String(Date.UTC(2026, 2, 16, 0, 0, 0));
      const files: FileInput[] = [
        {
          name: 'акк_Тест.csv',
          text: makeCsv([csvRow('2026-03-14T10:00:00.000Z')]),
        },
        {
          name: 'акк_Тест.json',
          text: makeJsonFile([{ date: ts }]),
        },
        {
          name: 'акк_Тест.csv',
          text: makeCsv([csvRow('2026-03-14T10:00:00.000Z'), csvRow('2026-03-15T10:00:00.000Z')]),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(2); // 14 (deduped) + 15
      expect(result[0].dailyApiMetrics).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('returns copy of existing people when files array is empty', () => {
      const existing = [makePerson('Тест', [makeRow('2026-03-16')])];
      const result = mergeFilesIntoPeople(existing, []);
      expect(result).toEqual(existing);
    });

    it('handles empty CSV file (header only)', () => {
      const files: FileInput[] = [
        { name: 'акк_Тест.csv', text: CSV_HEADER },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(0);
    });

    it('skips non-csv/json files', () => {
      const files: FileInput[] = [
        { name: 'readme.txt', text: 'hello' },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].rows).toHaveLength(0);
    });

    it('does not mutate the original existing array', () => {
      const existing = [makePerson('Тест', [makeRow('2026-03-16')])];
      const originalLen = existing.length;
      mergeFilesIntoPeople(existing, [
        { name: 'акк_Новый.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
      ]);
      expect(existing).toHaveLength(originalLen);
    });

    it('correctly handles JSON file with empty dailyMetrics', () => {
      const files: FileInput[] = [
        {
          name: 'акк_Тест.json',
          text: JSON.stringify({ dailyMetrics: [] }),
        },
      ];
      const result = mergeFilesIntoPeople([], files);
      expect(result).toHaveLength(1);
      expect(result[0].dailyApiMetrics).toHaveLength(0);
    });
  });
});
