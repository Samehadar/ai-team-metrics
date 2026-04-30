import { useEffect, useState } from 'react';
import type { UndoEntry } from '../utils/undoStack';
import { useT } from '../i18n/LanguageContext';

interface UndoToastProps {
  entry: UndoEntry | null;
  onUndo: (id: string) => void;
  onDismiss: (id: string) => void;
}

export default function UndoToast({ entry, onUndo, onDismiss }: UndoToastProps) {
  const { t } = useT();
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!entry) return;
    const start = Date.now();
    const total = entry.expiresAt - start;
    if (total <= 0) {
      onDismiss(entry.id);
      return;
    }
    const tick = () => {
      const left = Math.max(0, entry.expiresAt - Date.now());
      setProgress(left / total);
      if (left <= 0) {
        onDismiss(entry.id);
      }
    };
    const handle = window.setInterval(tick, 80);
    return () => window.clearInterval(handle);
  }, [entry, onDismiss]);

  if (!entry) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        bottom: 24,
        zIndex: 200,
        background: 'rgba(20,20,28,0.96)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 12,
        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
        minWidth: 280,
        overflow: 'hidden',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <span style={{ fontSize: 13, color: '#e0e0e0', flex: 1 }}>{entry.label}</span>
        <button
          onClick={() => onUndo(entry.id)}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(230,57,70,0.5)',
            background: 'rgba(230,57,70,0.15)',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t('undo.button')}
        </button>
        <button
          onClick={() => onDismiss(entry.id)}
          aria-label="dismiss"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          height: 2,
          background: 'rgba(230,57,70,0.7)',
          width: `${Math.round(progress * 100)}%`,
          transition: 'width 80ms linear',
        }}
      />
    </div>
  );
}
