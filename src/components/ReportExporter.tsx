import { useState, useRef, useCallback, useEffect } from 'react';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  ResponsiveContainer, PieChart, Pie, Legend,
  AreaChart, Area,
} from 'recharts';
import { getPersonSummary, getGlobalSummary, getAllDates } from '../utils/dataAggregator';
import { formatTokens, formatNumber, shortModel, shortName, COLORS } from '../utils/formatters';
import type { PersonData } from '../types';

interface ReportExporterProps {
  people: PersonData[];
  rangeStart: Date;
  rangeEnd: Date;
}

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function formatMskDate(d: Date): string {
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return msk.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function ReportExporter({ people, rangeStart, rangeEnd }: ReportExporterProps) {
  const [generating, setGenerating] = useState(false);
  const [renderReady, setRenderReady] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!generating) { setRenderReady(false); return; }
    const timer = setTimeout(() => setRenderReady(true), 600);
    return () => clearTimeout(timer);
  }, [generating]);

  useEffect(() => {
    if (!renderReady || !reportRef.current) return;
    (async () => {
      try {

        const canvas = await html2canvas(reportRef.current, {
          scale: 2,
          backgroundColor: '#0a0a0f',
          useCORS: true,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');
        const imgW = canvas.width;
        const imgH = canvas.height;

        const pdfW = 210;
        const pdfMargin = 10;
        const contentW = pdfW - pdfMargin * 2;
        const contentH = (imgH * contentW) / imgW;
        const pageH = 297;
        const usableH = pageH - pdfMargin * 2;

        const pdf = new jsPDF('p', 'mm', 'a4');

        if (contentH <= usableH) {
          pdf.addImage(imgData, 'PNG', pdfMargin, pdfMargin, contentW, contentH);
        } else {
          let yOffset = 0;
          let page = 0;
          while (yOffset < contentH) {
            if (page > 0) pdf.addPage();

            const srcY = (yOffset / contentH) * imgH;
            const srcH = Math.min((usableH / contentH) * imgH, imgH - srcY);
            const drawH = (srcH / imgH) * contentH;

            const sliceCanvas = document.createElement('canvas');
            sliceCanvas.width = imgW;
            sliceCanvas.height = Math.ceil(srcH);
            const ctx = sliceCanvas.getContext('2d')!;
            ctx.drawImage(canvas, 0, srcY, imgW, srcH, 0, 0, imgW, srcH);

            const sliceData = sliceCanvas.toDataURL('image/png');
            pdf.addImage(sliceData, 'PNG', pdfMargin, pdfMargin, contentW, drawH);

            yOffset += usableH;
            page++;
          }
        }

        const dateStr = new Date().toISOString().split('T')[0];
        pdf.save(`cursor-analytics-report-${dateStr}.pdf`);
      } catch (err) {
        console.error('PDF generation failed:', err);
      } finally {
        setGenerating(false);
      }
    })();
  }, [renderReady]);

  const generate = useCallback(() => {
    if (!generating) setGenerating(true);
  }, [generating]);

  return (
    <>
      <button
        onClick={generate}
        disabled={generating}
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.1)',
          background: generating ? 'rgba(230,57,70,0.15)' : 'transparent',
          color: generating ? '#e63946' : '#888',
          fontSize: 12,
          cursor: generating ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          transition: 'all 0.2s',
        }}
      >
        {generating ? 'Генерация...' : 'Экспорт PDF'}
      </button>

      {generating && (
        <ReportContent
          ref={reportRef}
          people={people}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
        />
      )}
    </>
  );
}

interface ReportContentProps {
  people: PersonData[];
  rangeStart: Date;
  rangeEnd: Date;
}

import { forwardRef } from 'react';

