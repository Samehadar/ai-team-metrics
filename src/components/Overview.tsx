import { useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList,
} from 'recharts';
import KpiCard from './KpiCard';
import ChartCard from './ChartCard';
import { getPersonSummary, getGlobalSummary, getAllDates } from '../utils/dataAggregator';
import { formatTokens, formatNumber, shortName, COLORS } from '../utils/formatters';
import { buildPersonColorMap } from '../utils/teams';
import { useHighlight } from '../utils/useHighlight';
import { VerticalBarInitials, IsolationBanner } from './InitialsBadge';
import type { PersonData, Team, Member } from '../types';
import { useT } from '../i18n/LanguageContext';

interface OverviewProps {
  people: PersonData[];
  teams?: Team[];
  members?: Member[];
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

export default function Overview({ people, teams, members }: OverviewProps) {
  const { t } = useT();
  const hl = useHighlight();
  const global = getGlobalSummary(people);
  const totalDays = getAllDates(people).length || 1;

  const personColorMap = useMemo(
    () => (teams && members ? buildPersonColorMap(teams, members, people) : null),
    [teams, members, people],
  );

  const colorOf = useCallback(
    (personName: string, fallback: string) => {
      if (!personColorMap) return fallback;
      return personColorMap.get(personName) ?? fallback;
    },
    [personColorMap],
  );

  const summaries = useMemo(
    () =>
      people
        .map((p) => ({ summary: getPersonSummary(p), person: p }))
        .sort((a, b) => b.summary.totalRequests - a.summary.totalRequests),
    [people],
  );

  const requestsData = useMemo(
    () =>
      summaries.map(({ summary: s }, i) => ({
        name: shortName(s.name),
        fullName: s.name,
        requests: s.totalRequests,
        fill: colorOf(s.name, COLORS[i % COLORS.length]),
      })),
    [summaries, colorOf],
  );

  const daysData = useMemo(
    () =>
      summaries.map(({ summary: s }, i) => ({
        name: shortName(s.name),
        fullName: s.name,
        days: s.activeDays,
        fill: colorOf(s.name, COLORS[i % COLORS.length]),
      })),
    [summaries, colorOf],
  );

  const intensityData = useMemo(
    () =>
      summaries
        .filter(({ summary: s }) => s.activeDays > 1)
        .map(({ summary: s }, i) => ({
          name: shortName(s.name),
          fullName: s.name,
          avg: Math.round(s.avgRequestsPerDay * 10) / 10,
          fill: colorOf(s.name, COLORS[i % COLORS.length]),
        })),
    [summaries, colorOf],
  );

  const tokensData = useMemo(
    () =>
      summaries.map(({ summary: s }, i) => ({
        name: shortName(s.name),
        fullName: s.name,
        tokens: Math.round(s.totalTokens / 1e6),
        fill: colorOf(s.name, COLORS[i % COLORS.length]),
      })),
    [summaries, colorOf],
  );

  const onChartLeave = useCallback(() => hl.setHovered(null), [hl]);
  const onCellEnter = useCallback((key: string) => hl.setHovered(key), [hl]);
  const onCellClick = useCallback((key: string) => hl.toggleIsolated(key), [hl]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-3">
        <KpiCard label={t('overview.developers')} value={global.totalDevelopers} subtitle={t('common.people')} accent="#4cc9f0" />
        <KpiCard label={t('overview.totalRequests')} value={formatNumber(global.totalRequests)} subtitle={t('common.forPeriod')} accent="#3a86ff" />
        <KpiCard label={t('overview.totalTokens')} value={formatTokens(global.totalTokens)} subtitle={t('overview.cost')} accent="#9d4edd" />
        <KpiCard label={t('overview.avgDay')} value={Math.round(global.totalRequests / totalDays)} subtitle={t('common.requests')} accent="#06d6a0" />
      </div>

      <ChartCard title={t('overview.requestsPerDev')} info={t('info.overview.requestsPerDev')}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={requestsData} margin={{ bottom: 60 }} onMouseLeave={onChartLeave}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="requests" radius={[6, 6, 0, 0]} isAnimationActive={false} activeBar={false}>
              {requestsData.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.fill}
                  fillOpacity={hl.opacityFor(e.fullName)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onCellEnter(e.fullName)}
                  onClick={() => onCellClick(e.fullName)}
                />
              ))}
              <LabelList dataKey="requests" content={(props: any) => <VerticalBarInitials {...props} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title={t('overview.activeDays')} info={t('info.overview.activeDays')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={daysData} margin={{ bottom: 60 }} onMouseLeave={onChartLeave}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="days" radius={[5, 5, 0, 0]} isAnimationActive={false} activeBar={false}>
                {daysData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.fill}
                    fillOpacity={hl.opacityFor(e.fullName)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => onCellEnter(e.fullName)}
                    onClick={() => onCellClick(e.fullName)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('overview.requestsPerDayAvg')} info={t('info.overview.requestsPerDayAvg')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={intensityData} margin={{ bottom: 60 }} onMouseLeave={onChartLeave}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#666' }} angle={-35} textAnchor="end" />
              <YAxis tick={{ fontSize: 11, fill: '#555' }} />
              <Tooltip content={<CustomTooltip />} cursor={false} />
              <Bar dataKey="avg" radius={[5, 5, 0, 0]} isAnimationActive={false} activeBar={false}>
                {intensityData.map((e, i) => (
                  <Cell
                    key={i}
                    fill={e.fill}
                    fillOpacity={hl.opacityFor(e.fullName)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => onCellEnter(e.fullName)}
                    onClick={() => onCellClick(e.fullName)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title={t('overview.tokenConsumption')} info={t('info.overview.tokenConsumption')}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={tokensData} margin={{ bottom: 60 }} onMouseLeave={onChartLeave}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#666' }} angle={-35} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Bar dataKey="tokens" name={t('overview.tokensM')} radius={[6, 6, 0, 0]} isAnimationActive={false} activeBar={false}>
              {tokensData.map((e, i) => (
                <Cell
                  key={i}
                  fill={e.fill}
                  fillOpacity={hl.opacityFor(e.fullName)}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => onCellEnter(e.fullName)}
                  onClick={() => onCellClick(e.fullName)}
                />
              ))}
              <LabelList dataKey="tokens" content={(props: any) => <VerticalBarInitials {...props} />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <IsolationBanner
        hl={hl}
        labelTemplate={(n) => t('chart.isolated', n)}
        clearLabel={t('chart.clear')}
      />
    </div>
  );
}
