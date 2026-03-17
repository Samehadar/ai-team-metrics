interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
}

export default function KpiCard({ label, value, subtitle }: KpiCardProps) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      borderRadius: 14,
      padding: '18px 16px',
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: '#e0e0e0' }}>
        {value}
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{subtitle}</div>
      )}
    </div>
  );
}
