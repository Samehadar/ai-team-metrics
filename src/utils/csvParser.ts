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

export interface CsvParseResult {
  rows: ParsedRow[];
  warnings: string[];
}

export function parseCSV(text: string): CsvParseResult {
  const warnings: string[] = [];

  const result = Papa.parse<RawRow>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
  });

  if (result.errors.length > 0) {
    for (const err of result.errors.slice(0, 5)) {
      warnings.push(`Row ${err.row ?? '?'}: ${err.message}`);
    }
    if (result.errors.length > 5) {
      warnings.push(`...and ${result.errors.length - 5} more`);
    }
  }

  let invalidDates = 0;
  const rows = result.data
    .filter((row) => row.Date && row.Model)
    .reduce<ParsedRow[]>((acc, row) => {
      const date = new Date(row.Date);
      if (isNaN(date.getTime())) {
        invalidDates++;
        return acc;
      }
      const msk = toMoscow(date);
      acc.push({
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
      });
      return acc;
    }, []);

  if (invalidDates > 0) {
    warnings.push(`${invalidDates} row(s) skipped: invalid date`);
  }

  return { rows, warnings };
}
