import { parseCSV } from './csvParser';
import { parseApiJson } from './jsonParser';
import { extractNameFromFile } from './formatters';
import {
  deduplicateAliases,
  findMemberForFile,
  newId,
  normalizeAlias,
} from './teams';
import type { Member, PersonData } from '../types';

export interface FileInput {
  name: string;
  text: string;
}

export interface UnmatchedFile {
  fileName: string;
  text: string;
  parsedAs: 'csv' | 'json' | 'unknown';
  suggestedName: string;
}

export interface MatchedFileReport {
  fileName: string;
  text: string;
  parsedAs: 'csv' | 'json';
  memberId: string;
  memberName: string;
  total: number;
  duplicates: number;
  added: number;
}

export interface MergeResult {
  people: PersonData[];
  members: Member[];
  warnings: string[];
  unmatched: UnmatchedFile[];
  matched: MatchedFileReport[];
}

function ensurePersonForMember(people: PersonData[], member: Member): { people: PersonData[]; index: number } {
  let idx = people.findIndex((p) => p.memberId === member.id);
  if (idx >= 0) return { people, index: idx };
  const next = [
    ...people,
    {
      name: member.name,
      fileName: '',
      rows: [],
      note: member.note ?? '',
      memberId: member.id,
    },
  ];
  idx = next.length - 1;
  return { people: next, index: idx };
}

export function mergeFilesIntoPeople(
  existingPeople: PersonData[],
  members: Member[],
  files: FileInput[],
): MergeResult {
  let people = [...existingPeople];
  let workingMembers = [...members];
  const warnings: string[] = [];
  const unmatched: UnmatchedFile[] = [];
  const matched: MatchedFileReport[] = [];

  for (const file of files) {
    const isCsv = file.name.toLowerCase().endsWith('.csv');
    const isJson = file.name.toLowerCase().endsWith('.json');
    if (!isCsv && !isJson) {
      continue;
    }
    const member = findMemberForFile(workingMembers, file.name);
    if (!member) {
      unmatched.push({
        fileName: file.name,
        text: file.text,
        parsedAs: isCsv ? 'csv' : 'json',
        suggestedName: extractNameFromFile(file.name),
      });
      continue;
    }
    const alias = normalizeAlias(file.name);
    if (alias && !member.aliases.some((a) => a === alias)) {
      const idx = workingMembers.findIndex((m) => m.id === member.id);
      if (idx >= 0) {
        workingMembers = [
          ...workingMembers.slice(0, idx),
          { ...member, aliases: deduplicateAliases([...member.aliases, alias]) },
          ...workingMembers.slice(idx + 1),
        ];
      }
    }
    const ensured = ensurePersonForMember(people, member);
    people = ensured.people;
    const idx = ensured.index;

    if (isCsv) {
      const parsed = parseCSV(file.text);
      if (parsed.warnings.length > 0) {
        warnings.push(`${file.name}: ${parsed.warnings.join('; ')}`);
      }
      const seen = new Set(people[idx].rows.map((r) => r.date.getTime()));
      const additions = parsed.rows.filter((r) => !seen.has(r.date.getTime()));
      people[idx] = {
        ...people[idx],
        fileName: people[idx].fileName || file.name,
        rows: [...people[idx].rows, ...additions],
      };
      matched.push({
        fileName: file.name,
        text: file.text,
        parsedAs: 'csv',
        memberId: member.id,
        memberName: member.name,
        total: parsed.rows.length,
        duplicates: parsed.rows.length - additions.length,
        added: additions.length,
      });
    }
    if (isJson) {
      const { metrics, planUsage } = parseApiJson(file.text);
      const existing = people[idx].dailyApiMetrics ?? [];
      const seen = new Set(existing.map((m) => m.dateStr));
      const additions = metrics.filter((m) => !seen.has(m.dateStr));
      const prevSnapshot = people[idx].planUsage;
      const nextSnapshot =
        planUsage && (!prevSnapshot || (planUsage.capturedAt || '') >= (prevSnapshot.capturedAt || ''))
          ? planUsage
          : prevSnapshot;
      people[idx] = {
        ...people[idx],
        fileName: people[idx].fileName || file.name,
        dailyApiMetrics: [...existing, ...additions],
        planUsage: nextSnapshot,
      };
      matched.push({
        fileName: file.name,
        text: file.text,
        parsedAs: 'json',
        memberId: member.id,
        memberName: member.name,
        total: metrics.length,
        duplicates: metrics.length - additions.length,
        added: additions.length,
      });
    }
  }

  return { people, members: workingMembers, warnings, unmatched, matched };
}

