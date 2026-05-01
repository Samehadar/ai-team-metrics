import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import ChartCard from './ChartCard';
import { useT } from '../i18n/LanguageContext';
import { sortedTeams, membersOfTeam } from '../utils/teams';
import { formatNumber, shortModel } from '../utils/formatters';
import { getWeekKey, enumerateWeeks } from '../utils/weekKeys';
import type { Team, Member, PersonData } from '../types';

interface ByTeamProps {
  teams: Team[];
  members: Member[];
  people: PersonData[];
}

interface TeamRow {
  team: Team;
  membersTotal: number;
  membersWithData: number;
  totalRequests: number;
  totalLines: number;
  activeDaysAvg: number;
  reqPerDev: number;
  linesPerDev: number;
  adoption: number;
  topModel: string;
  planAvgPercent: number;
  planMembersWithSnapshot: number;
  planUsedSum: number;
  planLimitSum: number;
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

export default function ByTeam({ teams, members, people }: ByTeamProps) {
  const { t } = useT();
  const sorted = useMemo(() => sortedTeams(teams), [teams]);

  const rows = useMemo<TeamRow[]>(() => {
    return sorted.map((team) => {
      const teamMembers = membersOfTeam(members, team.id);
      const teamMemberIds = new Set(teamMembers.map((m) => m.id));
      const teamPeople = people.filter((p) => p.memberId && teamMemberIds.has(p.memberId));
      const totalRequests = teamPeople.reduce((s, p) => s + p.rows.length, 0);
      const totalLines = teamPeople.reduce(
        (s, p) => s + (p.dailyApiMetrics?.reduce((ss, m) => ss + m.linesAdded, 0) ?? 0),
        0,
      );
      const allDays = new Set<string>();
      const peopleWithData = new Set<string>();
      const modelCounts = new Map<string, number>();
      let activeDaysSum = 0;
      let activeDaysCount = 0;
      for (const p of teamPeople) {
        const days = new Set<string>();
        for (const r of p.rows) {
          days.add(r.dateStr);
          allDays.add(r.dateStr);
          modelCounts.set(r.model, (modelCounts.get(r.model) || 0) + 1);
        }
        for (const m of p.dailyApiMetrics ?? []) {
          if (m.agentRequests > 0) {
            days.add(m.dateStr);
            allDays.add(m.dateStr);
          }
        }
        if (days.size > 0) {
          peopleWithData.add(p.memberId!);
          activeDaysSum += days.size;
          activeDaysCount++;
        }
      }
      let topModel = '—';
      let topCount = 0;
      for (const [m, c] of modelCounts) {
        if (c > topCount) { topModel = shortModel(m); topCount = c; }
      }
      const membersTotal = teamMembers.length;
      const membersWithData = peopleWithData.size;
      let planUsedSum = 0;
      let planLimitSum = 0;
      let planPctSum = 0;
      let planMembersWithSnapshot = 0;
      for (const p of teamPeople) {
        if (p.planUsage) {
          planMembersWithSnapshot++;
          planUsedSum += p.planUsage.used || 0;
          planLimitSum += p.planUsage.limit || 0;
          planPctSum += p.planUsage.totalPercentUsed || 0;
        }
      }
      return {
        team,
        membersTotal,
        membersWithData,
        totalRequests,
        totalLines,
        activeDaysAvg: activeDaysCount > 0 ? activeDaysSum / activeDaysCount : 0,
        reqPerDev: membersTotal > 0 ? totalRequests / membersTotal : 0,
        linesPerDev: membersTotal > 0 ? totalLines / membersTotal : 0,
        adoption: membersTotal > 0 ? Math.round((membersWithData / membersTotal) * 100) : 0,
        topModel,
        planAvgPercent: planMembersWithSnapshot > 0 ? planPctSum / planMembersWithSnapshot : 0,
        planMembersWithSnapshot,
        planUsedSum,
        planLimitSum,
      };
    });
  }, [sorted, members, people]);

  const reqPerDevData = useMemo(
    () => rows.map((r) => ({ name: r.team.name, value: Math.round(r.reqPerDev), fill: r.team.color })),
    [rows],
  );
  const linesPerDevData = useMemo(
    () => rows.map((r) => ({ name: r.team.name, value: Math.round(r.linesPerDev), fill: r.team.color })),
    [rows],
  );
  const adoptionData = useMemo(
    () => rows.map((r) => ({ name: r.team.name, value: r.adoption, fill: r.team.color })),
    [rows],
  );
  const activeDaysData = useMemo(
    () => rows.map((r) => ({ name: r.team.name, value: Math.round(r.activeDaysAvg * 10) / 10, fill: r.team.color })),
    [rows],
  );

  const weeklyByTeam = useMemo(() => {
    const allWeeks = new Set<string>();
    const teamWeekMap = new Map<string, Map<string, number>>();
    const teamWeekLines = new Map<string, Map<string, number>>();
    for (const team of sorted) {
      teamWeekMap.set(team.id, new Map());
      teamWeekLines.set(team.id, new Map());
    }
    const memberToTeam = new Map(members.map((m) => [m.id, m.teamId]));
    for (const p of people) {
      const teamId = p.memberId ? memberToTeam.get(p.memberId) : undefined;
      if (!teamId) continue;
      for (const r of p.rows) {
        const w = getWeekKey(r.dateStr);
        allWeeks.add(w);
        const m = teamWeekMap.get(teamId);
        if (m) m.set(w, (m.get(w) ?? 0) + 1);
      }
      for (const dm of p.dailyApiMetrics ?? []) {
        const w = getWeekKey(dm.dateStr);
        allWeeks.add(w);
        const lm = teamWeekLines.get(teamId);
        if (lm) lm.set(w, (lm.get(w) ?? 0) + dm.linesAdded);
      }
    }
    const dataKeys = Array.from(allWeeks).sort();
    const sortedWeeks = dataKeys.length > 0
      ? enumerateWeeks(dataKeys[0], dataKeys[dataKeys.length - 1])
      : [];
    return sortedWeeks.map((w) => {
      const row: Record<string, string | number> = { week: w.slice(5) };
      for (const team of sorted) {
        row[team.id] = teamWeekMap.get(team.id)?.get(w) ?? 0;
        row[team.id + '_lines'] = teamWeekLines.get(team.id)?.get(w) ?? 0;
      }
      return row;
    });
  }, [sorted, members, people]);

  if (sorted.length === 0 || rows.every((r) => r.membersTotal === 0)) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#666', fontSize: 13 }}>
        {t('byTeam.empty')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {rows.map((r) => (
          <div
            key={r.team.id}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${r.team.color}40`,
              borderLeft: `3px solid ${r.team.color}`,
              borderRadius: 12,
              padding: '14px 14px 12px',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e0e0e0', marginBottom: 8 }}>{r.team.name}</div>
            <Stat label={t('byTeam.kpiReqPerDev')} value={formatNumber(Math.round(r.reqPerDev))} />
            <Stat label={t('byTeam.kpiLinesPerDev')} value={formatNumber(Math.round(r.linesPerDev))} />
            <Stat label={t('byTeam.kpiAdoption')} value={r.adoption + '%'} sub={`${r.membersWithData} / ${r.membersTotal}`} />
            <Stat label={t('byTeam.kpiActiveDays')} value={(Math.round(r.activeDaysAvg * 10) / 10).toString()} />
            <Stat label={t('byTeam.kpiTopModel')} value={r.topModel} />
            {r.planMembersWithSnapshot > 0 && (
              <Stat
                label={t('byTeam.kpiPlanUsage')}
                value={r.planAvgPercent.toFixed(1) + '%'}
                sub={`${r.planUsedSum.toLocaleString()} / ${r.planLimitSum.toLocaleString()} · ${r.planMembersWithSnapshot}/${r.membersTotal}`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ChartCard title={t('byTeam.kpiReqPerDev')} info={t('info.byTeam.kpiReqPerDev')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={reqPerDevData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#aaa' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {reqPerDevData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('byTeam.kpiLinesPerDev')} info={t('info.byTeam.kpiLinesPerDev')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={linesPerDevData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#aaa' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {linesPerDevData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('byTeam.kpiAdoption')} info={t('info.byTeam.kpiAdoption')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={adoptionData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} domain={[0, 100]} tickFormatter={(v) => v + '%'} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#aaa' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {adoptionData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('byTeam.kpiActiveDays')} info={t('info.byTeam.kpiActiveDays')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activeDaysData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#555' }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#aaa' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={16}>
                {activeDaysData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title={t('byTeam.weeklyRequests')} info={t('info.byTeam.weeklyRequests')}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyByTeam} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            {sorted.map((team) => (
              <Bar key={team.id} dataKey={team.id} stackId="a" name={team.name} fill={team.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t('byTeam.linesPerWeek')} info={t('info.byTeam.linesPerWeek')}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={weeklyByTeam} margin={{ bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
            <YAxis tick={{ fontSize: 11, fill: '#555' }} />
            <Tooltip content={<CustomTooltip />} />
            {sorted.map((team) => (
              <Bar key={team.id + 'L'} dataKey={team.id + '_lines'} stackId="b" name={team.name} fill={team.color} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color: '#e0e0e0', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
        {sub && <span style={{ fontSize: 10, color: '#666', fontWeight: 400, marginLeft: 6 }}>{sub}</span>}
      </span>
    </div>
  );
}
