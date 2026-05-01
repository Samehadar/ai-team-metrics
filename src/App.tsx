import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import FileUploader from './components/FileUploader';
import DateRangeSelector from './components/DateRangeSelector';
import Overview from './components/Overview';
import Adoption from './components/Adoption';
import CodeImpact from './components/CodeImpact';
import Timeline from './components/Timeline';
import Models from './components/Models';
import PersonDetail from './components/PersonDetail';
import ReportExporter from './components/ReportExporter';
import TeamManager from './components/TeamManager';
import TeamFilterBar from './components/TeamFilterBar';
import UploadResolutionModal from './components/UploadResolutionModal';
import RosterImportConfirm from './components/RosterImportConfirm';
import OnboardingEmpty from './components/OnboardingEmpty';
import UndoToast from './components/UndoToast';
import ByTeam from './components/ByTeam';
import Guide from './components/Guide';
import { saveSnapshot, loadSnapshot, clearData } from './utils/storage';
import { formatTokens } from './utils/formatters';
import { getGlobalSummary } from './utils/dataAggregator';
import { useT } from './i18n/LanguageContext';
import { DATE_LOCALE } from './i18n/translations';
import { sortedTeams, makeTeam, ensureUnassignedTeam, UNASSIGNED_TEAM_ID } from './utils/teams';
import { parseRosterCsv, type RosterCsvRow } from './utils/rosterCsv';
import { pushUndo, dropUndo, type UndoEntry } from './utils/undoStack';
import type { PersonData, RosterSnapshot, TabId, Team, Member } from './types';
import { mergeFilesIntoPeople, type FileInput, type UnmatchedFile, type MatchedFileReport } from './utils/mergeData';

const TAB_IDS: TabId[] = ['overview', 'adoption', 'codeImpact', 'timeline', 'models', 'person', 'byTeam'];

function getDateBounds(people: PersonData[]): { earliest: Date; latest: Date } {
  let earliest = Infinity;
  let latest = -Infinity;
  for (const p of people) {
    for (const r of p.rows) {
      const t = r.date.getTime();
      if (t < earliest) earliest = t;
      if (t > latest) latest = t;
    }
    for (const m of p.dailyApiMetrics ?? []) {
      const t = new Date(m.dateStr + 'T00:00:00Z').getTime();
      if (t < earliest) earliest = t;
      const end = t + 86400000 - 1;
      if (end > latest) latest = end;
    }
  }
  return {
    earliest: earliest === Infinity ? new Date() : new Date(earliest),
    latest: latest === -Infinity ? new Date() : new Date(latest),
  };
}

