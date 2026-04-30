import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from 'recharts';
import ChartCard from './ChartCard';
import { getAllModels, getPersonSummary } from '../utils/dataAggregator';
import { shortModel, shortName, COLORS } from '../utils/formatters';
import { teamColorOfPerson } from '../utils/teams';
import type { PersonData, Team, Member } from '../types';
import { useT } from '../i18n/LanguageContext';

interface ModelsProps {
  people: PersonData[];
  teams?: Team[];
  members?: Member[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ccc' }}>
      {label && <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.payload?.fill, display: 'inline-block' }} />
          <span>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function Models({ people, teams, members }: ModelsProps) {
  const { t } = useT();
  const modelTotals = getAllModels(people);

  const teamColorOf = (personName: string): string | undefined => {
    if (!teams || !members) return undefined;
    const p = people.find((pp) => pp.name === personName);
    if (!p) return undefined;
    const c = teamColorOfPerson(teams, members, p);
    return c && c !== '#666' ? c : undefined;
  };

  const pieData = useMemo(
    () =>
      Array.from(modelTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => ({ name: shortModel(model), value: count, model })),
    [modelTotals],
  );

  const barData = useMemo(
    () =>
      Array.from(modelTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([model, count]) => ({ name: shortModel(model), value: count })),
    [modelTotals],
  );

  const summaries = useMemo(
    () => people.map((p) => getPersonSummary(p)).sort((a, b) => b.totalRequests - a.totalRequests),
    [people],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <ChartCard title={t('models.distribution')}>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                innerRadius={50}
                dataKey="value"
                nameKey="name"
                paddingAngle={2}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('models.requestsByModel')}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#888' }} width={95} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name={t('models.requests')} radius={[0, 6, 6, 0]}>
                {barData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title={t('models.byDeveloper')}>
        <div className="flex flex-col gap-2.5">
          {summaries.slice(0, 10).map((s) => {
            const total = s.totalRequests;
            const models = s.modelUsage.filter((m) => m.count > 0).sort((a, b) => b.count - a.count);
            return (
              <div key={s.name}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: '#aaa', width: 120, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {teamColorOf(s.name) && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: teamColorOf(s.name) }} />
                    )}
                    {shortName(s.name)}
                  </span>
                  <div style={{ flex: 1, height: 22, borderRadius: 6, overflow: 'hidden', display: 'flex', background: 'rgba(255,255,255,0.02)' }}>
                    {models.map((m, mi) => (
                      <div
                        key={m.model}
                        title={`${shortModel(m.model)}: ${m.count}`}
                        style={{
                          width: `${(m.count / total) * 100}%`,
                          background: COLORS[mi % COLORS.length],
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          color: '#fff',
                          fontWeight: 500,
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          padding: '0 4px',
                        }}
                      >
                        {m.count / total > 0.12 ? shortModel(m.model) : ''}
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: 11, color: '#666', width: 40, textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" }}>
                    {total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ChartCard>
    </div>
  );
}
