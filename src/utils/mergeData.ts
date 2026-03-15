import { parseCSV } from './csvParser';
import { parseApiJson } from './jsonParser';
import { extractNameFromFile } from './formatters';
import type { PersonData } from '../types';

export interface FileInput {
  name: string;
  text: string;
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function mergeFilesIntoPeople(
  existing: PersonData[],
  files: FileInput[],
): PersonData[] {
  const people = [...existing];

  for (const file of files) {
    const name = extractNameFromFile(file.name);
    let idx = people.findIndex((p) => normalize(p.name) === normalize(name));

    if (idx < 0) {
      idx = people.length;
      people.push({ name, fileName: file.name, rows: [], note: '' });
    }

    if (file.name.endsWith('.csv')) {
      const rows = parseCSV(file.text);
      const seen = new Set(people[idx].rows.map((r) => r.date.getTime()));
      people[idx] = {
        ...people[idx],
        rows: [...people[idx].rows, ...rows.filter((r) => !seen.has(r.date.getTime()))],
      };
    }

    if (file.name.endsWith('.json')) {
      const metrics = parseApiJson(file.text);
      const existing = people[idx].dailyApiMetrics ?? [];
      const seen = new Set(existing.map((m) => m.dateStr));
      people[idx] = {
        ...people[idx],
        dailyApiMetrics: [...existing, ...metrics.filter((m) => !seen.has(m.dateStr))],
      };
    }
  }

  return people;
}
