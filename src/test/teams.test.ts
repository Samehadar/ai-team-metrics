import { describe, it, expect } from 'vitest';
import {
  makeTeam,
  makeMember,
  ensureUnassignedTeam,
  ensureOrphanTeam,
  findMemberForFile,
  findMemberByName,
  normalizeAlias,
  normalizeName,
  membersOfTeam,
  teamColorOfPerson,
  deduplicateAliases,
  moveTeam,
  canMoveTeam,
  sortedTeams,
  UNASSIGNED_TEAM_ID,
} from '../utils/teams';

describe('teams utils', () => {
  it('makeTeam assigns palette colors and orders', () => {
    const t1 = makeTeam('A', []);
    const t2 = makeTeam('B', [t1]);
    expect(t1.color).not.toBe(t2.color);
    expect(t2.order).toBe(t1.order + 1);
  });

  it('ensureUnassignedTeam idempotent', () => {
    const r1 = ensureUnassignedTeam([]);
    const r2 = ensureUnassignedTeam(r1.teams);
    expect(r2.teams.length).toBe(1);
    expect(r2.team.id).toBe(r1.team.id);
  });

  it('ensureOrphanTeam idempotent', () => {
    const r1 = ensureOrphanTeam([]);
    const r2 = ensureOrphanTeam(r1.teams);
    expect(r2.teams.length).toBe(1);
    expect(r2.team.id).toBe(r1.team.id);
  });

  it('normalizeAlias strips file conventions', () => {
    expect(normalizeAlias('акк_Алексей_Смирнов.csv')).toBe('алексей смирнов');
    expect(normalizeAlias('akk_Alexey_Smirnov_2026-03.json')).toBe('alexey smirnov');
  });

  it('normalizeName lowercases and trims', () => {
    expect(normalizeName('  Alex  ')).toBe('alex');
  });

  it('findMemberForFile matches by alias first', () => {
    const team = makeTeam('Backend', []);
    const m1 = makeMember('Алексей', team.id, { aliases: ['алексей смирнов'] });
    const m2 = makeMember('Алёша', team.id, { aliases: ['алёша'] });
    const found = findMemberForFile([m1, m2], 'акк_Алексей_Смирнов.csv');
    expect(found?.id).toBe(m1.id);
  });

  it('findMemberByName ignores case', () => {
    const team = makeTeam('Backend', []);
    const m = makeMember('Bob', team.id);
    expect(findMemberByName([m], ' bob ')?.id).toBe(m.id);
  });

  it('membersOfTeam filters', () => {
    const team = makeTeam('Backend', []);
    const m1 = makeMember('A', team.id);
    const m2 = makeMember('B', 'other');
    expect(membersOfTeam([m1, m2], team.id)).toHaveLength(1);
  });

  it('teamColorOfPerson returns team color or fallback', () => {
    const team = makeTeam('Backend', []);
    const m = makeMember('A', team.id);
    const person: any = { name: 'A', memberId: m.id, rows: [] };
    expect(teamColorOfPerson([team], [m], person)).toBe(team.color);
    expect(teamColorOfPerson([team], [m], { name: 'X', rows: [] } as any)).toBe('#666');
  });

  it('deduplicateAliases removes duplicates and empties', () => {
    expect(deduplicateAliases(['a', 'a', '', 'b', '  '])).toEqual(['a', 'b']);
  });

  it('moveTeam swaps adjacent regular teams', () => {
    const a = makeTeam('A', []);
    const b = makeTeam('B', [a]);
    const c = makeTeam('C', [a, b]);
    const teams = [a, b, c];
    const moved = moveTeam(teams, b.id, 'up');
    expect(sortedTeams(moved).map((t) => t.id)).toEqual([b.id, a.id, c.id]);
    const moved2 = moveTeam(teams, b.id, 'down');
    expect(sortedTeams(moved2).map((t) => t.id)).toEqual([a.id, c.id, b.id]);
  });

  it('moveTeam ignores boundaries and fixed teams', () => {
    const { teams: withUnassigned } = ensureUnassignedTeam([]);
    const a = makeTeam('A', withUnassigned);
    const b = makeTeam('B', [...withUnassigned, a]);
    const teams = [...withUnassigned, a, b];
    expect(moveTeam(teams, a.id, 'up')).toBe(teams);
    expect(moveTeam(teams, b.id, 'down')).toBe(teams);
    expect(moveTeam(teams, UNASSIGNED_TEAM_ID, 'down')).toBe(teams);
  });

  it('canMoveTeam reports edge state correctly', () => {
    const a = makeTeam('A', []);
    const b = makeTeam('B', [a]);
    const teams = [a, b];
    expect(canMoveTeam(teams, a.id, 'up')).toBe(false);
    expect(canMoveTeam(teams, a.id, 'down')).toBe(true);
    expect(canMoveTeam(teams, b.id, 'up')).toBe(true);
    expect(canMoveTeam(teams, b.id, 'down')).toBe(false);
    expect(canMoveTeam(teams, UNASSIGNED_TEAM_ID, 'up')).toBe(false);
  });
});