export default function App() {
  const { t, locale, setLocale } = useT();
  const [snapshot, setSnapshot] = useState<RosterSnapshot>(() => ({
    teams: ensureUnassignedTeam([]).teams,
    members: [],
    people: [],
  }));
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showUploader, setShowUploader] = useState(true);
  const [currentView, setCurrentView] = useState<'dashboard' | 'teams' | 'guide'>('dashboard');
  const [rangeStart, setRangeStart] = useState<Date>(new Date(0));
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date());
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[] | null>(null);
  const [rosterImport, setRosterImport] = useState<{ rows: RosterCsvRow[]; warnings: string[] } | null>(null);
  const [uploadResolution, setUploadResolution] = useState<{
    unmatched: UnmatchedFile[];
    matched: MatchedFileReport[];
  } | null>(null);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const rosterImportInputRef = useRef<HTMLInputElement>(null);

  const { teams, members, people } = snapshot;
  const hasData = people.length > 0 || members.length > 0;

  const updateSnapshot = useCallback(
    (next: RosterSnapshot, opts: { undoLabel?: string } = {}) => {
      if (opts.undoLabel) {
        setUndoStack((s) => pushUndo(s, { label: opts.undoLabel!, snapshot }));
      }
      setSnapshot(next);
      saveSnapshot(next);
    },
    [snapshot],
  );

  const onTeamManagerChange = useCallback(
    (next: { teams: Team[]; members: Member[]; people: PersonData[] }, undo?: { label: string }) => {
      const ns: RosterSnapshot = next;
      updateSnapshot(ns, undo ? { undoLabel: undo.label } : {});
    },
    [updateSnapshot],
  );

  const TABS: { id: TabId; label: string }[] = useMemo(() => {
    const arr: { id: TabId; label: string }[] = [
      { id: 'overview', label: t('tab.overview') },
      { id: 'adoption', label: t('tab.adoption') },
      { id: 'codeImpact', label: t('tab.codeImpact') },
      { id: 'timeline', label: t('tab.timeline') },
      { id: 'models', label: t('tab.models') },
      { id: 'person', label: t('tab.person') },
    ];
    if (teams.filter((tm) => tm.id !== UNASSIGNED_TEAM_ID).length > 1) {
      arr.push({ id: 'byTeam', label: t('tab.byTeam') });
    }
    return arr;
  }, [t, teams]);

  const visibleTabIds = useMemo(() => TABS.map((t) => t.id), [TABS]);

  const { earliest, latest } = useMemo(() => getDateBounds(people), [people]);

  useEffect(() => {
    setRangeStart(earliest);
    setRangeEnd(latest);
  }, [earliest, latest]);

  useEffect(() => {
    const saved = loadSnapshot();
    setSnapshot(saved);
    if (saved.people.length > 0 || saved.members.length > 0) {
      setShowUploader(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const numKey = parseInt(e.key, 10);
      if (numKey >= 1 && numKey <= visibleTabIds.length && hasData) {
        const id = visibleTabIds[numKey - 1];
        if (id) setActiveTab(id);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setShowUploader((v) => !v);
        return;
      }
      if (e.key === 'l' || e.key === 'L') {
        setLocale(locale === 'en' ? 'ru' : 'en');
        return;
      }
      if (e.key === 't' || e.key === 'T') {
        setCurrentView((v) => (v === 'teams' ? 'dashboard' : 'teams'));
        return;
      }
      if (e.key === 'h' || e.key === 'H') {
        setCurrentView((v) => (v === 'guide' ? 'dashboard' : 'guide'));
        return;
      }
      if (e.key === '?') {
        setShowShortcuts((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasData, locale, setLocale, visibleTabIds]);

  const handleRangeChange = useCallback((start: Date, end: Date) => {
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const filteredPeople = useMemo(() => {
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    const startStr = rangeStart.toISOString().split('T')[0];
    const endStr = rangeEnd.toISOString().split('T')[0];
    let teamFilter: Set<string> | null = null;
    if (selectedTeamIds && selectedTeamIds.length > 0) {
      const teamSet = new Set(selectedTeamIds);
      teamFilter = new Set(members.filter((m) => teamSet.has(m.teamId)).map((m) => m.id));
    }
    return people
      .filter((p) => (teamFilter ? p.memberId !== undefined && teamFilter.has(p.memberId) : true))
      .map((p) => ({
        ...p,
        rows: p.rows.filter((r) => {
          const t = r.date.getTime();
          return t >= startMs && t <= endMs;
        }),
        dailyApiMetrics: p.dailyApiMetrics?.filter(
          (m) => m.dateStr >= startStr && m.dateStr <= endStr,
        ),
      }))
      .filter((p) => p.rows.length > 0 || (p.dailyApiMetrics?.length ?? 0) > 0);
  }, [people, members, selectedTeamIds, rangeStart, rangeEnd]);

  const filteredMembers = useMemo(() => {
    if (!selectedTeamIds || selectedTeamIds.length === 0) return members;
    const teamSet = new Set(selectedTeamIds);
    return members.filter((m) => teamSet.has(m.teamId));
  }, [members, selectedTeamIds]);

  const activeTeams = useMemo(
    () =>
      selectedTeamIds && selectedTeamIds.length > 0
        ? teams.filter((tm) => selectedTeamIds.includes(tm.id))
        : [],
    [teams, selectedTeamIds],
  );

  const visibleMemberCount = filteredMembers.length;

  const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

  const subtitle = useMemo(() => {
    if (!filteredPeople.length) return '';
    const global = getGlobalSummary(filteredPeople);
    const dl = DATE_LOCALE[locale];
    const formatD = (d: Date) => {
      const msk = new Date(d.getTime() + MSK_OFFSET_MS);
      return msk.toLocaleDateString(dl, { day: 'numeric', month: 'short' });
    };
    const startD = formatD(rangeStart);
    const endD = formatD(rangeEnd);
    return `${t('app.usage')} · ${startD} — ${endD} · ${global.totalRequests.toLocaleString()} ${t('common.requests')} · ${formatTokens(global.totalTokens)} ${t('common.tokens')}`;
  }, [filteredPeople, rangeStart, rangeEnd, t, locale, MSK_OFFSET_MS]);

  const handleClearAll = useCallback(() => {
    if (!window.confirm(t('uploader.clearAll') + '?')) return;
    const ensured = ensureUnassignedTeam([]);
    const next: RosterSnapshot = { teams: ensured.teams, members: [], people: [] };
    updateSnapshot(next, { undoLabel: t('undo.clearAll') });
    clearData();
  }, [t, updateSnapshot]);

  const handleAddTeamFromOnboarding = () => {
    const team = makeTeam(t('team.namePlaceholder'), teams);
    updateSnapshot({ ...snapshot, teams: [...teams, team] });
    setCurrentView('teams');
  };

  const handleOnboardingUploadFiles = useCallback(
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
              reader.onload = (ev) => resolve({ name: file.name, text: ev.target?.result as string });
              reader.readAsText(file);
            }),
        ),
      );
      const result = mergeFilesIntoPeople(people, members, inputs);
      updateSnapshot({ teams, members: result.members, people: result.people });
      const dupReports = result.matched.filter((r) => r.duplicates > 0);
      if (result.unmatched.length > 0 || dupReports.length > 0) {
        setUploadResolution({ unmatched: result.unmatched, matched: dupReports });
      }
    },
    [people, members, teams, updateSnapshot],
  );

  const handleImportRoster = () => {
    rosterImportInputRef.current?.click();
  };

  const handleRosterFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseRosterCsv(text);
      if (parsed.rows.length === 0) {
        alert(parsed.warnings[0] ?? 'Empty roster');
        return;
      }
      setRosterImport({ rows: parsed.rows, warnings: parsed.warnings });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const applyRoster = (next: RosterSnapshot, label: string) => {
    updateSnapshot(next, { undoLabel: label });
    setRosterImport(null);
    setCurrentView('teams');
  };

  const handleResolutionApply = (next: { teams: Team[]; members: Member[]; people: PersonData[] }) => {
    updateSnapshot(next, { undoLabel: t('undo.uploadResolved') });
    setUploadResolution(null);
  };

  const handleUndo = (id: string) => {
    const entry = undoStack.find((e) => e.id === id);
    if (!entry) return;
    setSnapshot(entry.snapshot);
    saveSnapshot(entry.snapshot);
    setUndoStack((s) => dropUndo(s, id));
  };

  const handleDismissUndo = (id: string) => {
    setUndoStack((s) => dropUndo(s, id));
  };

  const sortedT = useMemo(() => sortedTeams(teams), [teams]);
  const teamsForFilter = useMemo(() => sortedT.filter((tm) => tm.id !== UNASSIGNED_TEAM_ID || members.some((m) => m.teamId === tm.id)), [sortedT, members]);

  const isOnboarding = teams.filter((tm) => tm.id !== UNASSIGNED_TEAM_ID).length === 0 && members.length === 0 && people.length === 0;

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif", background: '#0a0a0f', color: '#e0e0e0', minHeight: '100vh', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #e63946, #457b9d)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18,
            }}>⚡</div>
            <h1 style={{
              fontSize: 28, fontWeight: 700, margin: 0,
              background: 'linear-gradient(90deg, #fff, #888)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>{t('app.title')}</h1>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              {currentView === 'dashboard' && hasData && (
                <>
                  <ReportExporter people={filteredPeople} rangeStart={rangeStart} rangeEnd={rangeEnd} teams={teams} members={members} />
                  <button onClick={() => setCurrentView('teams')} style={topBtn}>
                    {t('team.manager')}
                  </button>
                  <button onClick={() => setShowUploader((v) => !v)} style={topBtn}>
                    {showUploader ? t('app.hideUpload') : t('app.uploadData')}
                  </button>
                </>
              )}
              {currentView === 'dashboard' && (
                <button onClick={() => setCurrentView('guide')} style={topBtn} title={t('guide.title')}>
                  ? {t('guide.menu')}
                </button>
              )}
              {(currentView === 'teams' || currentView === 'guide') && (
                <button onClick={() => setCurrentView('dashboard')} style={{ ...topBtn, color: '#fff', borderColor: 'rgba(230,57,70,0.5)' }}>
                  ← {t('team.backToDashboard')}
                </button>
              )}
              <LangToggle locale={locale} setLocale={setLocale} />
              <ShortcutsHint show={showShortcuts} onToggle={() => setShowShortcuts((v) => !v)} t={t} />
            </div>
          </div>
          {currentView === 'dashboard' && hasData && filteredPeople.length > 0 && (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{subtitle}</p>
          )}
          {currentView === 'teams' && (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{t('team.managerSubtitle')}</p>
          )}
          {currentView === 'guide' && (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{t('guide.subtitle')}</p>
          )}
        </div>

        <input
          ref={rosterImportInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleRosterFile}
        />

        {currentView === 'teams' && (
          <TeamManager
            teams={teams}
            members={members}
            people={people}
            onChange={onTeamManagerChange}
            onImportRosterClick={handleImportRoster}
            onMatchedReports={(reports) =>
              setUploadResolution({ unmatched: [], matched: reports })
            }
          />
        )}

        {currentView === 'guide' && (
          <Guide
            onStart={() => {
              setCurrentView('dashboard');
              setShowUploader(true);
            }}
            onTeams={() => setCurrentView('teams')}
          />
        )}

        {currentView === 'dashboard' && isOnboarding && (
          <OnboardingEmpty
            onCreateTeam={handleAddTeamFromOnboarding}
            onAddMember={handleAddTeamFromOnboarding}
            onImportRoster={handleImportRoster}
            onUploadFiles={handleOnboardingUploadFiles}
          />
        )}

        {currentView === 'dashboard' && !isOnboarding && (showUploader || (!hasData && people.length === 0 && members.length > 0)) && (
          <div style={{ marginBottom: 28 }}>
            <FileUploader
              snapshot={snapshot}
              onSnapshotChange={(next, opts) => updateSnapshot(next, opts ?? {})}
              onUploadResult={({ unmatched, matched }) => {
                if (unmatched.length > 0 || matched.length > 0) {
                  setUploadResolution({ unmatched, matched });
                }
              }}
              onClearAll={handleClearAll}
            />
          </div>
        )}

        {currentView === 'dashboard' && !isOnboarding && (
          <>
            <DateRangeSelector
              earliestDate={earliest}
              latestDate={latest}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onChange={handleRangeChange}
            />

            <div style={{
              display: 'flex', gap: 4, marginBottom: 16,
              background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4,
              border: '1px solid rgba(255,255,255,0.06)',
              width: 'fit-content',
            }}>
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.2s',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: activeTab === tab.id ? '#fff' : '#666',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {teamsForFilter.length >= 1 && (
              <TeamFilterBar
                teams={teamsForFilter}
                selectedTeamIds={selectedTeamIds}
                onChange={setSelectedTeamIds}
              />
            )}

            {activeTeams.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 10,
                  padding: '8px 14px',
                  marginBottom: 14,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#ddd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {activeTeams.map((tm) => (
                    <span
                      key={tm.id}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: '50%',
                        background: tm.color,
                      }}
                    />
                  ))}
                </div>
                <span>
                  {t(
                    activeTeams.length === 1
                      ? 'team.filterScopeBannerSingle'
                      : 'team.filterScopeBannerMulti',
                    activeTeams.length === 1
                      ? activeTeams[0].name
                      : activeTeams.map((tm) => tm.name).join(', '),
                    visibleMemberCount,
                  )}
                </span>
                <button
                  onClick={() => setSelectedTeamIds(null)}
                  style={{
                    marginLeft: 'auto',
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'transparent',
                    color: '#bbb',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('team.filterAll')}
                </button>
              </div>
            )}

            {filteredPeople.length > 0 ? (
              <>
                {activeTab === 'overview' && <Overview people={filteredPeople} teams={teams} members={members} />}
                {activeTab === 'adoption' && (
                  <Adoption
                    people={filteredPeople}
                    totalTeamSize={Math.max(visibleMemberCount, filteredPeople.length)}
                    teams={teams}
                    members={members}
                  />
                )}
                {activeTab === 'codeImpact' && <CodeImpact people={filteredPeople} teams={teams} members={members} />}
                {activeTab === 'timeline' && <Timeline people={filteredPeople} />}
                {activeTab === 'models' && <Models people={filteredPeople} teams={teams} members={members} />}
                {activeTab === 'person' && (
                  <PersonDetail
                    people={filteredPeople}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    teams={teams}
                    members={members}
                  />
                )}
                {activeTab === 'byTeam' && (
                  <ByTeam teams={teams} members={members} people={filteredPeople} />
                )}
              </>
            ) : hasData ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: 14 }}>
                {t('app.noDataPeriod')}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: 14 }}>
                {t('app.uploadPrompt')}
              </div>
            )}
          </>
        )}
      </div>

      {uploadResolution && (
        <UploadResolutionModal
          unmatched={uploadResolution.unmatched}
          matched={uploadResolution.matched}
          teams={teams}
          members={members}
          people={people}
          onApply={handleResolutionApply}
          onClose={() => setUploadResolution(null)}
        />
      )}

      {rosterImport && (
        <RosterImportConfirm
          current={snapshot}
          parsed={rosterImport.rows}
          warnings={rosterImport.warnings}
          onApply={applyRoster}
          onCancel={() => setRosterImport(null)}
        />
      )}

      <UndoToast
        entry={undoStack[0] ?? null}
        onUndo={handleUndo}
        onDismiss={handleDismissUndo}
      />
    </div>
  );
}

const topBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#888',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

function LangToggle({ locale, setLocale }: { locale: string; setLocale: (l: 'en' | 'ru') => void }) {
  const btn = (l: 'en' | 'ru', label: string) => (
    <button
      onClick={() => setLocale(l)}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: 600,
        border: 'none',
        cursor: 'pointer',
        background: locale === l ? 'rgba(230,57,70,0.7)' : 'rgba(255,255,255,0.04)',
        color: locale === l ? '#fff' : '#888',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      {btn('en', 'EN')}
      {btn('ru', 'RU')}
    </div>
  );
}

function ShortcutsHint({ show, onToggle, t }: { show: boolean; onToggle: () => void; t: (key: string) => string }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onToggle}
        aria-label={t('shortcuts.title')}
        style={{
          width: 28, height: 28, borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
          color: '#666', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        ?
      </button>
      {show && (
        <div style={{
          position: 'absolute', right: 0, top: 36, zIndex: 50,
          background: '#1a1a24', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '12px 16px', minWidth: 240,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('shortcuts.title')}
          </div>
          {[
            ['1-7', t('shortcuts.tabs')],
            ['/', t('shortcuts.upload')],
            ['T', t('shortcuts.teamsPage')],
            ['L', t('shortcuts.lang')],
            ['?', t('shortcuts.help')],
          ].map(([key, desc]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '3px 0', fontSize: 12 }}>
              <kbd style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 4, fontSize: 11, color: '#aaa', fontFamily: 'inherit' }}>{key}</kbd>
              <span style={{ color: '#888' }}>{desc}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
