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
import type { PersonData, TabId } from './types';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'adoption', label: 'Adoption' },
  { id: 'codeImpact', label: 'Code Impact' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'models', label: 'Models' },
  { id: 'person', label: 'Per Developer' },
];

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
  const [people, setPeople] = useState<PersonData[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showUploader, setShowUploader] = useState(true);
  const [rangeStart, setRangeStart] = useState<Date>(new Date(0));
  const [rangeEnd, setRangeEnd] = useState<Date>(new Date());

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
    const formatD = (d: Date) => {
      const msk = new Date(d.getTime() + MSK_OFFSET_MS);
      return msk.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    };
    const startD = formatD(rangeStart);
    const endD = formatD(rangeEnd);
    return `AI model usage · ${startD} — ${endD} · ${global.totalRequests.toLocaleString()} requests · ${formatTokens(global.totalTokens)} tokens`;
  }, [filteredPeople, rangeStart, rangeEnd]);

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
            }}>AI Team Metrics</h1>
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
                  {showUploader ? 'Hide upload' : 'Upload data'}
                </button>
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
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 500, fontFamily: 'inherit', transition: 'all 0.2s',
                    background: activeTab === t.id ? 'rgba(255,255,255,0.1)' : 'transparent',
                    color: activeTab === t.id ? '#fff' : '#666',
                  }}
                >
                  {t.label}
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
                No data for the selected period.
              </div>
            )}
          </>
        )}

        {!hasData && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#555', fontSize: 14 }}>
            Upload CSV or JSON files to start analyzing Cursor usage.
          </div>
        )}
      </div>
    </div>
  );
}
