import { useState, type DragEvent } from 'react';
import { useT } from '../i18n/LanguageContext';
import { downloadRosterTemplate } from '../utils/rosterCsv';

interface OnboardingEmptyProps {
  onCreateTeam: () => void;
  onAddMember: () => void;
  onImportRoster: () => void;
  onUploadFiles: (files: FileList) => void;
}

export default function OnboardingEmpty({ onCreateTeam, onAddMember, onImportRoster, onUploadFiles }: OnboardingEmptyProps) {
  const { t } = useT();

  const handleTemplate = () => {
    const csv = downloadRosterTemplate();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roster-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: '28px 24px',
        marginBottom: 20,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
        {t('onboarding.title')}
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 22 }}>
        {t('onboarding.subtitle')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <Step
          title={t('onboarding.step1Title')}
          desc={t('onboarding.step1Desc')}
          actions={[{ label: t('onboarding.step1Action'), onClick: onCreateTeam, primary: true }]}
        />
        <Step
          title={t('onboarding.step2Title')}
          desc={t('onboarding.step2Desc')}
          actions={[
            { label: t('onboarding.step2ActionAdd'), onClick: onAddMember },
            { label: t('onboarding.step2ActionImport'), onClick: onImportRoster },
            { label: t('onboarding.step2Template'), onClick: handleTemplate, link: true },
          ]}
        />
        <UploadStep
          title={t('onboarding.step3Title')}
          desc={t('onboarding.step3Desc')}
          dropLabel={t('onboarding.step3Drop')}
          onUploadFiles={onUploadFiles}
        />
      </div>
    </div>
  );
}

interface StepProps {
  title: string;
  desc: string;
  actions: { label: string; onClick: () => void; primary?: boolean; link?: boolean }[];
}

function Step({ title, desc, actions }: StepProps) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '16px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, flex: 1 }}>{desc}</div>
      {actions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={a.onClick}
              style={
                a.primary
                  ? btnPrimary
                  : a.link
                  ? btnLink
                  : btnGhost
              }
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface UploadStepProps {
  title: string;
  desc: string;
  dropLabel: string;
  onUploadFiles: (files: FileList) => void;
}

function UploadStep({ title, desc, dropLabel, onUploadFiles }: UploadStepProps) {
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.csv,.json';
    input.onchange = () => {
      if (input.files && input.files.length) onUploadFiles(input.files);
    };
    input.click();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    if (e.dataTransfer.files.length) onUploadFiles(e.dataTransfer.files);
  };
  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      style={{
        background: dragging ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.02)',
        border: dragging ? '1.5px dashed #e63946' : '1.5px dashed rgba(255,255,255,0.12)',
        borderRadius: 12,
        padding: '16px 16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        transition: 'all 0.15s',
        outline: 'none',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: '#e0e0e0' }}>{title}</div>
      <div style={{ fontSize: 12, color: '#888', lineHeight: 1.4, flex: 1 }}>{desc}</div>
      <div
        style={{
          marginTop: 4,
          padding: '10px 12px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: dragging ? '#fff' : '#bbb',
          fontSize: 12,
          fontWeight: 500,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {dropLabel}
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '7px 12px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.55)',
  background: 'rgba(230,57,70,0.2)',
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
  color: '#bbb',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnLink: React.CSSProperties = {
  padding: 0,
  border: 'none',
  background: 'transparent',
  color: '#7ab',
  fontSize: 11,
  cursor: 'pointer',
  textAlign: 'left',
  textDecoration: 'underline',
  fontFamily: 'inherit',
};
