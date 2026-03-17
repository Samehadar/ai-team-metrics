import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import { getPersonSummary, getGlobalSummary, getAllDates } from '../utils/dataAggregator';
import { formatTokens, formatNumber, shortName, COLORS } from '../utils/formatters';
import type { PersonData } from '../types';

interface OverviewProps {
  people: PersonData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ccc' }}>
      <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.payload?.fill, display: 'inline-block' }} />
          <span>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Overview({ people }: OverviewProps) {
  const global = getGlobalSummary(people);
  const totalDays = getAllDates(people).length || 1;

  const totalAvailDays = (() => {
    let days = 0;
    for (const p of people) {
      for (const d of p.codevData ?? []) {
        if (d.isAvailable) days++;
      }
    }
    return days;
  })();
  const avgPerWorkDay = totalAvailDays > 0 ? Math.round(global.totalRequests / totalAvailDays) : null;
  const summaries = people
    .map((p) => getPersonSummary(p))
    .sort((a, b) => b.totalRequests - a.totalRequests);

  const requestsData = summaries.map((s, i) => ({
    name: shortName(s.name),
    fullName: s.name,
    requests: s.totalRequests,
    fill: COLORS[i % COLORS.length],
  }));

  const daysData = summaries.map((s, i) => ({
    name: shortName(s.name),
    days: s.activeDays,
    fill: COLORS[i % COLORS.length],
  }));

  const intensityData = summaries
    .filter((s) => s.activeDays > 1)
    .map((s, i) => ({
      name: shortName(s.name),
      fullName: s.name,
      avg: Math.round(s.avgRequestsPerDay * 10) / 10,
      fill: COLORS[i % COLORS.length],
    }));

  const tokensData = summaries.map((s, i) => ({
    name: shortName(s.name),
    tokens: Math.round(s.totalTokens / 1e6),
    fill: COLORS[i % COLORS.length],
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label="Разработчиков" value={global.totalDevelopers} subtitle="человек" />
        <KpiCard label="Всего запросов" value={formatNumber(global.totalRequests)} subtitle="за период" />
        <KpiCard label="Всего токенов" value={formatTokens(global.totalTokens)} subtitle="≈ стоимость" />
        <KpiCard label="Среднее / день" value={Math.round(global.totalRequests / totalDays)} subtitle="запросов" />
        {avgPerWorkDay !== null && (
          <KpiCard label="Среднее / рабоч. день" value={avgPerWorkDay} subtitle="запросов (Codev)" />
        )}
      </div>

      <ChartCard title="Количество запросов">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={requestsData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="requests" radius={[6, 6, 0, 0]}>
              {requestsData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title="Активных дней">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daysData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="days" radius={[5, 5, 0, 0]}>
                {daysData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Запросов в день (среднее)">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={intensityData} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="avg" radius={[5, 5, 0, 0]}>
                {intensityData.map((e, i) => <Cell key={i} fill={e.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Потребление токенов (млн)">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tokensData} margin={{ bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="tokens" name="Токены (млн)" radius={[6, 6, 0, 0]}>
              {tokensData.map((e, i) => <Cell key={i} fill={e.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
