import { useMemo } from 'react';

interface DateRangeSelectorProps {
  earliestDate: Date;
  latestDate: Date;
  rangeStart: Date;
  rangeEnd: Date;
  onChange: (start: Date, end: Date) => void;
}

const PRESETS: { label: string; hours: number }[] = [
  { label: '1h', hours: 1 },
  { label: '3h', hours: 3 },
  { label: '6h', hours: 6 },
  { label: '12h', hours: 12 },
  { label: '24h', hours: 24 },
  { label: '3d', hours: 72 },
  { label: '7d', hours: 168 },
  { label: '14d', hours: 336 },
  { label: '30d', hours: 720 },
];

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

function toMskLocal(d: Date): string {
  const msk = new Date(d.getTime() + MSK_OFFSET_MS);
  return msk.toISOString().slice(0, 16);
}

function fromMskLocal(s: string): Date {
  return new Date(new Date(s + ':00.000Z').getTime() - MSK_OFFSET_MS);
}

export default function DateRangeSelector({
  earliestDate,
  latestDate,
  rangeStart,
  rangeEnd,
  onChange,
}: DateRangeSelectorProps) {
  const isFullRange = rangeStart.getTime() <= earliestDate.getTime() && rangeEnd.getTime() >= latestDate.getTime();

  const activePreset = useMemo(() => {
    if (isFullRange) return 'all';
    for (const p of PRESETS) {
      const cutoff = new Date(latestDate.getTime() - p.hours * 60 * 60 * 1000);
      if (Math.abs(rangeStart.getTime() - cutoff.getTime()) < 60_000 && rangeEnd.getTime() >= latestDate.getTime()) {
        return p.label;
      }
    }
    return null;
  }, [rangeStart, rangeEnd, latestDate, earliestDate, isFullRange]);

  const applyPreset = (hours: number) => {
    const cutoff = new Date(latestDate.getTime() - hours * 60 * 60 * 1000);
    onChange(cutoff, latestDate);
  };

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
    background: active ? 'rgba(230,57,70,0.8)' : 'rgba(255,255,255,0.05)',
    color: active ? '#fff' : '#888',
  });

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '5px 10px',
    color: '#ccc',
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    outline: 'none',
    colorScheme: 'dark',
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      marginBottom: 20,
    }}>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.hours)}
          style={btnStyle(activePreset === p.label)}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => onChange(earliestDate, latestDate)}
        style={btnStyle(activePreset === 'all')}
      >
        All
      </button>

      <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)', margin: '0 6px' }} />

      <span style={{ fontSize: 11, color: '#555' }}>From</span>
      <input
        type="datetime-local"
        style={inputStyle}
        value={toMskLocal(rangeStart)}
        min={toMskLocal(earliestDate)}
        max={toMskLocal(latestDate)}
        onChange={(e) => {
          if (e.target.value) onChange(fromMskLocal(e.target.value), rangeEnd);
        }}
      />
      <span style={{ fontSize: 11, color: '#555' }}>To</span>
      <input
        type="datetime-local"
        style={inputStyle}
        value={toMskLocal(rangeEnd)}
        min={toMskLocal(earliestDate)}
        max={toMskLocal(latestDate)}
        onChange={(e) => {
          if (e.target.value) onChange(rangeStart, fromMskLocal(e.target.value));
        }}
      />
      <span style={{ fontSize: 10, color: '#444' }}>MSK</span>
    </div>
  );
}
