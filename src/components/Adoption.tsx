import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import { useT } from '../i18n/LanguageContext';
import { COLORS, formatNumber, formatTokens, shortName } from '../utils/formatters';
import type { PersonData } from '../types';

interface AdoptionProps {
  people: PersonData[];
  totalTeamSize: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ccc' }}>
      {label && <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.payload?.fill, display: 'inline-block' }} />
          <span>{p.name}: {typeof p.value === 'number' ? (Number.isInteger(p.value) ? p.value.toLocaleString() : p.value.toFixed(1)) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function Adoption({ people, totalTeamSize }: AdoptionProps) {
  const { t } = useT();
  const SEGMENTS = useMemo(() => [
    { key: 'power' as const, label: t('adoption.powerDay'), color: '#e63946', min: 30 },
    { key: 'regular' as const, label: t('adoption.regularDay'), color: '#2a9d8f', min: 5 },
    { key: 'low' as const, label: t('adoption.lowDay'), color: '#e9c46a', min: 1 },
    { key: 'inactive' as const, label: t('adoption.inactive'), color: '#333', min: 0 },
  ], [t]);
  const weeklyAdoption = useMemo(() => {
    const weekMap = new Map<string, Map<string, number>>();

    for (const p of people) {
      for (const r of p.rows) {
        const week = getWeekKey(r.dateStr);
        if (!weekMap.has(week)) weekMap.set(week, new Map());
        const personMap = weekMap.get(week)!;
        personMap.set(p.name, (personMap.get(p.name) || 0) + 1);
      }
      if (p.rows.length === 0 && p.dailyApiMetrics?.length) {
        for (const m of p.dailyApiMetrics) {
          const week = getWeekKey(m.dateStr);
          if (!weekMap.has(week)) weekMap.set(week, new Map());
          const personMap = weekMap.get(week)!;
          personMap.set(p.name, (personMap.get(p.name) || 0) + m.agentRequests);
        }
      }
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, personMap]) => {
        const activeUsers = personMap.size;
        const active10 = Array.from(personMap.values()).filter((c) => c >= 10).length;
        const totalReq = Array.from(personMap.values()).reduce((s, v) => s + v, 0);
        const weekLabel = week.slice(5);
        return {
          week: weekLabel,
          fullWeek: week,
          activeUsers,
          active10plus: active10,
          adoptionPct: Math.round((activeUsers / totalTeamSize) * 100),
          totalReq,
        };
      });
  }, [people, totalTeamSize]);

  const segmentation = useMemo(() => {
    const allDates = new Set<string>();
    for (const p of people) {
      for (const r of p.rows) allDates.add(r.dateStr);
    }
    const totalDays = allDates.size || 1;

    const personAvg = people.map((p) => {
      const personDates = new Set(p.rows.map((r) => r.dateStr));
      let totalRequests = p.rows.length;
      if (totalRequests === 0 && p.dailyApiMetrics?.length) {
        for (const m of p.dailyApiMetrics) {
          personDates.add(m.dateStr);
          totalRequests += m.agentRequests;
        }
      }
      const activeDays = personDates.size || 1;
      const apiMetrics = p.dailyApiMetrics ?? [];
      const linesAdded = apiMetrics.reduce((s, m) => s + m.linesAdded, 0);
      const totalApplies = apiMetrics.reduce((s, m) => s + m.totalApplies, 0);
      const totalAccepts = apiMetrics.reduce((s, m) => s + m.totalAccepts, 0);
      return {
        name: p.name,
        avgPerDay: totalRequests / activeDays,
        totalRequests,
        activeDays: personDates.size,
        linesAdded,
        acceptRate: totalApplies > 0 ? Math.round((totalAccepts / totalApplies) * 100) : null as number | null,
      };
    });

    const counts = { power: 0, regular: 0, low: 0, inactive: 0 };
    const members: Record<string, typeof personAvg> = { power: [], regular: [], low: [], inactive: [] };

    for (const pa of personAvg) {
      if (pa.avgPerDay >= 30) { counts.power++; members.power.push(pa); }
      else if (pa.avgPerDay >= 5) { counts.regular++; members.regular.push(pa); }
      else if (pa.totalRequests > 0) { counts.low++; members.low.push(pa); }
      else { counts.inactive++; members.inactive.push(pa); }
    }

    const pieData = SEGMENTS.map((s) => ({
      name: s.label,
      value: counts[s.key],
      color: s.color,
    })).filter((d) => d.value > 0);

    return { counts, members, pieData, personAvg, totalDays };
  }, [people, SEGMENTS]);

  const wow = useMemo(() => {
    if (weeklyAdoption.length < 2) return null;
    const curr = weeklyAdoption[weeklyAdoption.length - 1];
    const prev = weeklyAdoption[weeklyAdoption.length - 2];

    const delta = (c: number, p: number) => {
      if (p === 0) return c > 0 ? 100 : 0;
      return Math.round(((c - p) / p) * 100);
    };

    return {
      currWeek: curr.fullWeek,
      prevWeek: prev.fullWeek,
      requests: { curr: curr.totalReq, prev: prev.totalReq, delta: delta(curr.totalReq, prev.totalReq) },
      activeUsers: { curr: curr.activeUsers, prev: prev.activeUsers, delta: delta(curr.activeUsers, prev.activeUsers) },
      adoption: { curr: curr.adoptionPct, prev: prev.adoptionPct, delta: curr.adoptionPct - prev.adoptionPct },
    };
  }, [weeklyAdoption]);

  const segBarData = useMemo(() => {
    return segmentation.personAvg
      .slice()
      .sort((a, b) => b.avgPerDay - a.avgPerDay)
      .map((p) => {
        let segment: string;
        let color: string;
        if (p.avgPerDay >= 30) { segment = 'Power'; color = SEGMENTS[0].color; }
        else if (p.avgPerDay >= 5) { segment = 'Regular'; color = SEGMENTS[1].color; }
        else { segment = 'Low'; color = SEGMENTS[2].color; }
        return {
          name: shortName(p.name),
          fullName: p.name,
          avg: Math.round(p.avgPerDay * 10) / 10,
          segment,
          color,
        };
      });
  }, [segmentation, SEGMENTS]);

  const latestAdoption = weeklyAdoption.length > 0
    ? weeklyAdoption[weeklyAdoption.length - 1].adoptionPct
    : 0;

  return (
    <div className="space-y-5">
      {/* WoW comparison */}
      {wow ? (
        <div className="grid grid-cols-3 gap-3">
          <WowCard
            label={t('adoption.requestsPerWeek')}
            curr={formatNumber(wow.requests.curr)}
            prev={formatNumber(wow.requests.prev)}
            delta={wow.requests.delta}
            prevWeekPrefix={t('adoption.prevWeek')}
          />
          <WowCard
            label={t('adoption.activeDevelopers')}
            curr={String(wow.activeUsers.curr)}
            prev={String(wow.activeUsers.prev)}
            delta={wow.activeUsers.delta}
            prevWeekPrefix={t('adoption.prevWeek')}
          />
          <WowCard
            label={t('adoption.adoptionRate')}
            curr={wow.adoption.curr + '%'}
            prev={wow.adoption.prev + '%'}
            delta={wow.adoption.delta}
            deltaSuffix={t('adoption.pp')}
            prevWeekPrefix={t('adoption.prevWeek')}
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <KpiCard label={t('adoption.adoptionRate')} value={latestAdoption + '%'} subtitle={t('adoption.ofTotal', people.length, totalTeamSize)} />
          <KpiCard label={t('adoption.totalLoaded')} value={people.length} subtitle={t('common.developers')} />
          <KpiCard label={t('adoption.teamSize')} value={totalTeamSize} subtitle={t('common.people')} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Adoption rate by week */}
        <ChartCard title={t('adoption.adoptionByWeek')}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={weeklyAdoption} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} domain={[0, totalTeamSize]} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="activeUsers" stroke="#e63946" strokeWidth={2.5} dot={{ r: 4, fill: '#e63946' }} name={t('adoption.active')} />
              <Line type="monotone" dataKey="active10plus" stroke="#2a9d8f" strokeWidth={2} dot={{ r: 3, fill: '#2a9d8f' }} strokeDasharray="5 3" name={t('adoption.reqWk')} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Adoption % */}
        <ChartCard title={t('adoption.engagementByWeek')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={weeklyAdoption} margin={{ bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} domain={[0, 100]} tickFormatter={(v) => v + '%'} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="adoptionPct" name="Adoption %" fill="#457b9d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Segmentation pie */}
        <ChartCard title={t('adoption.teamSegmentation')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <ResponsiveContainer width="50%" height={260}>
              <PieChart>
                <Pie
                  data={segmentation.pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  innerRadius={45}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={3}
                >
                  {segmentation.pieData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1, fontSize: 12 }}>
              {SEGMENTS.map((s) => {
                const members = segmentation.members[s.key];
                if (!members.length) return null;
                return (
                  <div key={s.key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                      <span style={{ color: '#aaa', fontWeight: 600 }}>{s.label}</span>
                      <span style={{ color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>({members.length})</span>
                    </div>
                    <div style={{ color: '#666', paddingLeft: 14, lineHeight: 1.6 }}>
                      {members.map((m) => shortName(m.name)).join(', ')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChartCard>

        {/* Per-person intensity bar with segment colors */}
        <ChartCard title={t('adoption.intensityPerDev')}>
          <ResponsiveContainer width="100%" height={Math.max(260, segBarData.length * 28)}>
            <BarChart data={segBarData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" name={t('adoption.avgReqDay')} radius={[0, 6, 6, 0]} barSize={18}>
                {segBarData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Weekly requests trend */}
      <ChartCard title={t('adoption.requestsPerWeekTeam')}>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={weeklyAdoption} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="totalReq" name={t('adoption.requests')} fill="#e9c46a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function WowCard({ label, curr, prev, delta, deltaSuffix = '%', prevWeekPrefix }: {
  label: string;
  curr: string;
  prev: string;
  delta: number;
  deltaSuffix?: string;
  prevWeekPrefix: string;
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;
  const arrow = isFlat ? '→' : isUp ? '↑' : '↓';
  const color = isFlat ? '#888' : isUp ? '#2a9d8f' : '#e63946';

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 14,
      padding: '18px 16px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#e0e0e0' }}>
          {curr}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color, fontFamily: "'JetBrains Mono', monospace" }}>
          {arrow} {delta > 0 ? '+' : ''}{delta}{deltaSuffix}
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
        {prevWeekPrefix} {prev}
      </div>
    </div>
  );
}
