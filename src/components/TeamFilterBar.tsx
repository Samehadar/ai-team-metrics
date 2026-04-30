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
  if (teams.length <= 1) return null;
  const sorted = sortedTeams(teams);
  const isAll = selectedTeamIds === null;
  const selected = new Set(selectedTeamIds ?? []);

  const toggle = (id: string) => {
    if (isAll) {
      onChange([id]);
      return;
    }
    if (selected.has(id)) {
      const next = selectedTeamIds!.filter((x) => x !== id);
      if (next.length === 0) onChange(null);
      else onChange(next);
    } else {
      onChange([...(selectedTeamIds ?? []), id]);
    }
  };

  return (
    <div
      role="group"
      aria-label={t('team.filterAriaLabel')}
      style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}
    >
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
        {t('team.filterAllShort')}
      </button>
      {sorted.map((team) => {
        const active = !isAll && selected.has(team.id);
        return (
          <button
            key={team.id}
            onClick={() => toggle(team.id)}
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
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: active ? '#fff' : team.color,
              }}
            />
            {team.name}
          </button>
        );
      })}
    </div>
  );
}
