import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import ChartCard from './ChartCard';
import WeekHourHeatmap from './WeekHourHeatmap';
import { getPersonSummary, getAllDates } from '../utils/dataAggregator';
import { COLORS, shortName } from '../utils/formatters';
import type { PersonData } from '../types';
import { useT } from '../i18n/LanguageContext';

interface TimelineProps {
  people: PersonData[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(15,15,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#ccc', maxHeight: 260, overflowY: 'auto' }}>
      <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{label}</div>
      {payload
        .filter((p: any) => p.value > 0)
        .sort((a: any, b: any) => b.value - a.value)
        .map((p: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
            <span>{p.name}: {p.value.toLocaleString()}</span>
          </div>
        ))}
    </div>
  );
};

export default function Timeline({ people }: TimelineProps) {
  const { t } = useT();
  const allDates = getAllDates(people);
  const summaries = people.map((p) => getPersonSummary(p));
  const sortedByRequests = summaries.slice().sort((a, b) => b.totalRequests - a.totalRequests);

  const areaData = useMemo(() => {
    return allDates.map((date) => {
      const entry: Record<string, any> = { date: date.slice(5) };
      for (const s of sortedByRequests) {
        const day = s.dailyActivity.find((d) => d.date === date);
        entry[s.name] = day?.count || 0;
      }
      return entry;
    });
  }, [allDates, sortedByRequests]);

  const heatmapRows = useMemo(() => {
    return sortedByRequests.map((s) => {
      const dayMap = new Map(s.dailyActivity.map((d) => [d.date, d.count]));
      return {
        name: s.name,
        shortName: shortName(s.name),
        days: allDates.map((date) => ({ date, count: dayMap.get(date) || 0 })),
      };
    });
  }, [sortedByRequests, allDates]);

  const maxCount = useMemo(
    () => Math.max(1, ...heatmapRows.flatMap((h) => h.days.map((d) => d.count))),
    [heatmapRows],
  );

  const weekHourData = useMemo(() => {
    return people.flatMap((p) =>
      p.rows.map((r) => ({ dateStr: r.dateStr, hour: r.hour })),
    );
  }, [people]);

  return (
    <div className="space-y-5">
      <WeekHourHeatmap data={weekHourData} title={t('timeline.whenTeamUsesAI')} />

      <ChartCard title={t('timeline.activityByDay')}>
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={areaData} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#666' }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {sortedByRequests.map((s, i) => (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                name={shortName(s.name)}
                stackId="1"
                stroke={COLORS[i % COLORS.length]}
                fill={COLORS[i % COLORS.length]}
                fillOpacity={0.3}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('timeline.activityHeatmap')}>
        <div className="overflow-x-auto">
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 10 }}>
            <thead>
              <tr>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#666', position: 'sticky', left: 0, background: '#0a0a0f', zIndex: 1 }}>
                  {t('common.developer')}
                </th>
                {allDates.map((d) => (
                  <th key={d} style={{ padding: '4px 2px', color: '#555', fontWeight: 400, whiteSpace: 'nowrap' }}>
                    {d.slice(5)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map((row) => (
                <tr key={row.name}>
                  <td style={{ padding: '5px 8px', color: '#aaa', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#0a0a0f', zIndex: 1, fontWeight: 500, fontSize: 11 }}>
                    {row.shortName}
                  </td>
                  {row.days.map((d) => {
                    const intensity = Math.min(d.count / maxCount, 1);
                    return (
                      <td key={d.date} style={{ padding: 2, textAlign: 'center' }}>
                        <div
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 4,
                            margin: '0 auto',
                            background: d.count === 0
                              ? 'rgba(255,255,255,0.02)'
                              : `rgba(230, 57, 70, ${0.15 + intensity * 0.85})`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 8,
                            color: d.count > 20 ? '#fff' : d.count > 0 ? 'rgba(255,255,255,0.7)' : 'transparent',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {d.count > 0 ? d.count : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
