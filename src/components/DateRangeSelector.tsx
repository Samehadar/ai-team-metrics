import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n/LanguageContext';
import { DATE_LOCALE } from '../i18n/translations';

interface DateRangeSelectorProps {
  earliestDate: Date;
  latestDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  onChange: (start: Date, end: Date) => void;
}

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const MIN_TOL_MS = 60_000;

function mskParts(d: Date) {
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return {
    year: msk.getUTCFullYear(),
    month: msk.getUTCMonth(),
    day: msk.getUTCDate(),
    weekday: msk.getUTCDay(),
  };
}

function mskStartOfDay(d: Date): Date {
  const { year, month, day } = mskParts(d);
  return new Date(Date.UTC(year, month, day) - MSK_OFFSET_MS);
}

function mskEndOfDay(d: Date): Date {
  const { year, month, day } = mskParts(d);
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999) - MSK_OFFSET_MS);
}

function mskStartOfWeek(d: Date): Date {
  const { year, month, day, weekday } = mskParts(d);
  const offset = (weekday + 6) % 7;
  return new Date(Date.UTC(year, month, day - offset) - MSK_OFFSET_MS);
}

function mskStartOfMonth(d: Date): Date {
  const { year, month } = mskParts(d);
  return new Date(Date.UTC(year, month, 1) - MSK_OFFSET_MS);
}

function mskStartOfYear(d: Date): Date {
  const { year } = mskParts(d);
  return new Date(Date.UTC(year, 0, 1) - MSK_OFFSET_MS);
}

function toMskDateInput(d: Date): string {
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return msk.toISOString().slice(0, 10);
}

function fromMskDateInputStart(s: string): Date {
  return new Date(new Date(s + 'T00:00:00.000Z').getTime() - MSK_OFFSET_MS);
}

function fromMskDateInputEnd(s: string): Date {
  return new Date(new Date(s + 'T23:59:59.999Z').getTime() - MSK_OFFSET_MS);
}

function clamp(d: Date, min: Date, max: Date): Date {
  if (d.getTime() < min.getTime()) return min;
  if (d.getTime() > max.getTime()) return max;
  return d;
}

function approxEqual(a: Date, b: Date, tolMs = MIN_TOL_MS): boolean {
  return Math.abs(a.getTime() - b.getTime()) <= tolMs;
}

type PresetId = '24h' | '7d' | '30d' | '90d' | 'today' | 'week' | 'month' | 'ytd' | 'all';

interface Preset {
  id: PresetId;
  label: string;
  group: 'rolling' | 'calendar' | 'all';
  resolve: (latest: Date) => Date;
}

