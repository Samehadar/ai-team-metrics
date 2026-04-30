import Papa from 'papaparse';
import type { Team, Member, RosterSnapshot, PersonData } from '../types';
import {
  ensureUnassignedTeam,
  ensureOrphanTeam,
  findMemberByName,
  makeMember,
  makeTeam,
  newId,
  normalizeAlias,
  normalizeName,
  sortedTeams,
} from './teams';

export interface RosterCsvRow {
  team: string;
  member: string;
  note?: string;
  external_user_id?: string;
}

export interface RosterCsvParseResult {
  rows: RosterCsvRow[];
  warnings: string[];
  hasExternalIdColumn: boolean;
}

export function exportRosterCsv(snapshot: RosterSnapshot): string {
  const teams = sortedTeams(snapshot.teams);
  const hasExternalId = snapshot.members.some((m) => m.externalUserId && m.externalUserId.length > 0);
  const headers = ['team', 'member', 'note'];
  if (hasExternalId) headers.push('external_user_id');
  const rows: string[][] = [headers];
  for (const t of teams) {
    const members = snapshot.members
      .filter((m) => m.teamId === t.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const m of members) {
      const row = [t.name, m.name, m.note ?? ''];
      if (hasExternalId) row.push(m.externalUserId ?? '');
      rows.push(row);
    }
  }
  return Papa.unparse(rows, { quotes: true, newline: '\n' });
}

export function parseRosterCsv(text: string): RosterCsvParseResult {
  const warnings: string[] = [];
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    for (const err of result.errors.slice(0, 5)) {
      warnings.push(`Row ${err.row ?? '?'}: ${err.message}`);
    }
  }

  const fields = result.meta.fields ?? [];
  const hasTeam = fields.includes('team');
  const hasMember = fields.includes('member');
  const hasExternalIdColumn = fields.includes('external_user_id') || fields.includes('externaluserid');
  if (!hasTeam || !hasMember) {
    warnings.push('CSV must have at least "team" and "member" columns');
    return { rows: [], warnings, hasExternalIdColumn };
  }

  const seen = new Set<string>();
  const rows: RosterCsvRow[] = [];
  for (const r of result.data) {
    const team = (r.team ?? '').trim();
    const member = (r.member ?? '').trim();
    const note = (r.note ?? '').trim();
    const externalUserId = (r.external_user_id ?? r.externaluserid ?? '').trim();
    if (!team || !member) continue;
    const key = `${normalizeName(team)}\t${normalizeName(member)}`;
    if (seen.has(key)) {
      warnings.push(`Duplicate skipped: ${team} / ${member}`);
      continue;
    }
    seen.add(key);
    rows.push({ team, member, note: note || undefined, external_user_id: externalUserId || undefined });
  }
  return { rows, warnings, hasExternalIdColumn };
}

export interface RosterImportPreview {
  totalTeams: number;
  totalMembers: number;
  matchingTeams: number;
  matchingMembers: number;
  newTeams: number;
  newMembers: number;
}

export function previewRosterImport(snapshot: RosterSnapshot, parsed: RosterCsvRow[]): RosterImportPreview {
  const teamsByName = new Map(snapshot.teams.map((t) => [normalizeName(t.name), t]));
  const memberByKey = new Map<string, Member>();
  for (const m of snapshot.members) {
    const team = snapshot.teams.find((t) => t.id === m.teamId);
    if (!team) continue;
    memberByKey.set(`${normalizeName(team.name)}\t${normalizeName(m.name)}`, m);
  }
  const seenTeams = new Set<string>();
  let matchingTeams = 0;
  let matchingMembers = 0;
  for (const r of parsed) {
    const teamKey = normalizeName(r.team);
    if (!seenTeams.has(teamKey)) {
      seenTeams.add(teamKey);
      if (teamsByName.has(teamKey)) matchingTeams++;
    }
    if (memberByKey.has(`${teamKey}\t${normalizeName(r.member)}`)) matchingMembers++;
  }
  return {
    totalTeams: seenTeams.size,
    totalMembers: parsed.length,
    matchingTeams,
    matchingMembers,
    newTeams: seenTeams.size - matchingTeams,
    newMembers: parsed.length - matchingMembers,
  };
}

