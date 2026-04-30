import { describe, it, expect } from 'vitest';
import {
  exportRosterCsv,
  parseRosterCsv,
  applyRosterMerge,
  applyRosterReplace,
  previewRosterImport,
} from '../utils/rosterCsv';
import { makeMember, makeTeam, ensureOrphanTeam } from '../utils/teams';
import type { RosterSnapshot } from '../types';

function emptySnap(): RosterSnapshot {
  return { teams: [], members: [], people: [] };
}

describe('rosterCsv', () => {
  it('exports + parses round-trips', () => {
    const team = makeTeam('Backend', []);
    const m1 = makeMember('Alice', team.id, { note: 'PM', externalUserId: 'alice-1' });
    const m2 = makeMember('Bob', team.id);
    const csv = exportRosterCsv({ teams: [team], members: [m1, m2], people: [] });
    expect(csv).toMatch(/team.*member.*note.*external_user_id/);
    expect(csv).toMatch(/Backend.*Alice.*PM.*alice-1/);
    expect(csv).toMatch(/Backend.*Bob/);
    const parsed = parseRosterCsv(csv);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0].team).toBe('Backend');
    expect(parsed.rows[0].member).toBe('Alice');
    expect(parsed.rows[0].external_user_id).toBe('alice-1');
  });

  it('parseRosterCsv warns on missing columns', () => {
    const r = parseRosterCsv('foo,bar\nx,y');
    expect(r.rows).toHaveLength(0);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('applyRosterMerge adds new teams/members and keeps existing', () => {
    const team = makeTeam('Backend', []);
    const m = makeMember('Alice', team.id);
    const snap: RosterSnapshot = { teams: [team], members: [m], people: [] };
    const merged = applyRosterMerge(snap, [
      { team: 'Backend', member: 'Bob' },
      { team: 'Frontend', member: 'Carol' },
    ]);
    expect(merged.teams.length).toBe(2);
    expect(merged.members.find((m) => m.name === 'Alice')).toBeDefined();
    expect(merged.members.find((m) => m.name === 'Bob')).toBeDefined();
    expect(merged.members.find((m) => m.name === 'Carol')).toBeDefined();
  });

  it('applyRosterMerge updates note only when target empty', () => {
    const team = makeTeam('Backend', []);
    const m = makeMember('Alice', team.id, { note: 'Existing' });
    const snap: RosterSnapshot = { teams: [team], members: [m], people: [] };
    const merged = applyRosterMerge(snap, [
      { team: 'Backend', member: 'Alice', note: 'New' },
    ]);
    const updated = merged.members.find((mm) => mm.name === 'Alice')!;
    expect(updated.note).toBe('Existing');
  });

  it('applyRosterReplace links existing data by name and orphans the rest', () => {
    const team = makeTeam('Backend', []);
    const m1 = makeMember('Alice', team.id);
    const m2 = makeMember('Bob', team.id);
    const personA: any = { name: 'Alice', memberId: m1.id, rows: [], note: '', fileName: '' };
    const personB: any = { name: 'Bob', memberId: m2.id, rows: [], note: '', fileName: '' };
    const snap: RosterSnapshot = { teams: [team], members: [m1, m2], people: [personA, personB] };
    const replaced = applyRosterReplace(snap, [
      { team: 'NewTeam', member: 'Alice' },
    ]);
    const aliceNew = replaced.members.find((mm) => mm.name === 'Alice')!;
    expect(aliceNew).toBeDefined();
    expect(replaced.teams.find((t) => t.name === 'NewTeam')).toBeDefined();
    const linkedAlice = replaced.people.find((p) => p.name === 'Alice')!;
    expect(linkedAlice.memberId).toBe(aliceNew.id);
    const orphanedBob = replaced.people.find((p) => p.name === 'Bob')!;
    const orphanTeam = ensureOrphanTeam(replaced.teams).team;
    const bobMember = replaced.members.find((mm) => mm.id === orphanedBob.memberId)!;
    expect(bobMember.teamId).toBe(orphanTeam.id);
  });

  it('previewRosterImport summarises overlaps', () => {
    const team = makeTeam('Backend', []);
    const m = makeMember('Alice', team.id);
    const snap: RosterSnapshot = { teams: [team], members: [m], people: [] };
    const preview = previewRosterImport(snap, [
      { team: 'Backend', member: 'Alice' },
      { team: 'Frontend', member: 'Bob' },
    ]);
    expect(preview.totalTeams).toBe(2);
    expect(preview.totalMembers).toBe(2);
    expect(preview.matchingTeams).toBe(1);
    expect(preview.matchingMembers).toBe(1);
    expect(preview.newTeams).toBe(1);
    expect(preview.newMembers).toBe(1);
  });

  void emptySnap;
});