export function replaceMemberFile(
  existingPeople: PersonData[],
  members: Member[],
  memberId: string,
  file: FileInput,
): MergeResult {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  const isJson = file.name.toLowerCase().endsWith('.json');
  if (!isCsv && !isJson) {
    return { people: existingPeople, members, warnings: [], unmatched: [], matched: [] };
  }
  const member = members.find((m) => m.id === memberId);
  if (!member) {
    return { people: existingPeople, members, warnings: [], unmatched: [], matched: [] };
  }
  let people = [...existingPeople];
  const ensured = ensurePersonForMember(people, member);
  people = ensured.people;
  const idx = ensured.index;
  const warnings: string[] = [];
  const matched: MatchedFileReport[] = [];

  if (isCsv) {
    const parsed = parseCSV(file.text);
    if (parsed.warnings.length > 0) warnings.push(`${file.name}: ${parsed.warnings.join('; ')}`);
    const newDates = new Set(parsed.rows.map((r) => r.dateStr));
    const kept = people[idx].rows.filter((r) => !newDates.has(r.dateStr));
    const replaced = people[idx].rows.length - kept.length;
    people[idx] = {
      ...people[idx],
      fileName: people[idx].fileName || file.name,
      rows: [...kept, ...parsed.rows],
    };
    matched.push({
      fileName: file.name,
      text: file.text,
      parsedAs: 'csv',
      memberId,
      memberName: member.name,
      total: parsed.rows.length,
      duplicates: replaced,
      added: parsed.rows.length,
    });
  }
  if (isJson) {
    const { metrics, planUsage } = parseApiJson(file.text);
    const existing = people[idx].dailyApiMetrics ?? [];
    const newDates = new Set(metrics.map((m) => m.dateStr));
    const kept = existing.filter((m) => !newDates.has(m.dateStr));
    const replaced = existing.length - kept.length;
    people[idx] = {
      ...people[idx],
      fileName: people[idx].fileName || file.name,
      dailyApiMetrics: [...kept, ...metrics],
      planUsage: planUsage ?? people[idx].planUsage,
    };
    matched.push({
      fileName: file.name,
      text: file.text,
      parsedAs: 'json',
      memberId,
      memberName: member.name,
      total: metrics.length,
      duplicates: replaced,
      added: metrics.length,
    });
  }

  return { people, members, warnings, unmatched: [], matched };
}

export function attachFilesToMember(
  existingPeople: PersonData[],
  members: Member[],
  member: Member,
  files: FileInput[],
): MergeResult {
  let workingMembers = members;
  const aliasesToAdd: string[] = [];
  for (const f of files) {
    const alias = normalizeAlias(f.name);
    if (alias) aliasesToAdd.push(alias);
  }
  const idx = workingMembers.findIndex((m) => m.id === member.id);
  if (idx < 0) {
    workingMembers = [
      ...workingMembers,
      { ...member, aliases: deduplicateAliases([...member.aliases, ...aliasesToAdd]) },
    ];
  } else {
    const target = workingMembers[idx];
    workingMembers = [
      ...workingMembers.slice(0, idx),
      { ...target, aliases: deduplicateAliases([...target.aliases, ...aliasesToAdd]) },
      ...workingMembers.slice(idx + 1),
    ];
  }
  return mergeFilesIntoPeople(existingPeople, workingMembers, files);
}

export function newMemberId(): string {
  return newId('member');
}
