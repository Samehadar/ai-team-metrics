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

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let hue = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      default:
        hue = (r - g) / d + 4;
    }
    hue *= 60;
  }
  return { h: hue, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = Math.max(0, Math.min(100, s)) / 100;
  const lN = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp < 1) { r1 = c; g1 = x; }
  else if (hp < 2) { r1 = x; g1 = c; }
  else if (hp < 3) { g1 = c; b1 = x; }
  else if (hp < 4) { g1 = x; b1 = c; }
  else if (hp < 5) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  const m = lN - c / 2;
  const toHex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function memberShadeIndex(members: Member[], member: Member): { index: number; total: number } {
  const teamMembers = members
    .filter((m) => m.teamId === member.teamId)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const idx = teamMembers.findIndex((m) => m.id === member.id);
  return { index: Math.max(0, idx), total: teamMembers.length };
}

export function shadeForTeamColor(teamColor: string, index: number, total: number): string {
  if (total <= 1) return teamColor;
  const { h, s, l } = hexToHsl(teamColor);
  const t = (index + 0.5) / total;
  const offset = (t - 0.5) * 2;
  const lightSpread = Math.min(22, 6 + total * 2);
  const satSpread = Math.min(20, 4 + total * 1.5);
  const newL = clamp(l + offset * lightSpread, 30, 72);
  const newS = clamp(s + offset * satSpread, 35, 92);
  return hslToHex(h, newS, newL);
}

export function memberShadeColor(teams: Team[], members: Member[], member: Member | undefined): string {
  if (!member) return '#666';
  const team = teams.find((tm) => tm.id === member.teamId);
  if (!team) return '#666';
  const { index, total } = memberShadeIndex(members, member);
  return shadeForTeamColor(team.color, index, total);
}

export function personShadeColor(teams: Team[], members: Member[], person: PersonData): string {
  if (!person.memberId) return '#666';
  const member = members.find((m) => m.id === person.memberId);
  return memberShadeColor(teams, members, member);
}

export function buildMemberColorMap(teams: Team[], members: Member[]): Map<string, string> {
  const result = new Map<string, string>();
  const byTeam = new Map<string, Member[]>();
  for (const m of members) {
    if (!byTeam.has(m.teamId)) byTeam.set(m.teamId, []);
    byTeam.get(m.teamId)!.push(m);
  }
  for (const [teamId, teamMembers] of byTeam) {
    const team = teams.find((t) => t.id === teamId);
    const color = team?.color ?? '#666';
    const sorted = [...teamMembers].sort(
      (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
    sorted.forEach((m, i) => {
      result.set(m.id, shadeForTeamColor(color, i, sorted.length));
    });
  }
  return result;
}

export function buildPersonColorMap(
  teams: Team[],
  members: Member[],
  people: PersonData[],
): Map<string, string> {
  const memberMap = buildMemberColorMap(teams, members);
  const result = new Map<string, string>();
  for (const p of people) {
    if (p.memberId) {
      const c = memberMap.get(p.memberId);
      if (c) result.set(p.name, c);
    }
  }
  return result;
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
