import type { Team, Member, PersonData } from '../types';

export const TEAM_PALETTE = [
  '#e63946',
  '#457b9d',
  '#2a9d8f',
  '#e9c46a',
  '#f4a261',
  '#6a4c93',
  '#1982c4',
  '#8ac926',
  '#ff595e',
  '#06d6a0',
];

export const UNASSIGNED_TEAM_ID = 'team-unassigned';
export const UNASSIGNED_TEAM_NAME = 'Не распределены';
export const ORPHAN_TEAM_ID = 'team-orphan';
export const ORPHAN_TEAM_NAME = 'Не привязаны';

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${rnd}`;
}

export function nextTeamColor(existing: Team[]): string {
  const used = new Set(existing.map((t) => t.color));
  for (const c of TEAM_PALETTE) {
    if (!used.has(c)) return c;
  }
  return TEAM_PALETTE[existing.length % TEAM_PALETTE.length];
}

export function nextTeamOrder(existing: Team[]): number {
  if (existing.length === 0) return 0;
  return Math.max(...existing.map((t) => t.order)) + 1;
}

export function makeTeam(name: string, existing: Team[], opts: { color?: string; id?: string } = {}): Team {
  return {
    id: opts.id ?? newId('team'),
    name: name.trim() || 'Team',
    color: opts.color ?? nextTeamColor(existing),
    order: nextTeamOrder(existing),
  };
}

export function makeMember(name: string, teamId: string, opts: { aliases?: string[]; note?: string; externalUserId?: string; id?: string } = {}): Member {
  return {
    id: opts.id ?? newId('member'),
    name: name.trim(),
    teamId,
    aliases: opts.aliases ?? [],
    note: opts.note ?? '',
    externalUserId: opts.externalUserId,
  };
}

export function ensureUnassignedTeam(teams: Team[]): { teams: Team[]; team: Team } {
  const existing = teams.find((t) => t.id === UNASSIGNED_TEAM_ID);
  if (existing) return { teams, team: existing };
  const team: Team = {
    id: UNASSIGNED_TEAM_ID,
    name: UNASSIGNED_TEAM_NAME,
    color: '#666666',
    order: -1,
  };
  return { teams: [team, ...teams], team };
}

export function ensureOrphanTeam(teams: Team[]): { teams: Team[]; team: Team } {
  const existing = teams.find((t) => t.id === ORPHAN_TEAM_ID);
  if (existing) return { teams, team: existing };
  const team: Team = {
    id: ORPHAN_TEAM_ID,
    name: ORPHAN_TEAM_NAME,
    color: '#888888',
    order: 9999,
  };
  return { teams: [...teams, team], team };
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeAlias(fileName: string): string {
  const base = fileName.replace(/\.(csv|json)$/i, '');
  const withoutPrefix = base.replace(/^(акк|akk|account|acc)[_ -]/i, '');
  const withoutDate = withoutPrefix.replace(/[_ -]\d{4}([_ -]\d{1,2}){0,2}\s*$/, '');
  return normalizeName(withoutDate.replace(/[_-]/g, ' '));
}

export function findMemberForFile(members: Member[], fileName: string): Member | undefined {
  const alias = normalizeAlias(fileName);
  if (!alias) return undefined;
  let m = members.find((mem) => mem.aliases.some((a) => normalizeName(a) === alias));
  if (m) return m;
  m = members.find((mem) => normalizeName(mem.name) === alias);
  return m;
}

export function findMemberByName(members: Member[], name: string): Member | undefined {
  const norm = normalizeName(name);
  return members.find((m) => normalizeName(m.name) === norm);
}

export function sortedTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}

export function membersOfTeam(members: Member[], teamId: string): Member[] {
  return members.filter((m) => m.teamId === teamId);
}

export function teamColorOfMember(teams: Team[], member: Member | undefined): string {
  if (!member) return '#666';
  const team = teams.find((t) => t.id === member.teamId);
  return team?.color ?? '#666';
}

export function teamColorOfPerson(teams: Team[], members: Member[], person: PersonData): string {
  if (!person.memberId) return '#666';
  const member = members.find((m) => m.id === person.memberId);
  return teamColorOfMember(teams, member);
}

export function memberOfPerson(members: Member[], person: PersonData): Member | undefined {
  if (person.memberId) return members.find((m) => m.id === person.memberId);
  return findMemberByName(members, person.name);
}

export function teamOfPerson(teams: Team[], members: Member[], person: PersonData): Team | undefined {
  const m = memberOfPerson(members, person);
  if (!m) return undefined;
  return teams.find((t) => t.id === m.teamId);
}

export function deduplicateAliases(aliases: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of aliases) {
    const norm = normalizeName(a);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(a);
  }
  return out;
}
