import { useCallback, useState, type DragEvent } from 'react';
import { useT } from '../i18n/LanguageContext';
import { mergeFilesIntoPeople } from '../utils/mergeData';
import type { PersonData } from '../types';

interface FileUploaderProps {
  people: PersonData[];
  onDataChange: (people: PersonData[]) => void;
}

export default function FileUploader({ people, onDataChange }: FileUploaderProps) {
  const { t } = useT();
  const [dragging, setDragging] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');

  const handleFiles = useCallback(
    async (files: FileList) => {
      const readFile = (file: File): Promise<{ file: File; text: string }> =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ file, text: e.target?.result as string });
          reader.readAsText(file);
        });

      const validFiles = Array.from(files).filter(
        (f) => f.name.endsWith('.csv') || f.name.endsWith('.json'),
      );
      if (!validFiles.length) return;

      const results = await Promise.all(validFiles.map(readFile));
      const fileInputs = results.map(({ file, text }) => ({ name: file.name, text }));
      onDataChange(mergeFilesIntoPeople(people, fileInputs));
    },
    [people, onDataChange],
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

  const removePerson = (name: string) => {
    onDataChange(people.filter((p) => p.name !== name));
  };

  const removeCsv = (name: string) => {
    onDataChange(
      people
        .map((p) => (p.name === name ? { ...p, rows: [] } : p))
        .filter((p) => p.rows.length > 0 || (p.dailyApiMetrics?.length ?? 0) > 0),
    );
  };

  const removeJson = (name: string) => {
    onDataChange(
      people
        .map((p) => (p.name === name ? { ...p, dailyApiMetrics: undefined } : p))
        .filter((p) => p.rows.length > 0 || (p.dailyApiMetrics?.length ?? 0) > 0),
    );
  };

  const clearAll = () => onDataChange([]);

  const startEditNote = (name: string) => {
    const person = people.find((p) => p.name === name);
    setEditingNote(name);
    setNoteText(person?.note || '');
  };

  const saveNote = () => {
    if (!editingNote) return;
    onDataChange(
      people.map((p) => (p.name === editingNote ? { ...p, note: noteText } : p)),
    );
    setEditingNote(null);
    setNoteText('');
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={`
          relative rounded-2xl border-2 border-dashed p-10 text-center transition-all cursor-pointer
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
      >
        <div className="flex flex-col items-center gap-2">
          <svg className="w-10 h-10 text-[--color-text-dim]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm text-[--color-text-dim]">
            {t('uploader.dragDrop')} <span className="text-white underline">{t('uploader.browse')}</span>
          </p>
          <p className="text-xs text-[--color-text-dim]/60">
            {t('uploader.hint')}
          </p>
        </div>
      </div>

      {people.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[--color-text-dim] uppercase tracking-wider">
              {t('uploader.loaded')} ({people.length})
            </span>
            <button
              onClick={clearAll}
              className="text-xs text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              {t('uploader.clearAll')}
            </button>
          </div>
          {people.map((p) => (
            <div
              key={p.name}
              className="flex items-center gap-3 rounded-xl border border-[--color-border] bg-[--color-card] px-4 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white truncate">
                    {p.name}
                  </span>
                  {p.rows.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 pl-2 pr-1 py-0.5 text-[11px] font-mono text-emerald-400">
                      CSV · {p.rows.length} req
                      <button
                        onClick={(e) => { e.stopPropagation(); removeCsv(p.name); }}
                        className="hover:text-white transition-colors cursor-pointer rounded-full hover:bg-emerald-500/20 w-4 h-4 flex items-center justify-center"
                        title={t('uploader.removeCsv')}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {(p.dailyApiMetrics?.length ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 pl-2 pr-1 py-0.5 text-[11px] font-mono text-blue-400">
                      JSON · {p.dailyApiMetrics!.length}d api
                      <button
                        onClick={(e) => { e.stopPropagation(); removeJson(p.name); }}
                        className="hover:text-white transition-colors cursor-pointer rounded-full hover:bg-blue-500/20 w-4 h-4 flex items-center justify-center"
                        title={t('uploader.removeJson')}
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
                {p.note && (
                  <span className="text-xs text-amber-400/70 italic">{p.note}</span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {editingNote === p.name ? (
                  <div className="flex items-center gap-1">
                    <input
                      className="text-xs bg-transparent border border-[--color-border] rounded px-2 py-1 text-white w-40 outline-none focus:border-[--color-border-hover]"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && saveNote()}
                      placeholder={t('uploader.notePlaceholder')}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={saveNote}
                      className="text-xs text-green-400 hover:text-green-300 cursor-pointer"
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEditNote(p.name)}
                    className="text-xs text-[--color-text-dim] hover:text-white transition-colors cursor-pointer"
                    title={t('uploader.addNote')}
                  >
                    {t('uploader.noteBtn')}
                  </button>
                )}
                <button
                  onClick={() => removePerson(p.name)}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors ml-2 cursor-pointer"
                  title={t('uploader.removeDeveloper')}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