export default function DateRangeSelector({
  earliestDate,
  latestDate,
  rangeStart,
  rangeEnd,
  onChange,
}: DateRangeSelectorProps) {
  const { t, locale } = useT();
  const [expanded, setExpanded] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const presets = useMemo<Preset[]>(() => [
    { id: '24h', label: t('dateRange.24h'), group: 'rolling', resolve: (l) => new Date(l.getTime() - 24 * 3600 * 1000) },
    { id: '7d', label: t('dateRange.7d'), group: 'rolling', resolve: (l) => new Date(l.getTime() - 7 * 24 * 3600 * 1000) },
    { id: '30d', label: t('dateRange.30d'), group: 'rolling', resolve: (l) => new Date(l.getTime() - 30 * 24 * 3600 * 1000) },
    { id: '90d', label: t('dateRange.90d'), group: 'rolling', resolve: (l) => new Date(l.getTime() - 90 * 24 * 3600 * 1000) },
    { id: 'today', label: t('dateRange.today'), group: 'calendar', resolve: (l) => mskStartOfDay(l) },
    { id: 'week', label: t('dateRange.week'), group: 'calendar', resolve: (l) => mskStartOfWeek(l) },
    { id: 'month', label: t('dateRange.month'), group: 'calendar', resolve: (l) => mskStartOfMonth(l) },
    { id: 'ytd', label: t('dateRange.ytd'), group: 'calendar', resolve: (l) => mskStartOfYear(l) },
    { id: 'all', label: t('dateRange.all'), group: 'all', resolve: () => earliestDate },
  ], [t, earliestDate]);

  const isFullRange =
    rangeStart.getTime() <= earliestDate.getTime() + MIN_TOL_MS &&
    rangeEnd.getTime() >= latestDate.getTime() - MIN_TOL_MS;

  const activePreset = useMemo<PresetId | null>(() => {
    if (isFullRange) return 'all';
    if (!approxEqual(rangeEnd, latestDate)) return null;
    for (const p of presets) {
      if (p.id === 'all') continue;
      const start = clamp(p.resolve(latestDate), earliestDate, latestDate);
      if (approxEqual(rangeStart, start)) return p.id;
    }
    return null;
  }, [presets, rangeStart, rangeEnd, latestDate, earliestDate, isFullRange]);

  useEffect(() => {
    if (!expanded) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setExpanded(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEsc);
    };
  }, [expanded]);

  const applyPreset = (p: Preset) => {
    if (p.id === 'all') {
      onChange(earliestDate, latestDate);
      return;
    }
    const start = clamp(p.resolve(latestDate), earliestDate, latestDate);
    onChange(start, latestDate);
  };

  const fmt = useMemo(() =>
    new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      day: 'numeric',
      month: 'short',
      year: rangeStart.getFullYear() === rangeEnd.getFullYear() ? undefined : 'numeric',
      timeZone: 'Europe/Moscow',
    }), [locale, rangeStart, rangeEnd]);
  const fmtFull = useMemo(() =>
    new Intl.DateTimeFormat(DATE_LOCALE[locale], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Moscow',
    }), [locale]);

  const summaryRange = `${fmt.format(rangeStart)} → ${fmtFull.format(rangeEnd)}`;
  const totalDays = Math.max(
    1,
    Math.round((mskStartOfDay(rangeEnd).getTime() - mskStartOfDay(rangeStart).getTime()) / 86400000) + 1,
  );
  const daysLabel = t('dateRange.days', totalDays);

  return (
    <div style={containerStyle}>
      <div style={chipsRowStyle}>
        {presets.filter((p) => p.group === 'rolling').map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} style={chipStyle(activePreset === p.id)}>
            {p.label}
          </button>
        ))}
        <span style={dividerStyle} />
        {presets.filter((p) => p.group === 'calendar').map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} style={chipStyle(activePreset === p.id)}>
            {p.label}
          </button>
        ))}
        <span style={dividerStyle} />
        {presets.filter((p) => p.group === 'all').map((p) => (
          <button key={p.id} onClick={() => applyPreset(p)} style={chipStyle(activePreset === p.id)}>
            {p.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div style={summaryWrapperStyle} ref={popoverRef}>
          <button
            onClick={() => setExpanded((v) => !v)}
            style={summaryButtonStyle(expanded)}
            aria-expanded={expanded}
            title={t('dateRange.customTooltip')}
          >
            <span style={summaryIconStyle}>📅</span>
            <span style={summaryRangeStyle}>{summaryRange}</span>
            <span style={summaryDaysStyle}>{daysLabel}</span>
            <span style={summaryTzStyle}>MSK</span>
            <span style={summaryCaretStyle(expanded)}>▾</span>
          </button>

          {expanded && (
            <div style={popoverStyle}>
              <div style={popoverRowStyle}>
                <label style={popoverLabelStyle}>{t('dateRange.from')}</label>
                <input
                  type="date"
                  style={popoverInputStyle}
                  value={toMskDateInput(rangeStart)}
                  min={toMskDateInput(earliestDate)}
                  max={toMskDateInput(rangeEnd)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onChange(fromMskDateInputStart(e.target.value), rangeEnd);
                  }}
                />
              </div>
              <div style={popoverRowStyle}>
                <label style={popoverLabelStyle}>{t('dateRange.to')}</label>
                <input
                  type="date"
                  style={popoverInputStyle}
                  value={toMskDateInput(rangeEnd)}
                  min={toMskDateInput(rangeStart)}
                  max={toMskDateInput(latestDate)}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onChange(rangeStart, fromMskDateInputEnd(e.target.value));
                  }}
                />
              </div>
              <div style={popoverFooterStyle}>
                <button
                  style={popoverGhostBtnStyle}
                  onClick={() => onChange(earliestDate, latestDate)}
                >
                  {t('dateRange.reset')}
                </button>
                <button
                  style={popoverApplyBtnStyle}
                  onClick={() => setExpanded(false)}
                >
                  {t('dateRange.done')}
                </button>
              </div>
              <div style={popoverHintStyle}>
                {t('dateRange.dataRangeHint', fmtFull.format(earliestDate), fmtFull.format(latestDate))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  marginBottom: 20,
};

const chipsRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
  padding: '8px 10px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 12,
};

const dividerStyle: React.CSSProperties = {
  width: 1,
  height: 18,
  background: 'rgba(255,255,255,0.08)',
  margin: '0 4px',
  flexShrink: 0,
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: '5px 11px',
  borderRadius: 8,
  border: active ? '1px solid rgba(230,57,70,0.5)' : '1px solid transparent',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  transition: 'all 0.15s',
  background: active ? 'rgba(230,57,70,0.18)' : 'transparent',
  color: active ? '#fff' : '#888',
});

const summaryWrapperStyle: React.CSSProperties = {
  position: 'relative',
};

const summaryButtonStyle = (open: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 10px',
  borderRadius: 8,
  border: '1px solid ' + (open ? 'rgba(230,57,70,0.4)' : 'rgba(255,255,255,0.08)'),
  background: open ? 'rgba(230,57,70,0.08)' : 'rgba(255,255,255,0.03)',
  color: '#ccc',
  fontSize: 12,
  fontWeight: 500,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.15s',
});

const summaryIconStyle: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.85,
};

const summaryRangeStyle: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  color: '#e0e0e0',
  whiteSpace: 'nowrap',
};

const summaryDaysStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#888',
  padding: '1px 6px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.05)',
};

const summaryTzStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#666',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const summaryCaretStyle = (open: boolean): React.CSSProperties => ({
  fontSize: 10,
  color: '#777',
  transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: 'transform 0.15s',
});

const popoverStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 6px)',
  minWidth: 280,
  background: '#15151c',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 12,
  padding: 14,
  boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const popoverRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const popoverLabelStyle: React.CSSProperties = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.6,
  color: '#888',
  fontWeight: 600,
};

const popoverInputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#e0e0e0',
  fontSize: 12,
  fontFamily: "'JetBrains Mono', monospace",
  outline: 'none',
  colorScheme: 'dark',
};

const popoverFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 4,
  paddingTop: 10,
  borderTop: '1px solid rgba(255,255,255,0.06)',
};

const popoverGhostBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#aaa',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const popoverApplyBtnStyle: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.5)',
  background: 'rgba(230,57,70,0.18)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const popoverHintStyle: React.CSSProperties = {
  fontSize: 10,
  color: '#666',
  fontFamily: "'JetBrains Mono', monospace",
};
