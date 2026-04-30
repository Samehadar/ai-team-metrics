import { useT } from '../i18n/LanguageContext';

interface GuideProps {
  onStart: () => void;
  onTeams: () => void;
}

export default function Guide({ onStart, onTeams }: GuideProps) {
  const { t } = useT();

  const sections: { id: string; title: string; body: string[] }[] = [
    {
      id: 'data',
      title: t('guide.sec.data.title'),
      body: [t('guide.sec.data.p1'), t('guide.sec.data.p2'), t('guide.sec.data.p3')],
    },
    {
      id: 'teams',
      title: t('guide.sec.teams.title'),
      body: [t('guide.sec.teams.p1'), t('guide.sec.teams.p2'), t('guide.sec.teams.p3')],
    },
    {
      id: 'tabs',
      title: t('guide.sec.tabs.title'),
      body: [t('guide.sec.tabs.p1'), t('guide.sec.tabs.p2'), t('guide.sec.tabs.p3')],
    },
    {
      id: 'filters',
      title: t('guide.sec.filters.title'),
      body: [t('guide.sec.filters.p1'), t('guide.sec.filters.p2')],
    },
    {
      id: 'highlight',
      title: t('guide.sec.highlight.title'),
      body: [t('guide.sec.highlight.p1'), t('guide.sec.highlight.p2'), t('guide.sec.highlight.p3')],
    },
    {
      id: 'exports',
      title: t('guide.sec.exports.title'),
      body: [t('guide.sec.exports.p1'), t('guide.sec.exports.p2'), t('guide.sec.exports.p3')],
    },
    {
      id: 'privacy',
      title: t('guide.sec.privacy.title'),
      body: [t('guide.sec.privacy.p1'), t('guide.sec.privacy.p2')],
    },
    {
      id: 'shortcuts',
      title: t('guide.sec.shortcuts.title'),
      body: [t('guide.sec.shortcuts.p1')],
    },
  ];

  return (
    <div>
      <div
        style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>📘</span>
          <h2 style={{ fontSize: 18, margin: 0, color: '#e0e0e0', fontWeight: 600 }}>{t('guide.title')}</h2>
        </div>
        <p style={{ fontSize: 13, color: '#888', margin: 0, lineHeight: 1.6 }}>{t('guide.subtitle')}</p>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
          padding: '12px 14px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 6, alignSelf: 'center' }}>
          {t('guide.tocLabel')}
        </span>
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#guide-${s.id}`}
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById(`guide-${s.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 11,
              color: '#bbb',
              fontWeight: 500,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            {s.title}
          </a>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((s, i) => (
          <section
            key={s.id}
            id={`guide-${s.id}`}
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14,
              padding: '20px 22px',
              scrollMarginTop: 16,
            }}
          >
            <h3
              style={{
                fontSize: 15,
                margin: '0 0 12px',
                color: '#e0e0e0',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'baseline',
                gap: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: '#666',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 700,
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              {s.title}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {s.body.map((para, idx) => (
                <p
                  key={idx}
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: '#bbb',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-line',
                  }}
                >
                  {para}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div
        style={{
          marginTop: 22,
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: 13, color: '#aaa', flex: 1 }}>{t('guide.cta')}</span>
        <button onClick={onStart} style={btnPrimary}>
          {t('guide.ctaUpload')}
        </button>
        <button onClick={onTeams} style={btnSecondary}>
          {t('guide.ctaTeams')}
        </button>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.5)',
  background: 'rgba(230,57,70,0.18)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnSecondary: React.CSSProperties = {
  padding: '7px 14px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'transparent',
  color: '#ccc',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
