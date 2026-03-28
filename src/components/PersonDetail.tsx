import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell, Legend,
  ComposedChart,
} from 'recharts';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import WeekHourHeatmap from './WeekHourHeatmap';
import { getPersonSummary } from '../utils/dataAggregator';
import { formatTokens, shortModel, shortName, COLORS } from '../utils/formatters';
import type { PersonData } from '../types';
import { useT } from '../i18n/LanguageContext';

interface PersonDetailProps {
  people: PersonData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ccc' }}>
      {label !== undefined && <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.payload?.fill, display: 'inline-block' }} />
          <span>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PersonDetail({ people }: PersonDetailProps) {
  const [selected, setSelected] = useState<string>(people[0]?.name || '');
  const [showNumbers, setShowNumbers] = useState(true);
  const [heatmapMetric, setHeatmapMetric] = useState<'requests' | 'tokens'>('requests');
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number; x: number; y: number } | null>(null);
  const { t } = useT();

  const person = people.find((p) => p.name === selected);
  const summary = useMemo(
    () => (person ? getPersonSummary(person) : null),
    [person],
  );

  if (!people.length) return null;

  const dailyData = summary?.dailyActivity.map((d) => ({
    date: d.date.slice(5),
    requests: d.count,
    tokens: Math.round(d.tokens / 1e6),
  })) || [];

  const trendData = useMemo(() => {
    if (!dailyData.length) return [];
    let cumReq = 0;
    let cumTok = 0;
    const window = 7;
    return dailyData.map((d, i) => {
      cumReq += d.requests;
      cumTok += d.tokens;
      const slice = dailyData.slice(Math.max(0, i - window + 1), i + 1);
      const maReq = Math.round(slice.reduce((s, v) => s + v.requests, 0) / slice.length * 10) / 10;
      const maTok = Math.round(slice.reduce((s, v) => s + v.tokens, 0) / slice.length * 10) / 10;
      return { date: d.date, cumReq, cumTok, maReq, maTok, requests: d.requests, tokens: d.tokens };
    });
  }, [dailyData]);

  const hourlyData = summary?.hourlyActivity.map((h) => ({
    hour: `${h.hour}:00`,
    requests: h.count,
  })) || [];

  const personWeekHourData = useMemo(() => {
    if (!person) return [];
    return person.rows.map((r) => ({ dateStr: r.dateStr, hour: r.hour }));
  }, [person]);

  const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const TIERS_REQUESTS = [
    { min: 0, max: 0, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)', text: '#333', label: '0' },
    { min: 1, max: 5, bg: 'rgba(230,57,70,0.15)', border: 'rgba(230,57,70,0.25)', text: '#e6394680', label: '1–5' },
    { min: 6, max: 15, bg: 'rgba(230,57,70,0.35)', border: 'rgba(230,57,70,0.45)', text: '#e63946b0', label: '6–15' },
    { min: 16, max: 30, bg: 'rgba(230,57,70,0.6)', border: 'rgba(230,57,70,0.7)', text: '#ffffffcc', label: '16–30' },
    { min: 31, max: Infinity, bg: 'rgba(230,57,70,0.9)', border: '#e63946', text: '#fff', label: '>30' },
  ];

  const TIERS_TOKENS = [
    { min: 0, max: 0, bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.06)', text: '#333', label: '0' },
    { min: 1, max: 50000, bg: 'rgba(42,157,143,0.15)', border: 'rgba(42,157,143,0.25)', text: '#2a9d8f80', label: '1–50K' },
    { min: 50001, max: 200000, bg: 'rgba(42,157,143,0.35)', border: 'rgba(42,157,143,0.45)', text: '#2a9d8fb0', label: '50K–200K' },
    { min: 200001, max: 500000, bg: 'rgba(42,157,143,0.6)', border: 'rgba(42,157,143,0.7)', text: '#ffffffcc', label: '200K–500K' },
    { min: 500001, max: Infinity, bg: 'rgba(42,157,143,0.9)', border: '#2a9d8f', text: '#fff', label: '>500K' },
  ];

  const activeTiers = heatmapMetric === 'requests' ? TIERS_REQUESTS : TIERS_TOKENS;

  function getTier(count: number) {
    return activeTiers.find((t) => count >= t.min && count <= t.max) || activeTiers[0];
  }

  type HeatmapDay = { date: string; requests: number; tokens: number; dow: number; month: number };

  const personDailyHeatmap = useMemo(() => {
    if (!summary) return { weeks: [] as HeatmapDay[][], monthLabels: [] as { col: number; label: string }[] };
    const reqMap = new Map(summary.dailyActivity.map((d) => [d.date, { count: d.count, tokens: d.tokens }]));
    if (reqMap.size === 0) return { weeks: [], monthLabels: [] };

    const dates = Array.from(reqMap.keys()).sort();
    const first = new Date(dates[0] + 'T12:00:00');
    const last = new Date(new Date().toISOString().split('T')[0] + 'T12:00:00');

    const startDow = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - startDow);

    const weeks: HeatmapDay[][] = [];
    let week: HeatmapDay[] = [];
    const cursor = new Date(start);

    while (cursor <= last || week.length > 0) {
      const ds = cursor.toISOString().split('T')[0];
      const dow = (cursor.getDay() + 6) % 7;
      const month = cursor.getMonth();
      const entry = reqMap.get(ds);
      week.push({ date: ds, requests: entry?.count || 0, tokens: entry?.tokens || 0, dow, month });
      if (dow === 6 || cursor > last) {
        weeks.push(week);
        week = [];
        if (cursor > last) break;
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const monthLabels: { col: number; label: string }[] = [];
    let prevMonth = -1;
    for (let i = 0; i < weeks.length; i++) {
      const firstDayOfWeek = weeks[i].find((d) => d.dow === 0) ?? weeks[i][0];
      if (firstDayOfWeek.month !== prevMonth) {
        monthLabels.push({ col: i, label: MONTH_NAMES[firstDayOfWeek.month] });
        prevMonth = firstDayOfWeek.month;
      }
    }

    return { weeks, monthLabels };
  }, [summary]);

  const modelData = summary?.modelUsage
    .filter((m) => m.count > 0)
    .map((m) => ({
      name: shortModel(m.model),
      value: m.count,
    })) || [];

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {people.map((p, i) => (
          <button
            key={p.name}
            onClick={() => setSelected(p.name)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
              transition: 'all 0.15s',
              background: selected === p.name ? COLORS[i % COLORS.length] : 'rgba(255,255,255,0.05)',
              color: selected === p.name ? '#fff' : '#888',
            }}
          >
            {shortName(p.name)}
          </button>
        ))}
      </div>

      {person?.note && (
        <div className="text-xs text-amber-400/70 italic px-1">
          {t('person.note')} {person.note}
        </div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-5 gap-2.5">
            <KpiCard label={t('person.requests')} value={summary.totalRequests} />
            <KpiCard label={t('person.activeDays')} value={summary.activeDays} />
            <KpiCard label={t('person.avgDay')} value={summary.avgRequestsPerDay.toFixed(1)} />
            <KpiCard label={t('person.tokens')} value={formatTokens(summary.totalTokens)} />
            <KpiCard label={t('person.period')} value={`${summary.firstDate.slice(5)} — ${summary.lastDate.slice(5)}`} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <ChartCard title={t('person.requestsPerDay')}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#555' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="requests" fill="#e63946" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('person.activityHours')}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#666' }} interval={2} />
                  <YAxis tick={{ fontSize: 11, fill: '#555' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="requests" stroke="#457b9d" fill="#457b9d" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {personWeekHourData.length > 0 && (
            <WeekHourHeatmap
              data={personWeekHourData}
              title={t('person.whenUsesAI', shortName(person!.name))}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <ChartCard title={t('person.tokensPerDayM')}>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={dailyData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#555' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="tokens" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3, fill: '#2a9d8f' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('person.modelsUsed')}>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={modelData}
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={40}
                    dataKey="value"
                    nameKey="name"
                    paddingAngle={2}
                  >
                    {modelData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {personDailyHeatmap.weeks.length > 0 && (
            <ChartCard title={t('person.activityHeatmap')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {([['requests', t('person.requests')], ['tokens', t('person.tokens')]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setHeatmapMetric(key); setHoveredDay(null); }}
                      style={{
                        padding: '4px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        background: heatmapMetric === key
                          ? (key === 'requests' ? 'rgba(230,57,70,0.7)' : 'rgba(42,157,143,0.7)')
                          : 'rgba(255,255,255,0.04)',
                        color: heatmapMetric === key ? '#fff' : '#888',
                        transition: 'all 0.15s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 11, color: '#888', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={showNumbers}
                    onChange={(e) => setShowNumbers(e.target.checked)}
                    style={{ accentColor: heatmapMetric === 'requests' ? '#e63946' : '#2a9d8f', width: 14, height: 14 }}
                  />
                  {t('person.showValues')}
                </label>
              </div>

              <div data-heatmap style={{ position: 'relative', display: 'flex', gap: 2 }} onMouseLeave={() => setHoveredDay(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 20, marginRight: 4, flexShrink: 0 }}>
                  {[t('day.mon'), '', t('day.wed'), '', t('day.fri'), '', t('day.sun')].map((label, i) => (
                    <div key={i} style={{ height: 26, fontSize: 9, fontWeight: 600, color: '#666', lineHeight: '26px', textAlign: 'right' }}>{label}</div>
                  ))}
                </div>

                <div style={{ flex: 1, overflowX: 'auto' }}>
                  <div style={{ position: 'relative', height: 16, marginBottom: 4 }}>
                    {personDailyHeatmap.monthLabels.map((ml) => (
                      <span
                        key={ml.col + ml.label}
                        style={{
                          position: 'absolute',
                          left: ml.col * 28,
                          fontSize: 10,
                          fontWeight: 600,
                          color: '#888',
                          letterSpacing: 0.5,
                        }}
                      >
                        {ml.label}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: 2 }}>
                    {personDailyHeatmap.weeks.map((week, wi) => (
                      <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {Array.from({ length: 7 }, (_, dow) => {
                          const day = week.find((d) => d.dow === dow);
                          if (!day) return <div key={dow} style={{ width: 26, height: 26 }} />;
                          const val = heatmapMetric === 'requests' ? day.requests : day.tokens;
                          const tier = getTier(val);
                          const isHovered = hoveredDay?.date === day.date;
                          const displayVal = heatmapMetric === 'tokens' && val >= 1000
                            ? `${Math.round(val / 1000)}k`
                            : val;
                          return (
                            <div
                              key={dow}
                              onMouseEnter={(e) => {
                                const rect = (e.target as HTMLElement).getBoundingClientRect();
                                const parent = (e.target as HTMLElement).closest('[data-heatmap]')?.getBoundingClientRect();
                                if (parent) {
                                  setHoveredDay({
                                    date: day.date,
                                    count: val,
                                    x: rect.left - parent.left + rect.width / 2,
                                    y: rect.top - parent.top,
                                  });
                                }
                              }}
                              style={{
                                width: 26,
                                height: 26,
                                borderRadius: 4,
                                background: tier.bg,
                                border: `2px solid ${isHovered ? '#fff' : tier.border}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: showNumbers ? (heatmapMetric === 'tokens' ? 7 : 9) : 0,
                                fontWeight: 600,
                                fontFamily: "'JetBrains Mono', monospace",
                                color: tier.text,
                                transition: 'border-color 0.1s',
                                cursor: 'default',
                                boxSizing: 'border-box',
                              }}
                            >
                              {showNumbers && val > 0 ? displayVal : ''}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {hoveredDay && (
                  <div style={{
                    position: 'absolute',
                    left: hoveredDay.x,
                    top: hoveredDay.y - 6,
                    transform: 'translate(-50%, -100%)',
                    background: 'rgba(15,15,20,0.95)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    pointerEvents: 'none',
                    zIndex: 10,
                    whiteSpace: 'nowrap',
                  }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: "'JetBrains Mono', monospace", textAlign: 'center' }}>
                      {hoveredDay.count.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 1 }}>
                      {heatmapMetric === 'requests' ? t('common.requests') : t('common.tokens')}
                    </div>
                    <div style={{ fontSize: 11, color: '#999', textAlign: 'center', marginTop: 3 }}>
                      {(() => {
                        const d = new Date(hoveredDay.date + 'T12:00:00');
                        const dayNames = [t('day.sunday'), t('day.monday'), t('day.tuesday'), t('day.wednesday'), t('day.thursday'), t('day.friday'), t('day.saturday')];
                        return `${dayNames[d.getDay()]}, ${hoveredDay.date}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, fontSize: 10, color: '#666', flexWrap: 'wrap' }}>
                <span style={{ color: '#555', fontWeight: 600 }}>{heatmapMetric === 'requests' ? t('person.requestsDay') : t('person.tokensDay')}</span>
                {activeTiers.map((tier) => (
                  <div key={tier.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: 3,
                      background: tier.bg,
                      border: `1px solid ${tier.border}`,
                    }} />
                    <span>{tier.label}</span>
                  </div>
                ))}
              </div>
            </ChartCard>
          )}

          <div className="grid grid-cols-2 gap-4">
            <ChartCard title={t('person.trendRequests')}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#555' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="requests" fill="rgba(230,57,70,0.25)" name={t('person.requests')} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="maReq" stroke="#e9c46a" strokeWidth={2.5} dot={false} name={t('person.ma7d')} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t('person.trendTokens')}>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData} margin={{ bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: '#555' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="tokens" fill="rgba(42,157,143,0.25)" name={t('person.tokensM')} radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="maTok" stroke="#f4a261" strokeWidth={2.5} dot={false} name={t('person.ma7d')} />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {!summary && (
        <div style={{ textAlign: 'center', padding: 60, color: '#555', fontSize: 14 }}>
          {t('person.selectDeveloper')}
        </div>
      )}
    </div>
  );
}
