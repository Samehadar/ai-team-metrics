import type { PersonData, ParsedRow, DailyApiMetric } from '../types';

const STORAGE_KEY = 'ai-team-metrics-data';
const SCHEMA_VERSION = 1;

interface StoredPerson {
  name: string;
  fileName: string;
  note: string;
  rows: ParsedRow[];
  dailyApiMetrics?: DailyApiMetric[];
}

interface StoredSnapshot {
  version: number;
  people: StoredPerson[];
}

function toStorable(people: PersonData[]): StoredSnapshot {
  return {
    version: SCHEMA_VERSION,
    people: people.map((p) => ({
      name: p.name,
      fileName: p.fileName,
      note: p.note,
      rows: p.rows,
      dailyApiMetrics: p.dailyApiMetrics,
    })),
  };
}

function fromStored(data: StoredSnapshot | StoredPerson[]): PersonData[] {
  const people = Array.isArray(data) ? data : data.people;
  return people.map((p) => ({
    ...p,
    rows: p.rows.map((r) => ({
      ...r,
      date: new Date(r.date),
    })),
    dailyApiMetrics: p.dailyApiMetrics,
  }));
}

export interface SaveResult {
  ok: boolean;
  error?: 'quota' | 'unknown';
}

export function saveData(people: PersonData[]): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStorable(people)));
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
}

export function loadData(): PersonData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return fromStored(parsed);
  } catch {
    return [];
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSnapshot(people: PersonData[]): string {
  return JSON.stringify(toStorable(people), null, 2);
}

export function importSnapshot(json: string): PersonData[] {
  const parsed = JSON.parse(json);
  return fromStored(parsed);
}
