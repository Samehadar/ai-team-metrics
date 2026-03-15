import type { PersonData, ParsedRow, DailyApiMetric } from '../types';

const STORAGE_KEY = 'cursor-analytics-data';

interface StoredPerson {
  name: string;
  fileName: string;
  note: string;
  rows: ParsedRow[];
  dailyApiMetrics?: DailyApiMetric[];
}

export function saveData(people: PersonData[]): void {
  try {
    const serializable: StoredPerson[] = people.map((p) => ({
      name: p.name,
      fileName: p.fileName,
      note: p.note,
      rows: p.rows.map((r) => ({
        ...r,
        date: r.date as unknown as Date,
      })),
      dailyApiMetrics: p.dailyApiMetrics,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    console.warn('Failed to save data to localStorage');
  }
}

export function loadData(): PersonData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: StoredPerson[] = JSON.parse(raw);
    return parsed.map((p) => ({
      ...p,
      rows: p.rows.map((r) => ({
        ...r,
        date: new Date(r.date),
      })),
      dailyApiMetrics: p.dailyApiMetrics,
    }));
  } catch {
    return [];
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}
