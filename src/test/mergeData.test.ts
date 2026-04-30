import { mergeFilesIntoPeople, attachFilesToMember, type FileInput } from '../utils/mergeData';
import { makeMember, makeTeam } from '../utils/teams';
import type { Member, PersonData, ParsedRow, DailyApiMetric } from '../types';

const CSV_HEADER = 'Date,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost';

function csvRow(date: string): string {
  return `"${date}","Included","composer-1.5","No","0","100","200","50","350","Included"`;
}
function makeCsv(rows: string[]): string {
  return [CSV_HEADER, ...rows].join('\n');
}
function makeJsonFile(days: { date: string; linesAdded?: number; agentRequests?: number }[]): string {
  return JSON.stringify({
    dailyMetrics: days.map((d) => ({
      date: d.date,
      linesAdded: d.linesAdded ?? 100,
      agentRequests: d.agentRequests ?? 5,
    })),
  });
}

function makeRow(dateStr: string): ParsedRow {
  return {
    date: new Date(`${dateStr}T10:00:00.000Z`),
    dateStr,
    hour: 13,
    kind: 'Included',
    model: 'composer-1.5',
    maxMode: false,
    inputWithCache: 0,
    inputWithoutCache: 100,
    cacheRead: 200,
    outputTokens: 50,
    totalTokens: 350,
  };
}
function makeMetric(dateStr: string, linesAdded = 100): DailyApiMetric {
  return {
    dateStr,
    agentRequests: 5,
    linesAdded,
    linesDeleted: 10,
    acceptedLinesAdded: 80,
    acceptedLinesDeleted: 5,
    totalApplies: 10,
    totalAccepts: 8,
    totalRejects: 2,
    totalTabsShown: 20,
    totalTabsAccepted: 15,
    modelUsage: [],
    extensionUsage: [],
  };
}

interface Setup {
  team: ReturnType<typeof makeTeam>;
  member: Member;
  person: PersonData;
}

function setupOne(name: string, fileBase: string, rows: ParsedRow[] = [], metrics?: DailyApiMetric[]): Setup {
  const team = makeTeam('Backend', []);
  const member = makeMember(name, team.id, { aliases: [fileBase] });
  const person: PersonData = {
    name,
    fileName: `акк_${fileBase.replace(/ /g, '_')}.csv`,
    rows,
    dailyApiMetrics: metrics,
    note: '',
    memberId: member.id,
  };
  return { team, member, person };
}

