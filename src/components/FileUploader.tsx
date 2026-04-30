import { useCallback, useState, useRef, type DragEvent } from 'react';
import { useT } from '../i18n/LanguageContext';
import { mergeFilesIntoPeople, type FileInput, type UnmatchedFile, type MatchedFileReport } from '../utils/mergeData';
import { exportSnapshot, importSnapshot } from '../utils/storage';
import type { RosterSnapshot } from '../types';

interface FileUploaderProps {
  snapshot: RosterSnapshot;
  onSnapshotChange: (next: RosterSnapshot, opts?: { undoLabel?: string }) => void;
  onUploadResult: (info: { unmatched: UnmatchedFile[]; matched: MatchedFileReport[] }) => void;
  onClearAll: () => void;
}

export default function FileUploader({ snapshot, onSnapshotChange, onUploadResult, onClearAll }: FileUploaderProps) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList) => {
      const valid = Array.from(files).filter(
        (f) => f.name.endsWith('.csv') || f.name.endsWith('.json'),
      );
      if (!valid.length) return;
      const inputs: FileInput[] = await Promise.all(
        valid.map(
          (file) =>
            new Promise<FileInput>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve({ name: file.name, text: e.target?.result as string });
              reader.readAsText(file);
            }),
        ),
      );
      const result = mergeFilesIntoPeople(snapshot.people, snapshot.members, inputs);
      setWarnings(result.warnings);
      onSnapshotChange({ teams: snapshot.teams, members: result.members, people: result.people });
      onUploadResult({
        unmatched: result.unmatched,
        matched: result.matched.filter((r) => r.duplicates > 0),
      });
    },
    [snapshot, onSnapshotChange, onUploadResult],
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleExport = useCallback(() => {
    const json = exportSnapshot(snapshot);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-team-metrics-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshot]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const imported = importSnapshot(ev.target?.result as string);
          onSnapshotChange(imported);
        } catch {
          setWarnings([t('uploader.importError')]);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onSnapshotChange, t],
  );

  const peopleCount = snapshot.people.length;

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={`
          relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer outline-none
          focus-visible:ring-2 focus-visible:ring-[#e63946]/50
          ${dragging
            ? 'border-[#e63946] bg-[#e63946]/5'
            : 'border-[--color-border] hover:border-[--color-border-hover] bg-[--color-card]'
          }
        `}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.multiple = true;
          input.accept = '.csv,.json';
          input.onchange = () => {
            if (input.files) handleFiles(input.files);
          };
          input.click();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.currentTarget as HTMLElement).click();
          }
        }}
      >
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-[--color-text-dim]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-[--color-text-dim]">
            {t('uploader.dragDrop')} <span className="text-white underline">{t('uploader.browse')}</span>
          </p>
          <p className="text-xs text-[--color-text-dim]/60">{t('uploader.hint')}</p>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
              {t('uploader.warnings')}
            </span>
            <button onClick={() => setWarnings([])} className="text-xs text-amber-400/60 hover:text-amber-400 cursor-pointer">✕</button>
          </div>
          {warnings.map((w, i) => (
            <div key={i} className="text-xs text-amber-400/80">{w}</div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-[--color-text-dim]">
        <span>{t('uploader.loaded')} ({peopleCount})</span>
        <div className="flex items-center gap-3">
          <button onClick={handleExport} className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
            {t('uploader.exportBackup')}
          </button>
          <button onClick={() => importInputRef.current?.click()} className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
            {t('uploader.importBackup')}
          </button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleImport}
          />
          <button onClick={onClearAll} className="text-red-400 hover:text-red-300 transition-colors cursor-pointer">
            {t('uploader.clearAll')}
          </button>
        </div>
      </div>
    </div>
  );
}
