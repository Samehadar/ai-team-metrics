interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: string;
}

export default function KpiCard({ label, value, subtitle, accent }: KpiCardProps) {
  const tinted = accent
    ? `linear-gradient(135deg, ${hexToRgba(accent, 0.08)} 0%, rgba(255,255,255,0.025) 60%)`
    : 'rgba(255,255,255,0.03)';
  return (
    <div style={{
      position: 'relative',
      background: tinted,
      borderRadius: 14,
      padding: '18px 16px',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
    }}>
      {accent && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: 3,
            background: `linear-gradient(90deg, ${accent}, ${hexToRgba(accent, 0.2)})`,
          }}
        />
      )}
      <div style={{ fontSize: 11, color: accent ? hexToRgba(accent, 0.95) : '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#f0f0f0' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const m = hex.replace('#', '');
  const v = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
