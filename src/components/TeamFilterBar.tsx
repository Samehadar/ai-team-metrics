import { useT } from '../i18n/LanguageContext';
import { sortedTeams } from '../utils/teams';
import type { Team } from '../types';

interface TeamFilterBarProps {
  teams: Team[];
  selectedTeamIds: string[] | null;
  onChange: (next: string[] | null) => void;
}

export default function TeamFilterBar({ teams, selectedTeamIds, onChange }: TeamFilterBarProps) {
  const { t } = useT();
  if (teams.length === 0) return null;
  const sorted = sortedTeams(teams);
  const isAll = selectedTeamIds === null || selectedTeamIds.length === 0;
  const selected = new Set(selectedTeamIds ?? []);

  const toggleTeam = (id: string) => {
    const current = selectedTeamIds ?? [];
    if (selected.has(id)) {
      const next = current.filter((x) => x !== id);
      onChange(next.length === 0 ? null : next);
    } else {
      onChange([...current, id]);
    }
  };

  return (
    <div
      role="group"
      aria-label={t('team.filterAriaLabel')}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        marginBottom: 14,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: '#777',
          marginRight: 4,
        }}
      >
        {t('team.filterLabel')}
      </span>
      <button
        onClick={() => onChange(null)}
        style={{
          padding: '5px 12px',
          borderRadius: 999,
          border: '1px solid ' + (isAll ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'),
          background: isAll ? 'rgba(255,255,255,0.1)' : 'transparent',
          color: isAll ? '#fff' : '#888',
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {t('team.filterAll')}
      </button>
      {sorted.map((team) => {
        const active = selected.has(team.id);
        return (
          <button
            key={team.id}
            onClick={() => toggleTeam(team.id)}
            aria-pressed={active}
            title={active ? t('team.filterRemove') : t('team.filterAdd')}
            style={{
              padding: '5px 12px',
              borderRadius: 999,
              border: '1px solid ' + (active ? team.color : 'rgba(255,255,255,0.1)'),
              background: active ? team.color : 'transparent',
              color: active ? '#fff' : '#aaa',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: active ? '#fff' : team.color,
                color: active ? team.color : 'transparent',
                fontSize: 10,
                lineHeight: '12px',
                textAlign: 'center',
                fontWeight: 900,
              }}
            >
              {active ? '✓' : ''}
            </span>
            {team.name}
          </button>
        );
      })}
      {!isAll && (
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 11,
            color: '#888',
            fontWeight: 500,
          }}
        >
          {t('team.filterSelected', selected.size)}
        </span>
      )}
    </div>
  );
}