const ReportContent = forwardRef<HTMLDivElement, ReportContentProps>(
  function ReportContent({ people, rangeStart, rangeEnd }, ref) {

  const global = getGlobalSummary(people);
  const totalDays = getAllDates(people).length || 1;
  const summaries = people
    .map((p) => getPersonSummary(p))
    .sort((a, b) => b.totalRequests - a.totalRequests);

  const requestsData = summaries.map((s, i) => ({
    name: shortName(s.name),
    requests: s.totalRequests,
    fill: COLORS[i % COLORS.length],
  }));

  const allModels = new Map<string, number>();
  for (const p of people) {
    for (const r of p.rows) {
      allModels.set(r.model, (allModels.get(r.model) || 0) + 1);
    }
  }
  const modelData = Array.from(allModels.entries())
    .map(([model, count]) => ({ name: shortModel(model), value: count }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const allDates = getAllDates(people);
  const areaData = allDates.map((date) => {
    let total = 0;
    for (const s of summaries) {
      const day = s.dailyActivity.find((d) => d.date === date);
      total += day?.count || 0;
    }
    return { date: date.slice(5), count: total };
  });

  const hasApiData = people.some((p) => (p.dailyApiMetrics?.length ?? 0) > 0);
  let codeKpi = { linesAdded: 0, linesDeleted: 0, acceptRate: 0, tabRate: 0, acceptedAdded: 0 };
  if (hasApiData) {
    const all = people.flatMap((p) => p.dailyApiMetrics ?? []);
    const linesAdded = all.reduce((s, m) => s + m.linesAdded, 0);
    const linesDeleted = all.reduce((s, m) => s + m.linesDeleted, 0);
    const acceptedAdded = all.reduce((s, m) => s + m.acceptedLinesAdded, 0);
    const totalApplies = all.reduce((s, m) => s + m.totalApplies, 0);
    const totalAccepts = all.reduce((s, m) => s + m.totalAccepts, 0);
    const tabsShown = all.reduce((s, m) => s + m.totalTabsShown, 0);
    const tabsAccepted = all.reduce((s, m) => s + m.totalTabsAccepted, 0);
    codeKpi = {
      linesAdded,
      linesDeleted,
      acceptedAdded,
      acceptRate: totalApplies > 0 ? Math.round((totalAccepts / totalApplies) * 100) : 0,
      tabRate: tabsShown > 0 ? Math.round((tabsAccepted / tabsShown) * 100) : 0,
    };
  }

  // Segmentation
  const segmentation = (() => {
    const result: { name: string; avgPerDay: number; segment: string; color: string }[] = [];
    for (const p of people) {
      const personDates = new Set(p.rows.map((r) => r.dateStr));
      let totalReq = p.rows.length;
      if (totalReq === 0 && p.dailyApiMetrics?.length) {
        for (const m of p.dailyApiMetrics) {
          personDates.add(m.dateStr);
          totalReq += m.agentRequests;
        }
      }
      const activeDays = personDates.size || 1;
      const avg = totalReq / activeDays;
      let segment: string, color: string;
      if (avg >= 30) { segment = 'Power'; color = '#e63946'; }
      else if (avg >= 5) { segment = 'Regular'; color = '#2a9d8f'; }
      else if (totalReq > 0) { segment = 'Low'; color = '#e9c46a'; }
      else { segment = 'Inactive'; color = '#555'; }
      result.push({ name: p.name, avgPerDay: avg, segment, color });
    }
    return result.sort((a, b) => b.avgPerDay - a.avgPerDay);
  })();

  const segCounts = {
    power: segmentation.filter((s) => s.segment === 'Power').length,
    regular: segmentation.filter((s) => s.segment === 'Regular').length,
    low: segmentation.filter((s) => s.segment === 'Low').length,
    inactive: segmentation.filter((s) => s.segment === 'Inactive').length,
  };

  // Week-hour heatmap grid
  const heatGrid = (() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const p of people) {
      for (const r of p.rows) {
        const d = new Date(r.dateStr + 'T12:00:00');
        const dow = (d.getDay() + 6) % 7;
        if (dow >= 0 && dow < 7 && r.hour >= 0 && r.hour < 24) {
          g[dow][r.hour]++;
        }
      }
    }
    return g;
  })();
  const heatMax = Math.max(1, ...heatGrid.flat());

  // Code impact per developer
  const codeImpactRows = hasApiData
    ? people
        .filter((p) => (p.dailyApiMetrics?.length ?? 0) > 0)
        .map((p) => {
          const m = p.dailyApiMetrics!;
          const added = m.reduce((s, d) => s + d.linesAdded, 0);
          const deleted = m.reduce((s, d) => s + d.linesDeleted, 0);
          const applies = m.reduce((s, d) => s + d.totalApplies, 0);
          const accepts = m.reduce((s, d) => s + d.totalAccepts, 0);
          const agentReq = m.reduce((s, d) => s + d.agentRequests, 0);
          return {
            name: p.name,
            added,
            deleted,
            rate: applies > 0 ? Math.round((accepts / applies) * 100) : 0,
            linesPerReq: agentReq > 0 ? Math.round(added / agentReq) : 0,
          };
        })
        .sort((a, b) => b.added - a.added)
    : [];

  const S: Record<string, React.CSSProperties> = {
    page: {
      width: 800,
      padding: 40,
      background: '#0a0a0f',
      color: '#e0e0e0',
      fontFamily: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
    },
    title: {
      fontSize: 28,
      fontWeight: 700,
      margin: 0,
      color: '#fff',
    },
    subtitle: {
      fontSize: 13,
      color: '#888',
      margin: '6px 0 0',
    },
    date: {
      fontSize: 12,
      color: '#555',
      margin: '4px 0 28px',
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 600,
      color: '#aaa',
      margin: '28px 0 14px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      paddingBottom: 8,
    },
    kpiGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
    },
    kpiCard: {
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      padding: '14px 14px',
      border: '1px solid rgba(255,255,255,0.06)',
    },
    kpiLabel: {
      fontSize: 10,
      color: '#666',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
      marginBottom: 6,
    },
    kpiValue: {
      fontSize: 22,
      fontWeight: 700,
      fontFamily: "'JetBrains Mono', monospace",
      color: '#e0e0e0',
    },
    kpiSub: {
      fontSize: 10,
      color: '#555',
      marginTop: 2,
    },
    chartRow: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 16,
      marginTop: 16,
    },
    footer: {
      marginTop: 32,
      paddingTop: 16,
      borderTop: '1px solid rgba(255,255,255,0.06)',
      fontSize: 11,
      color: '#444',
      textAlign: 'center' as const,
    },
  };

  return (
    <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
      <div ref={ref} style={S.page}>
        <h1 style={S.title}>Cursor Analytics — Отчёт</h1>
          <p style={S.subtitle}>
            Использование AI-моделей командой · {formatMskDate(rangeStart)} — {formatMskDate(rangeEnd)}
          </p>
          <p style={S.date}>
            Сгенерировано: {formatMskDate(new Date())} · {global.totalDevelopers} разработчиков
          </p>

          {/* KPI cards */}
          <div style={S.kpiGrid}>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Запросов</div>
              <div style={S.kpiValue}>{formatNumber(global.totalRequests)}</div>
              <div style={S.kpiSub}>за период</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Токенов</div>
              <div style={S.kpiValue}>{formatTokens(global.totalTokens)}</div>
              <div style={S.kpiSub}>потрачено</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Среднее / день</div>
              <div style={S.kpiValue}>{Math.round(global.totalRequests / totalDays)}</div>
              <div style={S.kpiSub}>запросов</div>
            </div>
            <div style={S.kpiCard}>
              <div style={S.kpiLabel}>Активных дней</div>
              <div style={S.kpiValue}>{totalDays}</div>
              <div style={S.kpiSub}>дней с запросами</div>
            </div>
          </div>

          {hasApiData && (
            <div style={{ ...S.kpiGrid, marginTop: 12, gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Строк добавлено</div>
                <div style={S.kpiValue}>{codeKpi.linesAdded.toLocaleString()}</div>
                <div style={S.kpiSub}>через AI</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Accept Rate</div>
                <div style={S.kpiValue}>{codeKpi.acceptRate}%</div>
                <div style={S.kpiSub}>принятых предложений</div>
              </div>
              <div style={S.kpiCard}>
                <div style={S.kpiLabel}>Tab Completion</div>
                <div style={S.kpiValue}>{codeKpi.tabRate}%</div>
                <div style={S.kpiSub}>автодополнений</div>
              </div>
            </div>
          )}

          {/* Requests per developer */}
          <h3 style={S.sectionTitle}>Запросы по разработчикам</h3>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={requestsData} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 11, fill: '#666' }} />
                <Bar dataKey="requests" radius={[5, 5, 0, 0]}>
                  {requestsData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={S.chartRow}>
            {/* Daily activity */}
            <div>
              <h3 style={{ ...S.sectionTitle, marginTop: 12 }}>Активность по дням</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={areaData} margin={{ bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666' }} angle={-40} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10, fill: '#666' }} />
                    <Area type="monotone" dataKey="count" stroke="#e63946" fill="#e63946" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Models pie */}
            <div>
              <h3 style={{ ...S.sectionTitle, marginTop: 12 }}>Модели</h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={modelData}
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={35}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={2}
                    >
                      {modelData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Segmentation */}
          <h3 style={S.sectionTitle}>Сегментация команды</h3>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Power (>30/день)', count: segCounts.power, color: '#e63946' },
              { label: 'Regular (5–30)', count: segCounts.regular, color: '#2a9d8f' },
              { label: 'Low (1–5)', count: segCounts.low, color: '#e9c46a' },
              { label: 'Inactive', count: segCounts.inactive, color: '#555' },
            ].map((seg) => (
              <div key={seg.label} style={{ flex: 1, ...S.kpiCard, textAlign: 'center' as const }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: seg.color, margin: '0 auto 6px' }} />
                <div style={{ fontSize: 20, fontWeight: 700, color: '#e0e0e0', fontFamily: "'JetBrains Mono', monospace" }}>
                  {seg.count}
                </div>
                <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>{seg.label}</div>
              </div>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 4 }}>
            <tbody>
              {segmentation.map((s) => (
                <tr key={s.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '5px 6px', color: '#bbb', width: 180 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: s.color, marginRight: 8 }} />
                    {s.name}
                  </td>
                  <td style={{ padding: '5px 6px', color: '#888', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.avgPerDay.toFixed(1)} req/день
                  </td>
                  <td style={{ padding: '5px 6px', color: '#666' }}>{s.segment}</td>
                  <td style={{ padding: '5px 0' }}>
                    <div style={{
                      height: 6, borderRadius: 3, background: s.color,
                      width: `${Math.min(100, (s.avgPerDay / Math.max(1, segmentation[0]?.avgPerDay)) * 100)}%`,
                      opacity: 0.7,
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Week × Hour heatmap */}
          <h3 style={S.sectionTitle}>Когда команда использует AI (день недели × час, MSK)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7, 1fr)', gap: 2 }}>
            <div />
            {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
              <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#888', paddingBottom: 3 }}>{d}</div>
            ))}
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ display: 'contents' }}>
                <div style={{
                  fontSize: 9, color: '#555', textAlign: 'right', paddingRight: 6, lineHeight: '10px',
                  fontFamily: "'JetBrains Mono', monospace",
                  visibility: h % 6 === 0 ? 'visible' : 'hidden',
                }}>
                  {h.toString().padStart(2, '0')}:00
                </div>
                {Array.from({ length: 7 }, (_, dow) => {
                  const val = heatGrid[dow][h];
                  const t = val / heatMax;
                  const bg = t === 0
                    ? 'rgba(255,255,255,0.03)'
                    : `rgb(${Math.round(120 + t * 120)}, ${Math.round(50 - t * 30)}, ${Math.round(180 + t * 75)})`;
                  return <div key={dow} style={{ height: 10, borderRadius: 2, background: bg }} />;
                })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, fontSize: 10, color: '#555' }}>
            <span>Мало</span>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <div key={t} style={{
                width: 12, height: 12, borderRadius: 3,
                background: t === 0 ? 'rgba(255,255,255,0.03)' : `rgb(${Math.round(120 + t * 120)}, ${Math.round(50 - t * 30)}, ${Math.round(180 + t * 75)})`,
              }} />
            ))}
            <span>Много</span>
          </div>

          {/* Per-developer table */}
          <h3 style={S.sectionTitle}>Детализация по разработчикам</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Разработчик</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Запросы</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Актив. дней</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Сред./день</th>
                <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Токены</th>
                <th style={{ textAlign: 'left', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Топ модель</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s, i) => (
                <tr key={s.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '7px 6px', color: '#ccc', fontWeight: 500 }}>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], marginRight: 8 }} />
                    {s.name}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.totalRequests.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.activeDays}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                    {s.avgRequestsPerDay.toFixed(1)}
                  </td>
                  <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatTokens(s.totalTokens)}
                  </td>
                  <td style={{ padding: '7px 6px', color: '#888' }}>
                    {s.modelUsage[0] ? shortModel(s.modelUsage[0].model) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Code Impact per developer */}
          {codeImpactRows.length > 0 && (
            <>
              <h3 style={S.sectionTitle}>Code Impact по разработчикам</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Разработчик</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Строк +</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Строк −</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Accept Rate</th>
                    <th style={{ textAlign: 'right', padding: '8px 6px', color: '#666', fontWeight: 500 }}>Строк/запрос</th>
                  </tr>
                </thead>
                <tbody>
                  {codeImpactRows.map((r) => (
                    <tr key={r.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '7px 6px', color: '#ccc', fontWeight: 500 }}>{r.name}</td>
                      <td style={{ textAlign: 'right', padding: '7px 6px', color: '#2a9d8f', fontFamily: "'JetBrains Mono', monospace" }}>
                        +{r.added.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '7px 6px', color: '#e63946', fontFamily: "'JetBrains Mono', monospace" }}>
                        −{r.deleted.toLocaleString()}
                      </td>
                      <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.rate}%
                      </td>
                      <td style={{ textAlign: 'right', padding: '7px 6px', color: '#aaa', fontFamily: "'JetBrains Mono', monospace" }}>
                        {r.linesPerReq}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <td style={{ padding: '7px 6px', color: '#888', fontWeight: 600 }}>Итого</td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: '#2a9d8f', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      +{codeKpi.linesAdded.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: '#e63946', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      −{codeKpi.linesDeleted.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', padding: '7px 6px', color: '#fff', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                      {codeKpi.acceptRate}%
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </>
          )}

        <div style={S.footer}>
          Cursor Analytics · Автоматически сгенерированный отчёт · {formatMskDate(new Date())}
        </div>
      </div>
    </div>
  );
});
