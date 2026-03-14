import Papa from 'papaparse';
import type { RawRow, ParsedRow } from '../types';

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function toMoscow(d: Date) {
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return {
    dateStr: msk.toISOString().split('T')[0],
    hour: msk.getUTCHours(),
  };
}

function safeInt(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[",]/g, '').trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

export function parseCSV(text: string): ParsedRow[] {
  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  return result.data
    .filter((row) => row.Date && row.Model)
    .map((row) => {
      const date = new Date(row.Date);
      const msk = toMoscow(date);
      return {
        date,
        dateStr: msk.dateStr,
        hour: msk.hour,
        kind: row.Kind || 'Unknown',
        model: row.Model,
        maxMode: row['Max Mode'] === 'Yes',
        inputWithCache: safeInt(row['Input (w/ Cache Write)']),
        inputWithoutCache: safeInt(row['Input (w/o Cache Write)']),
        cacheRead: safeInt(row['Cache Read']),
        outputTokens: safeInt(row['Output Tokens']),
        totalTokens: safeInt(row['Total Tokens']),
      };
    });
}
