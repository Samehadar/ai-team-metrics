import { useState, useRef, useEffect, type ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  info?: string;
  children: ReactNode;
  className?: string;
}

export default function ChartCard({ title, info, children, className = '' }: ChartCardProps) {
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
      <h3
        style={{
          fontSize: 14,
          fontWeight: 600,
          margin: '0 0 20px',
          color: '#999',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{title}</span>
        {info && <InfoIcon text={info} />}
      </h3>
      {children}
    </div>
  );
}

function InfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<{ left: number; top: number; arrow: 'up' | 'down' } | null>(null);

  useEffect(() => {
    if (!open) {
      setPlacement(null);
      return;
    }
    const anchor = wrapperRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popupWidth = 280;
    const margin = 8;
    let left = rect.left + rect.width / 2 - popupWidth / 2;
    left = Math.max(margin, Math.min(window.innerWidth - popupWidth - margin, left));
    const desiredTop = rect.bottom + 8;
    const popupApproxHeight = 100;
    const arrow: 'up' | 'down' = desiredTop + popupApproxHeight > window.innerHeight ? 'down' : 'up';
    const top = arrow === 'up' ? desiredTop : rect.top - popupApproxHeight - 8;
    setPlacement({ left, top, arrow });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      style={{ display: 'inline-flex', position: 'relative' }}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label="info"
        onClick={(e) => {
          e.preventDefault();
          setOpen((v) => !v);
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.18)',
          background: open ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)',
          color: '#aaa',
          fontSize: 10,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          cursor: 'help',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          lineHeight: 1,
          transition: 'all 0.12s',
        }}
      >
        i
      </button>
      {open && placement && (
        <div
          ref={popupRef}
          role="tooltip"
          style={{
            position: 'fixed',
            left: placement.left,
            top: placement.top,
            width: 280,
            background: 'rgba(20,20,28,0.98)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: 12,
            fontWeight: 400,
            color: '#cfcfcf',
            lineHeight: 1.55,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 60,
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </span>
  );
}
