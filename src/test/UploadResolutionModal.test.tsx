import { render, screen, fireEvent } from '@testing-library/react';
import UploadResolutionModal from '../components/UploadResolutionModal';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ensureUnassignedTeam, makeTeam } from '../utils/teams';
import type { Team, Member, PersonData } from '../types';
import type { UnmatchedFile } from '../utils/mergeData';

const CSV_TEXT =
  'Date,Cloud Agent ID,Automation ID,Kind,Model,Max Mode,Input (w/ Cache Write),Input (w/o Cache Write),Cache Read,Output Tokens,Total Tokens,Cost\n' +
  '"2026-04-30T20:00:00.000Z","","","Included","claude","No","100","10","0","20","130","Included"\n';

const JSON_TEXT = JSON.stringify({
  dailyMetrics: [
    {
      date: '1777334400000',
      linesAdded: 100,
      linesDeleted: 5,
      acceptedLinesAdded: 100,
      acceptedLinesDeleted: 5,
      totalApplies: 4,
      totalAccepts: 4,
      agentRequests: 5,
      modelUsage: [],
      extensionUsage: [],
    },
  ],
  period: { startDate: '0', endDate: '1777590000000' },
});

function setup(unmatched: UnmatchedFile[], teams: Team[], members: Member[] = [], people: PersonData[] = []) {
  const onApply = vi.fn();
  const onClose = vi.fn();
  render(
    <LanguageProvider>
      <UploadResolutionModal
        unmatched={unmatched}
        matched={[]}
        teams={teams}
        members={members}
        people={people}
        onApply={onApply}
        onClose={onClose}
      />
    </LanguageProvider>,
  );
  return { onApply, onClose };
}

describe('UploadResolutionModal', () => {
  it('creates one member when CSV+JSON for the same new person are uploaded together', () => {
    const team = makeTeam('Backend', []);
    const teams: Team[] = [team];
    const unmatched: UnmatchedFile[] = [
      {
        fileName: 'акк_Vitaly_Lyutarevich.csv',
        text: CSV_TEXT,
        parsedAs: 'csv',
        suggestedName: 'Vitaly Lyutarevich',
      },
      {
        fileName: 'акк_Vitaly_Lyutarevich.json',
        text: JSON_TEXT,
        parsedAs: 'json',
        suggestedName: 'Vitaly Lyutarevich',
      },
    ];
    const { onApply } = setup(unmatched, teams);

    const applyBtn = screen.getByRole('button', { name: /apply|применить/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledTimes(1);
    const arg = onApply.mock.calls[0][0];
    expect(arg.members).toHaveLength(1);
    expect(arg.members[0].name).toBe('Vitaly Lyutarevich');
    expect(arg.members[0].teamId).toBe(team.id);
    expect(arg.people).toHaveLength(1);
    expect(arg.people[0].rows.length).toBeGreaterThan(0);
    expect(arg.people[0].dailyApiMetrics?.length ?? 0).toBeGreaterThan(0);
  });

  it('reuses an existing member with the same name in the same team instead of creating a duplicate', () => {
    const team = makeTeam('Backend', []);
    const existing: Member = {
      id: 'm-existing',
      name: 'Vitaly Lyutarevich',
      teamId: team.id,
      aliases: [],
      note: '',
    };
    const teams: Team[] = [team];
    const unmatched: UnmatchedFile[] = [
      {
        fileName: 'акк_Vitaly_Lyutarevich.csv',
        text: CSV_TEXT,
        parsedAs: 'csv',
        suggestedName: 'Vitaly Lyutarevich',
      },
    ];
    const { onApply } = setup(unmatched, teams, [existing]);

    const applyBtn = screen.getByRole('button', { name: /apply|применить/i });
    fireEvent.click(applyBtn);

    const arg = onApply.mock.calls[0][0];
    expect(arg.members).toHaveLength(1);
    expect(arg.members[0].id).toBe('m-existing');
  });

  it('falls back to "skip" defaults when no team exists', () => {
    const teams: Team[] = ensureUnassignedTeam([]).teams.filter(() => false);
    const unmatched: UnmatchedFile[] = [
      {
        fileName: 'someone.csv',
        text: CSV_TEXT,
        parsedAs: 'csv',
        suggestedName: 'someone',
      },
    ];
    const { onApply } = setup(unmatched, teams);

    const applyBtn = screen.getByRole('button', { name: /apply|применить/i });
    fireEvent.click(applyBtn);

    const arg = onApply.mock.calls[0][0];
    expect(arg.members).toHaveLength(0);
    expect(arg.people).toHaveLength(0);
  });
});
