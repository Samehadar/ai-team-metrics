import type { ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, children, className = '' }: ChartCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 16,
        padding: 24,
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 20px', color: '#999' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}
