import { useCallback, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Cell, Treemap, AreaChart, Area, ComposedChart, Line, LabelList,
} from 'recharts';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import { useT } from '../i18n/LanguageContext';
import { COLORS, shortName } from '../utils/formatters';
import { buildPersonColorMap } from '../utils/teams';
import { useHighlight } from '../utils/useHighlight';
import { HorizontalBarInitials, PersonLegend, IsolationBanner } from './InitialsBadge';
import type { PersonData, DailyApiMetric, Team, Member } from '../types';

interface CodeImpactProps {
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
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, display: 'inline-block' }} />
          <span>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const TreemapContent = ({ x, y, width, height, name, value }: any) => {
  if (width < 30 || height < 20) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} rx={4}
        style={{ fill: 'currentColor', stroke: '#0e0e12', strokeWidth: 2, opacity: 0.8 }} />
      <text x={x + width / 2} y={y + height / 2 - 6} textAnchor="middle" fill="#fff" fontSize={width < 60 ? 10 : 13} fontWeight={600}>
        .{name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize={10}>
        {value}
      </text>
    </g>
  );
};

function getAllApiMetrics(people: PersonData[]): DailyApiMetric[] {
  return people.flatMap((p) => p.dailyApiMetrics ?? []);
}

export default function CodeImpact({ people, teams, members }: CodeImpactProps) {
  const hl = useHighlight();
  const personColorMap = useMemo(
    () => (teams && members ? buildPersonColorMap(teams, members, people) : null),
    [teams, members, people],
  );
  const colorByPersonName = useCallback(
    (name: string, fallback: string) => {
      if (!personColorMap) return fallback;
      return personColorMap.get(name) ?? fallback;
    },
    [personColorMap],
  );
  const onChartLeave = useCallback(() => hl.setHovered(null), [hl]);
  const onCellEnter = useCallback((key: string) => hl.setHovered(key), [hl]);
  const onCellClick = useCallback((key: string) => hl.toggleIsolated(key), [hl]);
  const { t } = useT();
  const hasApiData = people.some((p) => (p.dailyApiMetrics?.length ?? 0) > 0);

  const globalKpi = useMemo(() => {
    const all = getAllApiMetrics(people);
    const linesAdded = all.reduce((s, m) => s + m.linesAdded, 0);
    const linesDeleted = all.reduce((s, m) => s + m.linesDeleted, 0);
    const acceptedAdded = all.reduce((s, m) => s + m.acceptedLinesAdded, 0);
    const totalApplies = all.reduce((s, m) => s + m.totalApplies, 0);
    const totalAccepts = all.reduce((s, m) => s + m.totalAccepts, 0);
    const totalRejects = all.reduce((s, m) => s + m.totalRejects, 0);
    const tabsShown = all.reduce((s, m) => s + m.totalTabsShown, 0);
    const tabsAccepted = all.reduce((s, m) => s + m.totalTabsAccepted, 0);
    const acceptRate = totalApplies > 0 ? Math.round((totalAccepts / totalApplies) * 100) : 0;
    const tabRate = tabsShown > 0 ? Math.round((tabsAccepted / tabsShown) * 100) : 0;

    return { linesAdded, linesDeleted, acceptedAdded, totalApplies, totalAccepts, totalRejects, acceptRate, tabsShown, tabsAccepted, tabRate };
  }, [people]);

  const dailyLines = useMemo(() => {
    const dayMap = new Map<string, { added: number; deleted: number; accepted: number }>();
    for (const p of people) {
      for (const m of p.dailyApiMetrics ?? []) {
        const prev = dayMap.get(m.dateStr) ?? { added: 0, deleted: 0, accepted: 0 };
        dayMap.set(m.dateStr, {
          added: prev.added + m.linesAdded,
          deleted: prev.deleted + m.linesDeleted,
          accepted: prev.accepted + m.acceptedLinesAdded,
        });
      }
    }
    const sorted = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), fullDate: date, ...v }));

    const W = 7;
    return sorted.map((d, i) => {
      const slice = sorted.slice(Math.max(0, i - W + 1), i + 1);
      const maAdded = Math.round(slice.reduce((s, v) => s + v.added, 0) / slice.length);
      return { ...d, maAdded };
    });
  }, [people]);

  const perPersonAcceptRate = useMemo(() => {
    return people
      .filter((p) => (p.dailyApiMetrics?.length ?? 0) > 0)
      .map((p) => {
        const metrics = p.dailyApiMetrics!;
        const applies = metrics.reduce((s, m) => s + m.totalApplies, 0);
        const accepts = metrics.reduce((s, m) => s + m.totalAccepts, 0);
        const linesAdded = metrics.reduce((s, m) => s + m.linesAdded, 0);
        const agentReq = metrics.reduce((s, m) => s + m.agentRequests, 0);
        const rate = applies > 0 ? Math.round((accepts / applies) * 100) : 0;
        return {
          name: shortName(p.name),
          fullName: p.name,
          rate,
          applies,
          accepts,
          linesAdded,
          linesPerReq: agentReq > 0 ? Math.round(linesAdded / agentReq) : 0,
        };
      })
      .sort((a, b) => b.rate - a.rate);
  }, [people]);

  const languageData = useMemo(() => {
    const langMap = new Map<string, number>();
    for (const p of people) {
      for (const m of p.dailyApiMetrics ?? []) {
        for (const ext of m.extensionUsage) {
          langMap.set(ext.name, (langMap.get(ext.name) || 0) + ext.count);
        }
      }
    }
    return Array.from(langMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [people]);

  const treemapColors = ['#e63946', '#2a9d8f', '#457b9d', '#e9c46a', '#f4a261', '#a8dadc', '#264653', '#ef476f', '#06d6a0', '#118ab2', '#ffd166', '#8338ec'];

  const devNames = useMemo(() => {
    return people
      .filter((p) => (p.dailyApiMetrics?.length ?? 0) > 0)
      .map((p) => p.name);
  }, [people]);

  const dailyLinesByDev = useMemo(() => {
    const allDates = new Set<string>();
    for (const p of people) {
      for (const m of p.dailyApiMetrics ?? []) allDates.add(m.dateStr);
    }
    const sortedDates = Array.from(allDates).sort();

    const personMetricMap = new Map<string, Map<string, number>>();
    for (const p of people) {
      const dayMap = new Map<string, number>();
      for (const m of p.dailyApiMetrics ?? []) {
        dayMap.set(m.dateStr, (dayMap.get(m.dateStr) || 0) + m.linesAdded);
      }
      if (dayMap.size > 0) personMetricMap.set(p.name, dayMap);
    }

    return sortedDates.map((d) => {
      const entry: Record<string, string | number> = { date: d.slice(5), fullDate: d };
      for (const [name, dayMap] of personMetricMap) {
        const short = shortName(name);
        entry[short] = dayMap.get(d) || 0;
      }
      return entry;
    });
  }, [people]);

  const devShortNames = useMemo(() => {
    return devNames.map((n) => shortName(n));
  }, [devNames]);

  const perPersonLines = useMemo(() => {
    return people
      .filter((p) => (p.dailyApiMetrics?.length ?? 0) > 0)
      .map((p) => {
        const metrics = p.dailyApiMetrics!;
        const linesAdded = metrics.reduce((s, m) => s + m.linesAdded, 0);
        const linesDeleted = metrics.reduce((s, m) => s + m.linesDeleted, 0);
        return {
          name: shortName(p.name),
          fullName: p.name,
          linesAdded,
          linesDeleted,
          net: linesAdded - linesDeleted,
        };
      })
      .sort((a, b) => b.linesAdded - a.linesAdded);
  }, [people]);

  if (!hasApiData) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#555' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#888', marginBottom: 8 }}>
          {t('codeImpact.noJsonData')}
        </div>
        <div style={{ fontSize: 13 }}>
          {t('codeImpact.uploadJson')}
          <br />
          {t('codeImpact.toSeeMetrics')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label={t('codeImpact.linesAdded')} value={globalKpi.linesAdded.toLocaleString()} subtitle={t('codeImpact.deleted', globalKpi.linesDeleted.toLocaleString())} />
        <KpiCard label={t('codeImpact.acceptRate')} value={globalKpi.acceptRate + '%'} subtitle={t('codeImpact.ofApplies', globalKpi.totalAccepts, globalKpi.totalApplies)} />
        <KpiCard label={t('codeImpact.tabCompletion')} value={globalKpi.tabRate + '%'} subtitle={t('codeImpact.ofShown', globalKpi.tabsAccepted, globalKpi.tabsShown)} />
        <KpiCard label={t('codeImpact.linesAccepted')} value={globalKpi.acceptedAdded.toLocaleString()} subtitle={t('codeImpact.ofAdded', globalKpi.linesAdded > 0 ? Math.round((globalKpi.acceptedAdded / globalKpi.linesAdded) * 100) : 0)} />
      </div>

      {/* Daily lines chart */}
      <ChartCard title={t('codeImpact.linesPerDayTeam')}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={dailyLines} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="added" name={t('codeImpact.added')} fill="#2a9d8f" radius={[3, 3, 0, 0]} />
            <Bar dataKey="deleted" name={t('codeImpact.removed')} fill="#e63946" radius={[3, 3, 0, 0]} />
            <Bar dataKey="accepted" name={t('codeImpact.accepted')} fill="#457b9d" radius={[3, 3, 0, 0]} />
            <Line type="monotone" dataKey="maAdded" name={t('codeImpact.ma7dAdded')} stroke="#e9c46a" strokeWidth={2.5} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Per-developer daily lines stacked area */}
      <ChartCard title={t('codeImpact.linesPerDayDev')}>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={dailyLinesByDev} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            {devShortNames.map((name, i) => {
              const orig = devNames.find((n) => shortName(n) === name) ?? name;
              const color = colorByPersonName(orig, COLORS[i % COLORS.length]);
              const opacity = hl.opacityFor(orig);
              return (
                <Area
                  key={name}
                  type="monotone"
                  dataKey={name}
                  name={name}
                  stackId="1"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.6 * opacity}
                  strokeOpacity={opacity}
                  isAnimationActive={false}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
        <PersonLegend
          names={devNames}
          colorOf={(n) => colorByPersonName(n, '#aaa')}
          hl={hl}
        />
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        {/* Accept rate per person */}
        <ChartCard title={t('codeImpact.acceptRateByDev')}>
          <ResponsiveContainer width="100%" height={Math.max(260, perPersonAcceptRate.length * 30)}>
            <BarChart data={perPersonAcceptRate} layout="vertical" margin={{ left: 10, right: 40 }} onMouseLeave={onChartLeave}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: '#555' }} tickFormatter={(v) => v + '%'} />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="rate" name="Accept Rate %" radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false} activeBar={false}>
                {perPersonAcceptRate.map((d, i) => (
                  <Cell
                    key={i}
                    fill={colorByPersonName(d.fullName, COLORS[i % COLORS.length])}
                    fillOpacity={hl.opacityFor(d.fullName)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => onCellEnter(d.fullName)}
                    onClick={() => onCellClick(d.fullName)}
                  />
                ))}
                <LabelList dataKey="rate" content={(props: any) => <HorizontalBarInitials {...props} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Lines per person */}
        <ChartCard title={t('codeImpact.linesByDev')}>
          <ResponsiveContainer width="100%" height={Math.max(260, perPersonLines.length * 30)}>
            <BarChart data={perPersonLines} layout="vertical" margin={{ left: 10, right: 30 }} onMouseLeave={onChartLeave}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="linesAdded" name={t('codeImpact.added')} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false} activeBar={false}>
                {perPersonLines.map((d, i) => (
                  <Cell
                    key={i}
                    fill={colorByPersonName(d.fullName, '#2a9d8f')}
                    fillOpacity={hl.opacityFor(d.fullName)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => onCellEnter(d.fullName)}
                    onClick={() => onCellClick(d.fullName)}
                  />
                ))}
                <LabelList dataKey="linesAdded" content={(props: any) => <HorizontalBarInitials {...props} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Language treemap */}
        <ChartCard title={t('codeImpact.languagesFileTypes')}>
          {languageData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <Treemap
                data={languageData.slice(0, 20).map((d, i) => ({ ...d, fill: treemapColors[i % treemapColors.length] }))}
                dataKey="count"
                nameKey="name"
                content={<TreemapContent />}
              >
                {languageData.slice(0, 20).map((_, i) => (
                  <Cell key={i} fill={treemapColors[i % treemapColors.length]} />
                ))}
              </Treemap>
            </ResponsiveContainer>
          ) : (
            <div style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: 40 }}>{t('codeImpact.noData')}</div>
          )}
        </ChartCard>

        {/* Lines per request efficiency */}
        <ChartCard title={t('codeImpact.productivityLines')}>
          <ResponsiveContainer width="100%" height={Math.max(260, perPersonAcceptRate.length * 30)}>
            <BarChart data={perPersonAcceptRate} layout="vertical" margin={{ left: 10, right: 30 }} onMouseLeave={onChartLeave}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={85} tick={{ fontSize: 11, fill: '#888' }} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="linesPerReq" name={t('codeImpact.linesPerReq')} radius={[0, 6, 6, 0]} barSize={18} isAnimationActive={false} activeBar={false}>
                {perPersonAcceptRate.map((d, i) => (
                  <Cell
                    key={i}
                    fill={colorByPersonName(d.fullName, COLORS[i % COLORS.length])}
                    fillOpacity={hl.opacityFor(d.fullName)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => onCellEnter(d.fullName)}
                    onClick={() => onCellClick(d.fullName)}
                  />
                ))}
                <LabelList dataKey="linesPerReq" content={(props: any) => <HorizontalBarInitials {...props} />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <IsolationBanner
        hl={hl}
        labelTemplate={(n) => t('chart.isolated', n)}
        clearLabel={t('chart.clear')}
      />
    </div>
  );
}
