import { initials, shortName } from '../utils/formatters';
import type { HighlightApi } from '../utils/useHighlight';

interface CommonLabelProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { fullName?: string; name?: string } | undefined;
  value?: any;
  fullNameKey?: string;
  index?: number;
  data?: Array<{ fullName?: string; name?: string }>;
}

function pickName(props: CommonLabelProps): string {
  const fromPayload = props.payload?.fullName ?? props.payload?.name;
  if (fromPayload) return String(fromPayload);
  if (typeof props.index === 'number' && props.data && props.data[props.index]) {
    return String(props.data[props.index].fullName ?? props.data[props.index].name ?? '');
  }
  return '';
}

export function HorizontalBarInitials(props: CommonLabelProps) {
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const width = props.width ?? 0;
  const height = props.height ?? 0;
  if (height < 14) return null;
  const name = pickName(props);
  if (!name) return null;
  const init = initials(name);
  const r = Math.min(11, Math.max(7, Math.floor(height / 2) - 1));
  const insideOk = width > r * 2 + 6;
  const cx = insideOk ? x + width - r - 4 : x + width + r + 5;
  const cy = y + height / 2;
  const ringFill = insideOk ? 'rgba(0,0,0,0.42)' : 'rgba(255,255,255,0.12)';
  const textFill = insideOk ? '#fff' : '#ddd';
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={r} fill={ringFill} />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textFill}
        fontSize={Math.max(8, r)}
        fontWeight={700}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {init}
      </text>
    </g>
  );
}

export function VerticalBarInitials(props: CommonLabelProps) {
  const x = props.x ?? 0;
  const y = props.y ?? 0;
  const width = props.width ?? 0;
  const height = props.height ?? 0;
  if (height < 22 || width < 16) return null;
  const name = pickName(props);
  if (!name) return null;
  const init = initials(name);
  const r = Math.min(10, Math.floor(width / 2) - 2);
  if (r < 6) return null;
  const cx = x + width / 2;
  const cy = y + r + 4;
  return (
    <g pointerEvents="none">
      <circle cx={cx} cy={cy} r={r} fill="rgba(0,0,0,0.45)" />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={Math.max(8, r)}
        fontWeight={700}
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        {init}
      </text>
    </g>
  );
}

interface ChipProps {
  name: string;
  color: string;
  active?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function PersonChip({ name, color, active, dimmed, onClick, onMouseEnter, onMouseLeave }: ChipProps) {
  const init = initials(name);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={name}
      aria-pressed={active ? true : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '3px 8px 3px 3px',
        background: active ? `${color}33` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active ? color : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 999,
        cursor: 'pointer',
        fontSize: 11,
        color: dimmed ? '#666' : '#ccc',
        opacity: dimmed ? 0.5 : 1,
        fontFamily: 'inherit',
        transition: 'opacity 0.12s, background 0.12s',
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {init}
      </span>
      {name}
    </button>
  );
}

interface IsolationBannerProps {
  hl: HighlightApi;
  labelTemplate: (name: string) => string;
  clearLabel: string;
}

export function IsolationBanner({ hl, labelTemplate, clearLabel }: IsolationBannerProps) {
  if (!hl.isolated) return null;
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 16,
        margin: '0 auto',
        padding: '6px 14px',
        background: 'rgba(15,15,20,0.95)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        fontSize: 11,
        color: '#ccc',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        width: 'fit-content',
        zIndex: 5,
      }}
    >
      <span>{labelTemplate(shortName(hl.isolated))}</span>
      <button
        type="button"
        onClick={() => hl.toggleIsolated(hl.isolated)}
        style={{
          padding: '2px 8px',
          borderRadius: 999,
          border: '1px solid rgba(255,255,255,0.15)',
          background: 'transparent',
          color: '#bbb',
          fontSize: 10,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {clearLabel}
      </button>
    </div>
  );
}

interface PersonLegendProps {
  names: string[];
  colorOf: (name: string) => string;
  hl: HighlightApi;
}

export function PersonLegend({ names, colorOf, hl }: PersonLegendProps) {
  if (names.length === 0) return null;
  return (
    <div
      onMouseLeave={() => hl.setHovered(null)}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}
    >
      {names.map((name) => {
        const active = hl.isolated === name || (!hl.isolated && hl.hovered === name);
        const dimmed =
          (hl.isolated && hl.isolated !== name) || (!hl.isolated && !!hl.hovered && hl.hovered !== name);
        return (
          <PersonChip
            key={name}
            name={shortName(name)}
            color={colorOf(name)}
            active={active}
            dimmed={dimmed}
            onClick={() => hl.toggleIsolated(name)}
            onMouseEnter={() => hl.setHovered(name)}
            onMouseLeave={() => hl.setHovered(null)}
          />
        );
      })}
    </div>
  );
}
