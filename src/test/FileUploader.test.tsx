import { render, screen, fireEvent } from '@testing-library/react';
import FileUploader from '../components/FileUploader';
import { LanguageProvider } from '../i18n/LanguageContext';
import { ensureUnassignedTeam, makeMember, makeTeam } from '../utils/teams';
import type { PersonData, RosterSnapshot } from '../types';

function snap(people: PersonData[] = [], opts: { withTeam?: boolean } = {}): RosterSnapshot {
  if (!opts.withTeam) {
    return { teams: ensureUnassignedTeam([]).teams, members: [], people };
  }
  const team = makeTeam('Backend', []);
  const member = makeMember('Alice', team.id);
  return { teams: [team], members: [member], people };
}

function renderUploader(snapshot: RosterSnapshot = snap(), onChange = vi.fn(), onUploadResult = vi.fn(), onClear = vi.fn()) {
  return render(
    <LanguageProvider>
      <FileUploader snapshot={snapshot} onSnapshotChange={onChange} onUploadResult={onUploadResult} onClearAll={onClear} />
    </LanguageProvider>,
  );
}

describe('FileUploader', () => {
  it('renders the drop zone', () => {
    renderUploader();
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
  });

  it('shows loaded count when people are present', () => {
    const people: PersonData[] = [
      { name: 'Alice', fileName: 'Alice.csv', rows: [{ date: new Date(), dateStr: '2026-01-01', hour: 10, kind: 'Included', model: 'auto', maxMode: false, inputWithCache: 0, inputWithoutCache: 0, cacheRead: 0, outputTokens: 0, totalTokens: 0 }], note: '' },
    ];
    renderUploader(snap(people));
    expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
  });

  it('calls onClearAll when clear all is clicked', () => {
    const onClear = vi.fn();
    renderUploader(snap(), vi.fn(), vi.fn(), onClear);
    fireEvent.click(screen.getByText(/clear all|очистить/i));
    expect(onClear).toHaveBeenCalled();
  });
});
