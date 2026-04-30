import { useMemo, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import ChartCard from './ChartCard';

interface DataPoint {
  dateStr: string;
  hour: number;
  count?: number;
}

interface WeekHourHeatmapProps {
  data: DataPoint[];
  title: string;
  tooltipPctKey?: string;
}

const HOUR_LABELS = Array.from({ length: 24 }, (_, i) =>
  i.toString().padStart(2, '0') + ':00',
);

function getDowIndex(dateStr: string): number {
  const d = new Date(dateStr + 'T12:00:00');
  return (d.getDay() + 6) % 7; // Mon=0 … Sun=6
}

function interpolateColor(t: number): string {
  if (t === 0) return 'rgba(255,255,255,0.03)';
  const r = Math.round(120 + t * 120);
  const g = Math.round(50 - t * 30);
  const b = Math.round(180 + t * 75);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function WeekHourHeatmap({
  data,
  title,
  tooltipPctKey = 'heatmap.requestsPct',
}: WeekHourHeatmapProps) {
  const { t } = useT();
  const DAY_LABELS = useMemo(() => [
    t('day.mon'), t('day.tue'), t('day.wed'), t('day.thu'),
    t('day.fri'), t('day.sat'), t('day.sun'),
  ], [t]);
  const [hoveredCell, setHoveredCell] = useState<{ dow: number; hour: number } | null>(null);

  const { grid, maxVal } = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));

    for (const point of data) {
      const dow = getDowIndex(point.dateStr);
      const h = point.hour;
      if (dow >= 0 && dow < 7 && h >= 0 && h < 24) {
        g[dow][h] += point.count ?? 1;
      }
    }

    const max = Math.max(1, ...g.flat());
    return { grid: g, maxVal: max };
  }, [data]);

  const totalRequests = useMemo(() => grid.flat().reduce((s, v) => s + v, 0), [grid]);

  const tooltipText = useMemo(() => {
    if (!hoveredCell) return '';
    const val = grid[hoveredCell.dow][hoveredCell.hour];
    const pct = totalRequests > 0 ? ((val / totalRequests) * 100).toFixed(1) : '0';
    return `${DAY_LABELS[hoveredCell.dow]} ${HOUR_LABELS[hoveredCell.hour]} — ${t(tooltipPctKey, val, pct)}`;
  }, [hoveredCell, grid, totalRequests, DAY_LABELS, t, tooltipPctKey]);

  return (
    <ChartCard title={title}>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 12, height: 16 }}>
          {tooltipText || t('heatmap.utc3')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '50px repeat(7, 1fr)', gap: 2 }}>
          {/* Header row: day labels */}
          <div />
          {DAY_LABELS.map((label) => (
            <div
              key={label}
              style={{
                textAlign: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: '#888',
                paddingBottom: 4,
              }}
            >
              {label}
            </div>
          ))}

          {/* Grid rows: one per hour */}
          {HOUR_LABELS.map((hourLabel, h) => {
            const showLabel = h % 6 === 0;
            return (
              <div key={h} style={{ display: 'contents' }}>
                <div
                  style={{
                    fontSize: 10,
                    color: '#555',
                    textAlign: 'right',
                    paddingRight: 8,
                    lineHeight: '11px',
                    fontFamily: "'JetBrains Mono', monospace",
                    visibility: showLabel ? 'visible' : 'hidden',
                  }}
                >
                  {hourLabel}
                </div>
                {DAY_LABELS.map((_, dow) => {
                  const val = grid[dow][h];
                  const heat = val / maxVal;
                  const isHovered =
                    hoveredCell?.dow === dow && hoveredCell?.hour === h;
                  return (
                    <div
                      key={dow}
                      onMouseEnter={() => setHoveredCell({ dow, hour: h })}
                      onMouseLeave={() => setHoveredCell(null)}
                      style={{
                        height: 11,
                        borderRadius: 3,
                        background: interpolateColor(heat),
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        transform: isHovered ? 'scale(1.15)' : 'none',
                        boxShadow: isHovered
                          ? '0 0 8px rgba(180, 60, 255, 0.5)'
                          : 'none',
                        cursor: 'default',
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 10,
            fontSize: 11,
            color: '#666',
          }}
        >
          <span>{t('heatmap.low')}</span>
          {[0, 0.2, 0.4, 0.6, 0.8, 1].map((step) => (
            <div
              key={step}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: interpolateColor(step),
              }}
            />
          ))}
          <span>{t('heatmap.high')}</span>
        </div>
      </div>
    </ChartCard>
  );
}
