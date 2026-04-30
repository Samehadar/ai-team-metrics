import { saveSnapshot, loadSnapshot, clearData, exportSnapshot, importSnapshot } from '../utils/storage';
import { ensureUnassignedTeam, makeMember, makeTeam } from '../utils/teams';
import type { PersonData, RosterSnapshot } from '../types';

function makePerson(overrides: Partial<PersonData> = {}): PersonData {
  return {
    name: 'Алексей Смирнов',
    fileName: 'акк_Алексей_Смирнов.csv',
    rows: [],
    note: '',
    ...overrides,
  };
}

function emptySnapshot(): RosterSnapshot {
  return { teams: ensureUnassignedTeam([]).teams, members: [], people: [] };
}

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('saveSnapshot / loadSnapshot roundtrip', () => {
    it('saves and loads empty snapshot', () => {
      saveSnapshot(emptySnapshot());
      const loaded = loadSnapshot();
      expect(loaded.people).toEqual([]);
      expect(loaded.teams.length).toBe(1);
    });

    it('preserves Date objects in rows after save/load cycle', () => {
      const date = new Date('2026-03-16T10:00:00.000Z');
      const team = makeTeam('Backend', []);
      const member = makeMember('Алексей Смирнов', team.id);
      const snapshot: RosterSnapshot = {
        teams: [team],
        members: [member],
        people: [
          makePerson({
            memberId: member.id,
            rows: [
              {
                date,
                dateStr: '2026-03-16',
                hour: 13,
                kind: 'Included',
                model: 'composer-1.5',
                maxMode: false,
                inputWithCache: 0,
                inputWithoutCache: 100,
                cacheRead: 200,
                outputTokens: 50,
                totalTokens: 350,
              },
            ],
          }),
        ],
      };
      saveSnapshot(snapshot);
      const loaded = loadSnapshot();
      expect(loaded.people[0].rows[0].date).toBeInstanceOf(Date);
      expect(loaded.people[0].rows[0].date.getTime()).toBe(date.getTime());
      expect(loaded.people[0].rows[0].model).toBe('composer-1.5');
      expect(loaded.teams).toHaveLength(1);
      expect(loaded.members).toHaveLength(1);
      expect(loaded.people[0].memberId).toBe(member.id);
    });

    it('preserves dailyApiMetrics after save/load cycle', () => {
      const team = makeTeam('Backend', []);
      const member = makeMember('Алексей Смирнов', team.id);
      const snapshot: RosterSnapshot = {
        teams: [team],
        members: [member],
        people: [
          makePerson({
            memberId: member.id,
            dailyApiMetrics: [
              {
                dateStr: '2026-03-16',
                agentRequests: 15,
                linesAdded: 500,
                linesDeleted: 100,
                acceptedLinesAdded: 300,
                acceptedLinesDeleted: 50,
                totalApplies: 10,
                totalAccepts: 8,
                totalRejects: 2,
                totalTabsShown: 20,
                totalTabsAccepted: 15,
                modelUsage: [{ name: 'claude', count: 5 }],
                extensionUsage: [{ name: '.ts', count: 10 }],
              },
            ],
          }),
        ],
      };
      saveSnapshot(snapshot);
      const loaded = loadSnapshot();
      expect(loaded.people[0].dailyApiMetrics).toHaveLength(1);
      expect(loaded.people[0].dailyApiMetrics![0].linesAdded).toBe(500);
    });

    it('migrates v1 (array of people) to v2', () => {
      const v1 = [makePerson({ note: 'old note' })];
      localStorage.setItem('ai-team-metrics-data', JSON.stringify(v1));
      const loaded = loadSnapshot();
      expect(loaded.teams.length).toBe(1);
      expect(loaded.members.length).toBe(1);
      expect(loaded.members[0].name).toBe('Алексей Смирнов');
      expect(loaded.people[0].memberId).toBe(loaded.members[0].id);
    });

    it('migrates v1 wrapped object to v2', () => {
      const v1 = { version: 1, people: [makePerson()] };
      localStorage.setItem('ai-team-metrics-data', JSON.stringify(v1));
      const loaded = loadSnapshot();
      expect(loaded.members.length).toBe(1);
      expect(loaded.people[0].memberId).toBeDefined();
    });
  });

  describe('clearData', () => {
    it('removes data from localStorage', () => {
      saveSnapshot(emptySnapshot());
      clearData();
      const loaded = loadSnapshot();
      expect(loaded.people).toEqual([]);
    });
  });

  describe('loadSnapshot error handling', () => {
    it('returns default snapshot when localStorage is empty', () => {
      const loaded = loadSnapshot();
      expect(loaded.people).toEqual([]);
      expect(loaded.members).toEqual([]);
    });

    it('returns default snapshot when localStorage contains invalid JSON', () => {
      localStorage.setItem('ai-team-metrics-data', '{invalid json');
      const loaded = loadSnapshot();
      expect(loaded.people).toEqual([]);
    });
  });

  describe('exportSnapshot / importSnapshot round-trip', () => {
    it('exports and imports preserving all fields', () => {
      const date = new Date('2026-03-16T10:00:00.000Z');
      const team = makeTeam('Backend', []);
      const member = makeMember('Алексей Смирнов', team.id, { aliases: ['алексей смирнов'] });
      const snapshot: RosterSnapshot = {
        teams: [team],
        members: [member],
        people: [
          makePerson({
            memberId: member.id,
            note: 'test note',
            rows: [{
              date,
              dateStr: '2026-03-16',
              hour: 13,
              kind: 'Included',
              model: 'composer-1.5',
              maxMode: false,
              inputWithCache: 0,
              inputWithoutCache: 100,
              cacheRead: 200,
              outputTokens: 50,
              totalTokens: 350,
            }],
          }),
        ],
      };
      const json = exportSnapshot(snapshot);
      const imported = importSnapshot(json);
      expect(imported.people).toHaveLength(1);
      expect(imported.people[0].name).toBe('Алексей Смирнов');
      expect(imported.people[0].rows[0].date).toBeInstanceOf(Date);
      expect(imported.people[0].rows[0].date.getTime()).toBe(date.getTime());
      expect(imported.members[0].aliases).toEqual(['алексей смирнов']);
      expect(imported.teams[0].name).toBe('Backend');
    });

    it('throws on invalid JSON input', () => {
      expect(() => importSnapshot('{broken')).toThrow();
    });
  });
});
