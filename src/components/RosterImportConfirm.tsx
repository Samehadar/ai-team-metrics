import { useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import {
  applyRosterMerge,
  applyRosterReplace,
  previewRosterImport,
  type RosterCsvRow,
} from '../utils/rosterCsv';
import type { RosterSnapshot } from '../types';

interface RosterImportConfirmProps {
  current: RosterSnapshot;
  parsed: RosterCsvRow[];
  warnings: string[];
  onApply: (next: RosterSnapshot, label: string) => void;
  onCancel: () => void;
}

export default function RosterImportConfirm({ current, parsed, warnings, onApply, onCancel }: RosterImportConfirmProps) {
  const { t } = useT();
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const preview = previewRosterImport(current, parsed);

  const apply = () => {
    if (mode === 'merge') {
      onApply(applyRosterMerge(current, parsed), t('undo.importRoster'));
    } else {
      onApply(applyRosterReplace(current, parsed), t('undo.importRoster'));
    }
  };

  return (
    <div
      onClick={onCancel}
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
          width: 480,
          maxWidth: '100%',
          color: '#e0e0e0',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{t('roster.confirmTitle')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#aaa', marginBottom: 16 }}>
          <div>{t('roster.previewTeams', preview.totalTeams)}</div>
          <div>{t('roster.previewMembers', preview.totalMembers)}</div>
          <div>{t('roster.previewMatchTeams', preview.matchingTeams)}</div>
          <div>{t('roster.previewMatchMembers', preview.matchingMembers)}</div>
          <div>{t('roster.previewNewTeams', preview.newTeams)}</div>
          <div>{t('roster.previewNewMembers', preview.newMembers)}</div>
        </div>

        {warnings.length > 0 && (
          <div style={{ background: 'rgba(233,196,106,0.07)', border: '1px solid rgba(233,196,106,0.2)', borderRadius: 8, padding: 10, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#e9c46a', fontWeight: 600, marginBottom: 4 }}>{t('roster.warningsTitle')}</div>
            {warnings.slice(0, 5).map((w, i) => (
              <div key={i} style={{ fontSize: 11, color: '#ccc' }}>{w}</div>
            ))}
          </div>
        )}

        <label style={radioRow}>
          <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} />
          <span>
            <div style={{ fontWeight: 600 }}>{t('roster.merge')}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{t('roster.mergeDesc')}</div>
          </span>
        </label>
        <label style={{ ...radioRow, marginTop: 10 }}>
          <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} />
          <span>
            <div style={{ fontWeight: 600 }}>{t('roster.replace')}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{t('roster.replaceDesc')}</div>
          </span>
        </label>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btnGhost}>{t('team.cancel')}</button>
          <button onClick={apply} style={btnPrimary}>
            {mode === 'merge' ? t('roster.applyMerge') : t('roster.applyReplace')}
          </button>
        </div>
      </div>
    </div>
  );
}

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

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  fontSize: 13,
  color: '#ccc',
  cursor: 'pointer',
  padding: 8,
  borderRadius: 8,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.05)',
};
