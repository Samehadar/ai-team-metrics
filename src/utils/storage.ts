import type { PersonData, ParsedRow, DailyApiMetric, Team, Member, RosterSnapshot } from '../types';
import {
  ensureUnassignedTeam,
  makeMember,
  newId,
  normalizeAlias,
  UNASSIGNED_TEAM_ID,
} from './teams';

const STORAGE_KEY = 'ai-team-metrics-data';
const SCHEMA_VERSION = 2;

interface StoredPerson {
  name: string;
  fileName: string;
  note: string;
  memberId?: string;
  rows: ParsedRow[];
  dailyApiMetrics?: DailyApiMetric[];
}

interface StoredSnapshotV1 {
  version: 1;
  people: StoredPerson[];
}

interface StoredSnapshotV2 {
  version: 2;
  teams: Team[];
  members: Member[];
  people: StoredPerson[];
}

type StoredAny = StoredSnapshotV2 | StoredSnapshotV1 | StoredPerson[];

function toStorable(snapshot: RosterSnapshot): StoredSnapshotV2 {
  return {
    version: SCHEMA_VERSION,
    teams: snapshot.teams,
    members: snapshot.members,
    people: snapshot.people.map((p) => ({
      name: p.name,
      fileName: p.fileName,
      note: p.note,
      memberId: p.memberId,
      rows: p.rows,
      dailyApiMetrics: p.dailyApiMetrics,
    })),
  };
}

function rehydratePeople(stored: StoredPerson[]): PersonData[] {
  return stored.map((p) => ({
    name: p.name,
    fileName: p.fileName,
    note: p.note ?? '',
    memberId: p.memberId,
    rows: (p.rows ?? []).map((r) => ({
      ...r,
      date: new Date(r.date),
    })),
    dailyApiMetrics: p.dailyApiMetrics,
  }));
}

function migrateV1ToV2(people: StoredPerson[]): RosterSnapshot {
  const { teams: withDefault, team: defaultTeam } = ensureUnassignedTeam([]);
  const members: Member[] = [];
  const rehydrated = rehydratePeople(people);
  const linked: PersonData[] = rehydrated.map((p) => {
    const memberId = newId('member');
    const alias = normalizeAlias(p.fileName);
    const aliases = alias ? [alias] : [];
    members.push(makeMember(p.name, defaultTeam.id, { id: memberId, aliases, note: p.note }));
    return { ...p, memberId };
  });
  return { teams: withDefault, members, people: linked };
}

function fromStored(data: StoredAny): RosterSnapshot {
  if (Array.isArray(data)) {
    return migrateV1ToV2(data);
  }
  if (data.version === 1) {
    return migrateV1ToV2(data.people ?? []);
  }
  if (data.version === 2) {
    const teams = data.teams ?? [];
    const members = data.members ?? [];
    const people = rehydratePeople(data.people ?? []);
    if (teams.length === 0 && members.length === 0 && people.length > 0) {
      return migrateV1ToV2(data.people ?? []);
    }
    if (teams.length === 0) {
      const { teams: t } = ensureUnassignedTeam([]);
      return { teams: t, members, people };
    }
    return { teams, members, people };
  }
  return { teams: ensureUnassignedTeam([]).teams, members: [], people: [] };
}

export interface SaveResult {
  ok: boolean;
  error?: 'quota' | 'unknown';
}

export function saveSnapshot(snapshot: RosterSnapshot): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStorable(snapshot)));
    return { ok: true };
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      return { ok: false, error: 'quota' };
    }
    return { ok: false, error: 'unknown' };
  }
}

export function loadSnapshot(): RosterSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { teams: ensureUnassignedTeam([]).teams, members: [], people: [] };
    }
    const parsed = JSON.parse(raw) as StoredAny;
    return fromStored(parsed);
  } catch {
    return { teams: ensureUnassignedTeam([]).teams, members: [], people: [] };
  }
}

export function clearData(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportSnapshot(snapshot: RosterSnapshot): string {
  return JSON.stringify(toStorable(snapshot), null, 2);
}

export function importSnapshot(json: string): RosterSnapshot {
  const parsed = JSON.parse(json) as StoredAny;
  return fromStored(parsed);
}

export { UNASSIGNED_TEAM_ID };