describe('mergeFilesIntoPeople', () => {
  it('returns unmatched when no member alias matches', () => {
    const team = makeTeam('Backend', []);
    const files: FileInput[] = [
      { name: 'акк_Алексей_Смирнов.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ];
    const r = mergeFilesIntoPeople([], [], files);
    expect(r.unmatched).toHaveLength(1);
    expect(r.people).toHaveLength(0);
    expect(r.unmatched[0].suggestedName).toBe('Алексей Смирнов');
    void team;
  });

  it('matches a CSV by member alias and merges rows', () => {
    const { member } = setupOne('Алексей Смирнов', 'алексей смирнов');
    const files: FileInput[] = [
      { name: 'акк_Алексей_Смирнов.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ];
    const r = mergeFilesIntoPeople([], [member], files);
    expect(r.unmatched).toHaveLength(0);
    expect(r.people).toHaveLength(1);
    expect(r.people[0].rows).toHaveLength(1);
    expect(r.people[0].memberId).toBe(member.id);
  });

  it('matches by member name when alias not present', () => {
    const team = makeTeam('Backend', []);
    const member = makeMember('Алексей Смирнов', team.id);
    const files: FileInput[] = [
      { name: 'акк_Алексей_Смирнов.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ];
    const r = mergeFilesIntoPeople([], [member], files);
    expect(r.unmatched).toHaveLength(0);
    expect(r.people).toHaveLength(1);
    expect(r.members[0].aliases).toContain('алексей смирнов');
  });

  it('deduplicates CSV rows by timestamp', () => {
    const existing = setupOne('Алексей Смирнов', 'алексей смирнов', [makeRow('2026-03-16')]);
    const files: FileInput[] = [
      {
        name: 'акк_Алексей_Смирнов.csv',
        text: makeCsv([csvRow('2026-03-16T10:00:00.000Z'), csvRow('2026-03-17T10:00:00.000Z')]),
      },
    ];
    const r = mergeFilesIntoPeople([existing.person], [existing.member], files);
    expect(r.people[0].rows).toHaveLength(2);
  });

  it('deduplicates JSON metrics by dateStr', () => {
    const ts16 = String(Date.UTC(2026, 2, 16, 0, 0, 0));
    const ts17 = String(Date.UTC(2026, 2, 17, 0, 0, 0));
    const existing = setupOne('Тест', 'тест', [], [makeMetric('2026-03-16')]);
    const files: FileInput[] = [
      {
        name: 'акк_Тест.json',
        text: makeJsonFile([{ date: ts16, linesAdded: 999 }, { date: ts17, linesAdded: 200 }]),
      },
    ];
    const r = mergeFilesIntoPeople([existing.person], [existing.member], files);
    expect(r.people[0].dailyApiMetrics).toHaveLength(2);
    expect(r.people[0].dailyApiMetrics![0].linesAdded).toBe(100);
    expect(r.people[0].dailyApiMetrics![1].linesAdded).toBe(200);
  });

  it('handles mixed CSV+JSON for matched member', () => {
    const ts = String(Date.UTC(2026, 2, 16, 0, 0, 0));
    const setup = setupOne('Алексей Смирнов', 'алексей смирнов');
    const files: FileInput[] = [
      { name: 'акк_Алексей_Смирнов.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
      { name: 'акк_Алексей_Смирнов.json', text: makeJsonFile([{ date: ts, linesAdded: 500 }]) },
    ];
    const r = mergeFilesIntoPeople([], [setup.member], files);
    expect(r.people[0].rows).toHaveLength(1);
    expect(r.people[0].dailyApiMetrics).toHaveLength(1);
  });

  it('preserves notes when merging', () => {
    const setup = setupOne('Тест', 'тест', [makeRow('2026-03-14')]);
    setup.person.note = 'Важная заметка';
    const files: FileInput[] = [
      { name: 'акк_Тест.csv', text: makeCsv([csvRow('2026-03-15T10:00:00.000Z')]) },
    ];
    const r = mergeFilesIntoPeople([setup.person], [setup.member], files);
    expect(r.people[0].note).toBe('Важная заметка');
  });

  it('skips non-csv/json files', () => {
    const files: FileInput[] = [{ name: 'readme.txt', text: 'hello' }];
    const r = mergeFilesIntoPeople([], [], files);
    expect(r.people).toHaveLength(0);
    expect(r.unmatched).toHaveLength(0);
  });

  it('does not mutate the original existing array', () => {
    const setup = setupOne('Тест', 'тест', [makeRow('2026-03-16')]);
    const arr = [setup.person];
    const len = arr.length;
    mergeFilesIntoPeople(arr, [setup.member], [
      { name: 'акк_Новый.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ]);
    expect(arr).toHaveLength(len);
  });
});

describe('attachFilesToMember', () => {
  it('forces files onto a member regardless of file name', () => {
    const team = makeTeam('Backend', []);
    const member = makeMember('Алексей Смирнов', team.id);
    const r = attachFilesToMember([], [member], member, [
      { name: 'random_alias.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ]);
    expect(r.people).toHaveLength(1);
    expect(r.members[0].aliases).toContain('random alias');
  });

  it('attaches new alias and matches subsequent batch upload', () => {
    const team = makeTeam('Backend', []);
    const member = makeMember('Алексей Смирнов', team.id);
    const r1 = attachFilesToMember([], [member], member, [
      { name: 'random.csv', text: makeCsv([csvRow('2026-03-16T10:00:00.000Z')]) },
    ]);
    expect(r1.members[0].aliases).toContain('random');
    const r2 = mergeFilesIntoPeople(r1.people, r1.members, [
      { name: 'random.csv', text: makeCsv([csvRow('2026-03-17T10:00:00.000Z')]) },
    ]);
    expect(r2.unmatched).toHaveLength(0);
    expect(r2.people[0].rows).toHaveLength(2);
  });
});