export function applyRosterMerge(snapshot: RosterSnapshot, parsed: RosterCsvRow[]): RosterSnapshot {
  let teams = [...snapshot.teams];
  let members = [...snapshot.members];

  for (const row of parsed) {
    const teamKey = normalizeName(row.team);
    let team = teams.find((t) => normalizeName(t.name) === teamKey);
    if (!team) {
      team = makeTeam(row.team, teams);
      teams = [...teams, team];
    }
    const existing = members.find(
      (m) => m.teamId === team!.id && normalizeName(m.name) === normalizeName(row.member),
    );
    if (existing) {
      const updates: Partial<Member> = {};
      if (row.note && (!existing.note || existing.note.length === 0)) updates.note = row.note;
      if (row.external_user_id && !existing.externalUserId) updates.externalUserId = row.external_user_id;
      if (Object.keys(updates).length > 0) {
        members = members.map((m) => (m.id === existing.id ? { ...m, ...updates } : m));
      }
      continue;
    }
    const sameNameElsewhere = findMemberByName(members, row.member);
    if (sameNameElsewhere && sameNameElsewhere.teamId !== team.id) {
      members = members.map((m) =>
        m.id === sameNameElsewhere.id ? { ...m, teamId: team!.id } : m,
      );
      continue;
    }
    members = [
      ...members,
      makeMember(row.member, team.id, {
        note: row.note,
        externalUserId: row.external_user_id,
      }),
    ];
  }

  return { teams, members, people: snapshot.people };
}

export function applyRosterReplace(snapshot: RosterSnapshot, parsed: RosterCsvRow[]): RosterSnapshot {
  const newTeams: Team[] = [];
  const newMembers: Member[] = [];
  const teamMap = new Map<string, Team>();
  for (const row of parsed) {
    const teamKey = normalizeName(row.team);
    let team = teamMap.get(teamKey);
    if (!team) {
      team = makeTeam(row.team, newTeams);
      newTeams.push(team);
      teamMap.set(teamKey, team);
    }
    const existing = newMembers.find(
      (m) => m.teamId === team!.id && normalizeName(m.name) === normalizeName(row.member),
    );
    if (existing) continue;
    newMembers.push(
      makeMember(row.member, team.id, {
        note: row.note,
        externalUserId: row.external_user_id,
      }),
    );
  }

  const remappedPeople: PersonData[] = [];
  let workingMembers = [...newMembers];
  let workingTeams = [...newTeams];
  let orphanTeam: Team | null = null;
  for (const p of snapshot.people) {
    const oldMember = snapshot.members.find((m) => m.id === p.memberId);
    const lookupName = oldMember?.name ?? p.name;
    let target = findMemberByName(workingMembers, lookupName);
    if (!target) {
      const matchByAlias = workingMembers.find((m) =>
        m.aliases.some((a) => normalizeName(a) === normalizeName(lookupName)),
      );
      if (matchByAlias) target = matchByAlias;
    }
    if (!target) {
      if (!orphanTeam) {
        const ensured = ensureOrphanTeam(workingTeams);
        workingTeams = ensured.teams;
        orphanTeam = ensured.team;
      }
      const aliases: string[] = [];
      const alias = normalizeAlias(p.fileName || lookupName);
      if (alias) aliases.push(alias);
      const orphanMember = makeMember(lookupName, orphanTeam.id, {
        id: newId('member'),
        aliases,
        note: oldMember?.note ?? p.note,
        externalUserId: oldMember?.externalUserId,
      });
      workingMembers = [...workingMembers, orphanMember];
      remappedPeople.push({ ...p, memberId: orphanMember.id });
      continue;
    }
    remappedPeople.push({ ...p, memberId: target.id });
  }

  if (workingTeams.length === 0) {
    const ensured = ensureUnassignedTeam([]);
    workingTeams = ensured.teams;
  }
  return { teams: workingTeams, members: workingMembers, people: remappedPeople };
}

export function downloadRosterTemplate(): string {
  const sample: string[][] = [
    ['team', 'member', 'note'],
    ['Backend', 'Иван Иванов', 'Tech lead'],
    ['Backend', 'Пётр Петров', ''],
    ['Frontend', 'Анна Сидорова', ''],
  ];
  return Papa.unparse(sample, { quotes: true, newline: '\n' });
}
