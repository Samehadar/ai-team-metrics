import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import { sortedTeams, makeMember } from '../utils/teams';
import {
  attachFilesToMember,
  replaceMemberFile,
  type UnmatchedFile,
  type MatchedFileReport,
} from '../utils/mergeData';
import type { Team, Member, PersonData } from '../types';

interface UploadResolutionModalProps {
  unmatched: UnmatchedFile[];
  matched: MatchedFileReport[];
  teams: Team[];
  members: Member[];
  people: PersonData[];
  onApply: (next: { teams: Team[]; members: Member[]; people: PersonData[] }) => void;
  onClose: () => void;
}

type UnmatchedAction =
  | { type: 'skip' }
  | { type: 'assign'; memberId: string }
  | { type: 'create'; teamId: string; name: string };

type MatchedAction = 'merged' | 'replace';

export default function UploadResolutionModal({
  unmatched,
  matched,
  teams,
  members,
  people,
  onApply,
  onClose,
}: UploadResolutionModalProps) {
  const { t } = useT();
  const sortedT = sortedTeams(teams);
  const defaultTeamId = sortedT[0]?.id ?? '';

  const [unmatchedActions, setUnmatchedActions] = useState<UnmatchedAction[]>(() =>
    unmatched.map((f) =>
      defaultTeamId
        ? ({ type: 'create', teamId: defaultTeamId, name: f.suggestedName ?? '' } as const)
        : ({ type: 'skip' as const }),
    ),
  );
  const [matchedActions, setMatchedActions] = useState<MatchedAction[]>(() =>
    matched.map(() => 'merged'),
  );

  const setUnmatchedAction = (idx: number, a: UnmatchedAction) => {
    setUnmatchedActions((prev) => prev.map((p, i) => (i === idx ? a : p)));
  };
  const setMatchedAction = (idx: number, a: MatchedAction) => {
    setMatchedActions((prev) => prev.map((p, i) => (i === idx ? a : p)));
  };

  if (unmatched.length === 0 && matched.length === 0) {
    return null;
  }

  const apply = () => {
    let workingTeams = teams;
    let workingMembers = members;
    let workingPeople = people;

    for (let i = 0; i < unmatched.length; i++) {
      const action = unmatchedActions[i];
      const file = unmatched[i];
      if (action.type === 'skip') continue;
      let member: Member | undefined;
      if (action.type === 'assign') {
        member = workingMembers.find((m) => m.id === action.memberId);
      } else if (action.type === 'create') {
        const name = action.name.trim() || file.suggestedName || file.fileName;
        member = makeMember(name, action.teamId);
        workingMembers = [...workingMembers, member];
      }
      if (!member) continue;
      const merged = attachFilesToMember(workingPeople, workingMembers, member, [
        { name: file.fileName, text: file.text },
      ]);
      workingMembers = merged.members;
      workingPeople = merged.people;
    }

    for (let i = 0; i < matched.length; i++) {
      if (matchedActions[i] !== 'replace') continue;
      const r = matched[i];
      const result = replaceMemberFile(workingPeople, workingMembers, r.memberId, {
        name: r.fileName,
        text: r.text,
      });
      workingPeople = result.people;
      workingMembers = result.members;
    }

    onApply({ teams: workingTeams, members: workingMembers, people: workingPeople });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 110,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#15151c',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 22,
          width: 620,
          maxWidth: '100%',
          maxHeight: '85vh',
          overflowY: 'auto',
          color: '#e0e0e0',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
          {t('uploadResolve.title')}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          {t('uploadResolve.subtitle')}
        </div>

        {unmatched.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <span style={dotUnmatched} />
              {t('uploadResolve.unmatchedSection', unmatched.length)}
            </div>
            {unmatched.map((f, i) => {
              const a = unmatchedActions[i];
              return (
                <div key={`u-${i}`} style={{ ...card, borderLeft: '3px solid #e9c46a' }}>
                  <div style={cardHead}>
                    <span style={fileName}>{f.fileName}</span>
                    <span style={badgeKind}>{f.parsedAs}</span>
                    {f.suggestedName && (
                      <span style={{ fontSize: 11, color: '#888' }}>→ {f.suggestedName}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={radioRow}>
                      <input
                        type="radio"
                        checked={a.type === 'skip'}
                        onChange={() => setUnmatchedAction(i, { type: 'skip' })}
                      />
                      {t('unmatched.skip')}
                    </label>
                    {members.length > 0 && (
                      <label style={radioRow}>
                        <input
                          type="radio"
                          checked={a.type === 'assign'}
                          onChange={() =>
                            setUnmatchedAction(i, { type: 'assign', memberId: members[0].id })
                          }
                        />
                        <span>
                          {t('unmatched.assignTo')}{' '}
                          <select
                            disabled={a.type !== 'assign'}
                            value={a.type === 'assign' ? a.memberId : ''}
                            onChange={(e) =>
                              setUnmatchedAction(i, { type: 'assign', memberId: e.target.value })
                            }
                            style={selectInline}
                          >
                            {members.map((m) => {
                              const tm = teams.find((tt) => tt.id === m.teamId);
                              return (
                                <option key={m.id} value={m.id}>
                                  {tm ? `[${tm.name}] ` : ''}
                                  {m.name}
                                </option>
                              );
                            })}
                          </select>
                        </span>
                      </label>
                    )}
                    <label style={radioRow}>
                      <input
                        type="radio"
                        checked={a.type === 'create'}
                        onChange={() =>
                          setUnmatchedAction(i, {
                            type: 'create',
                            teamId: defaultTeamId,
                            name: f.suggestedName ?? '',
                          })
                        }
                      />
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {t('unmatched.createNew')}{' '}
                        <select
                          disabled={a.type !== 'create'}
                          value={a.type === 'create' ? a.teamId : ''}
                          onChange={(e) =>
                            a.type === 'create' &&
                            setUnmatchedAction(i, { ...a, teamId: e.target.value })
                          }
                          style={selectInline}
                        >
                          {sortedT.map((tm) => (
                            <option key={tm.id} value={tm.id}>
                              {tm.name}
                            </option>
                          ))}
                        </select>
                        <input
                          disabled={a.type !== 'create'}
                          value={a.type === 'create' ? a.name : ''}
                          onChange={(e) =>
                            a.type === 'create' && setUnmatchedAction(i, { ...a, name: e.target.value })
                          }
                          placeholder={t('unmatched.createNewName')}
                          style={inputInline}
                        />
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {matched.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={sectionHeader}>
              <span style={dotMatched} />
              {t('uploadResolve.matchedSection', matched.length)}
            </div>
            {matched.map((r, i) => {
              const allDup = r.duplicates === r.total && r.total > 0;
              const partial = r.duplicates > 0 && r.duplicates < r.total;
              const accent = allDup ? '#e9c46a' : partial ? '#9bb6cf' : '#2a9d8f';
              return (
                <div key={`m-${i}`} style={{ ...card, borderLeft: `3px solid ${accent}` }}>
                  <div style={cardHead}>
                    <span style={fileName}>{r.fileName}</span>
                    <span style={badgeKind}>{r.parsedAs}</span>
                    <span style={{ fontSize: 11, color: '#888' }}>→ {r.memberName}</span>
                  </div>
                  <div style={{ fontSize: 12, color: accent, marginBottom: 8 }}>
                    {partial && t('uploadResult.partial', r.added, r.duplicates, r.total)}
                    {allDup && t('uploadResult.allDup', r.total)}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <label style={{ ...radioRow, opacity: matchedActions[i] === 'merged' ? 1 : 0.7 }}>
                      <input
                        type="radio"
                        checked={matchedActions[i] === 'merged'}
                        onChange={() => setMatchedAction(i, 'merged')}
                      />
                      {allDup ? t('uploadResult.skip') : t('uploadResult.keepMerged')}
                    </label>
                    <label style={{ ...radioRow, opacity: matchedActions[i] === 'replace' ? 1 : 0.7 }}>
                      <input
                        type="radio"
                        checked={matchedActions[i] === 'replace'}
                        onChange={() => setMatchedAction(i, 'replace')}
                      />
                      {t('uploadResult.replace')}
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={btnGhost}>
            {t('uploadResult.close')}
          </button>
          <button onClick={apply} style={btnPrimary}>
            {t('uploadResolve.apply')}
          </button>
        </div>
      </div>
    </div>
  );
}

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: '#999',
  fontWeight: 600,
  marginBottom: 8,
};
const dotUnmatched: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: '#e9c46a' };
const dotMatched: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: '#9bb6cf' };

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 10,
  padding: 12,
  marginBottom: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const cardHead: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' };
const fileName: React.CSSProperties = {
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  color: '#ccc',
};
const badgeKind: React.CSSProperties = { fontSize: 10, color: '#666', textTransform: 'uppercase' };

const btnPrimary: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.5)',
  background: 'rgba(230,57,70,0.18)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnGhost: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#aaa',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const inputInline: React.CSSProperties = {
  padding: '3px 8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 11,
  outline: 'none',
  fontFamily: 'inherit',
};
const selectInline: React.CSSProperties = {
  padding: '3px 6px',
  background: '#1a1a24',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 11,
  outline: 'none',
  fontFamily: 'inherit',
};
const radioRow: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: '#ccc',
  cursor: 'pointer',
  padding: '4px 8px',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
};
