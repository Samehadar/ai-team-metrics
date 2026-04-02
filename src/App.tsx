import { useState, useEffect, useCallback, useMemo } from 'react';
import FileUploader from './components/FileUploader';
import DateRangeSelector from './components/DateRangeSelector';
import Overview from './components/Overview';
import Adoption from './components/Adoption';
import CodeImpact from './components/CodeImpact';
import Timeline from './components/Timeline';
import Models from './components/Models';
import PersonDetail from './components/PersonDetail';
import ReportExporter from './components/ReportExporter';
import { saveData, loadData } from './utils/storage';
import { formatTokens } from './utils/formatters';
import { getGlobalSummary } from './utils/dataAggregator';
import { useT } from './i18n/LanguageContext';
import { DATE_LOCALE } from './i18n/translations';
import type { PersonData, TabId } from './types';

const TAB_IDS: TabId[] = ['overview', 'adoption', 'codeImpact', 'timeline', 'models', 'person'];

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
  const [people, setPeople] = useState<PersonData[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showUploader, setShowUploader] = useState(true);
  const [rangeStart, setRangeStart] = useState<Date>(new Date(0));
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date());
  const [showShortcuts, setShowShortcuts] = useState(false);

  const TABS: { id: TabId; label: string }[] = useMemo(() => [
    { id: 'overview', label: t('tab.overview') },
    { id: 'adoption', label: t('tab.adoption') },
    { id: 'codeImpact', label: t('tab.codeImpact') },
    { id: 'timeline', label: t('tab.timeline') },
    { id: 'models', label: t('tab.models') },
    { id: 'person', label: t('tab.person') },
  ], [t]);

  const { earliest, latest } = useMemo(() => getDateBounds(people), [people]);

  useEffect(() => {
    setRangeStart(earliest);
    setRangeEnd(latest);
  }, [earliest, latest]);

  useEffect(() => {
    const saved = loadData();
    if (saved.length > 0) {
      setPeople(saved);
      setShowUploader(false);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key >= '1' && e.key <= '6' && people.length > 0) {
        const idx = parseInt(e.key) - 1;
        if (TAB_IDS[idx]) setActiveTab(TAB_IDS[idx]);
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
      if (e.key === '?') {
        setShowShortcuts((v) => !v);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [people.length, locale, setLocale]);

  const handleDataChange = useCallback((updated: PersonData[]) => {
    setPeople(updated);
    saveData(updated);
    if (updated.length > 0) setShowUploader(false);
    if (updated.length === 0) setShowUploader(true);
  }, []);

  const handleRangeChange = useCallback((start: Date, end: Date) => {
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const filteredPeople = useMemo(() => {
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    const startStr = rangeStart.toISOString().split('T')[0];
    const endStr = rangeEnd.toISOString().split('T')[0];

    return people
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
  }, [people, rangeStart, rangeEnd]);

  const hasData = people.length > 0;

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
  }, [filteredPeople, rangeStart, rangeEnd, t, locale]);

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
            {hasData && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <ReportExporter people={filteredPeople} rangeStart={rangeStart} rangeEnd={rangeEnd} />
                <button
                  onClick={() => setShowUploader((v) => !v)}
                  style={{
                    padding: '6px 12px', borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.1)', background: 'transparent',
                    color: '#888', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {showUploader ? t('app.hideUpload') : t('app.uploadData')}
                </button>
                <LangToggle locale={locale} setLocale={setLocale} />
                <ShortcutsHint show={showShortcuts} onToggle={() => setShowShortcuts((v) => !v)} t={t} />
              </div>
            )}
            {!hasData && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <LangToggle locale={locale} setLocale={setLocale} />
                <ShortcutsHint show={showShortcuts} onToggle={() => setShowShortcuts((v) => !v)} t={t} />
              </div>
            )}
          </div>
          {hasData && (
            <p style={{ color: '#666', fontSize: 13, margin: 0 }}>{subtitle}</p>
          )}
        </div>

        {(showUploader || !hasData) && (
          <div style={{ marginBottom: 28 }}>
            <FileUploader people={people} onDataChange={handleDataChange} />
          </div>
        )}

        {hasData && (
          <>
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

            <DateRangeSelector
              earliestDate={earliest}
              latestDate={latest}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onChange={handleRangeChange}
            />

            {filteredPeople.length > 0 ? (
              <>
                {activeTab === 'overview' && <Overview people={filteredPeople} />}
                {activeTab === 'adoption' && <Adoption people={filteredPeople} totalTeamSize={people.length} />}
                {activeTab === 'codeImpact' && <CodeImpact people={filteredPeople} />}
                {activeTab === 'timeline' && <Timeline people={filteredPeople} />}
                {activeTab === 'models' && <Models people={filteredPeople} />}
                {activeTab === 'person' && <PersonDetail people={filteredPeople} />}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: 14 }}>
                {t('app.noDataPeriod')}
              </div>
            )}
          </>
        )}

        {!hasData && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: 14 }}>
            {t('app.uploadPrompt')}
          </div>
        )}
      </div>
    </div>
  );
}

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
          borderRadius: 10, padding: '12px 16px', minWidth: 220,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('shortcuts.title')}
          </div>
          {[
            ['1-6', t('shortcuts.tabs')],
            ['/', t('shortcuts.upload')],
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
