import { useState, useMemo, useRef, useCallback, type DragEvent } from 'react';
import { useT } from '../i18n/LanguageContext';
import {
  TEAM_PALETTE,
  makeTeam,
  makeMember,
  membersOfTeam,
  normalizeName,
  sortedTeams,
  ensureUnassignedTeam,
  UNASSIGNED_TEAM_ID,
  moveTeam,
  canMoveTeam,
} from '../utils/teams';
import { attachFilesToMember, type FileInput, type MatchedFileReport } from '../utils/mergeData';
import { exportRosterCsv } from '../utils/rosterCsv';
import type { Team, Member, PersonData, RosterSnapshot } from '../types';

interface TeamManagerProps {
  teams: Team[];
  members: Member[];
  people: PersonData[];
  onChange: (next: { teams: Team[]; members: Member[]; people: PersonData[] }, undo?: { label: string }) => void;
  onImportRosterClick: () => void;
  onMatchedReports?: (reports: MatchedFileReport[]) => void;
}

interface DeleteTeamDialog {
  team: Team;
  mode: 'cascade' | 'reassign';
  reassignTo: string;
}

interface DeleteMemberDialog {
  member: Member;
  mode: 'cascade' | 'orphan' | 'move';
  moveTo: string;
}

export default function TeamManager({ teams, members, people, onChange, onImportRosterClick, onMatchedReports }: TeamManagerProps) {
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [deleteTeamDialog, setDeleteTeamDialog] = useState<DeleteTeamDialog | null>(null);
  const [deleteMemberDialog, setDeleteMemberDialog] = useState<DeleteMemberDialog | null>(null);
  const [addingMemberFor, setAddingMemberFor] = useState<string | null>(null);
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [editingExtId, setEditingExtId] = useState<string | null>(null);
  const [extIdText, setExtIdText] = useState('');
  const [movingMember, setMovingMember] = useState<string | null>(null);
  const [changingTeamFor, setChangingTeamFor] = useState<string | null>(null);
  const [draggedMemberId, setDraggedMemberId] = useState<string | null>(null);
  const [teamDropTarget, setTeamDropTarget] = useState<string | null>(null);

  const dropTargetRef = useRef<string | null>(null);

  const MEMBER_DRAG_TYPE = 'application/x-aitm-member-id';

  const changeMemberTeam = useCallback(
    (memberId: string, targetTeamId: string) => {
      const m = members.find((mm) => mm.id === memberId);
      if (!m || m.teamId === targetTeamId) return;
      onChange(
        {
          teams,
          members: members.map((mm) => (mm.id === memberId ? { ...mm, teamId: targetTeamId } : mm)),
          people,
        },
        { label: t('undo.moveData') },
      );
    },
    [members, teams, people, onChange, t],
  );

  const sortedT = useMemo(() => sortedTeams(teams), [teams]);
  const filteredMemberIds = useMemo(() => {
    const q = normalizeName(search);
    if (!q) return null;
    const ids = new Set<string>();
    for (const m of members) {
      if (
        normalizeName(m.name).includes(q) ||
        normalizeName(m.note ?? '').includes(q) ||
        normalizeName(m.externalUserId ?? '').includes(q)
      ) {
        ids.add(m.id);
      }
    }
    return ids;
  }, [members, search]);

  const peopleByMemberId = useMemo(() => {
    const m = new Map<string, PersonData>();
    for (const p of people) {
      if (p.memberId) m.set(p.memberId, p);
    }
    return m;
  }, [people]);

  const toggleCollapse = (id: string) => {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const collapseAll = () => setCollapsed(new Set(teams.map((t) => t.id)));
  const expandAll = () => setCollapsed(new Set());

  const addTeam = () => {
    const newTeam = makeTeam(t('team.namePlaceholder'), teams);
    onChange({ teams: [...teams, newTeam], members, people });
    setEditingTeam(newTeam.id);
    setEditingTeamName('');
  };

  const saveTeamName = (teamId: string) => {
    const name = editingTeamName.trim();
    if (!name) {
      setEditingTeam(null);
      return;
    }
    onChange({
      teams: teams.map((t) => (t.id === teamId ? { ...t, name } : t)),
      members,
      people,
    });
    setEditingTeam(null);
  };

  const setTeamColor = (teamId: string, color: string) => {
    onChange({ teams: teams.map((t) => (t.id === teamId ? { ...t, color } : t)), members, people });
    setColorPickerFor(null);
  };

  const requestDeleteTeam = (team: Team) => {
    setDeleteTeamDialog({ team, mode: 'cascade', reassignTo: '' });
  };

  const confirmDeleteTeam = () => {
    if (!deleteTeamDialog) return;
    const { team, mode, reassignTo } = deleteTeamDialog;
    if (mode === 'cascade') {
      const idsToDrop = new Set(members.filter((m) => m.teamId === team.id).map((m) => m.id));
      onChange(
        {
          teams: teams.filter((t) => t.id !== team.id),
          members: members.filter((m) => !idsToDrop.has(m.id)),
          people: people.filter((p) => !p.memberId || !idsToDrop.has(p.memberId)),
        },
        { label: t('undo.deleteTeam') },
      );
    } else {
      onChange(
        {
          teams: teams.filter((t) => t.id !== team.id),
          members: members.map((m) => (m.teamId === team.id ? { ...m, teamId: reassignTo } : m)),
          people,
        },
        { label: t('undo.deleteTeam') },
      );
    }
    setDeleteTeamDialog(null);
  };

  const startAddMember = (teamId: string) => {
    setAddingMemberFor(teamId);
    setNewMemberName('');
  };

  const confirmAddMember = (teamId: string) => {
    const name = newMemberName.trim();
    if (!name) {
      setAddingMemberFor(null);
      return;
    }
    const member = makeMember(name, teamId);
    onChange({ teams, members: [...members, member], people });
    setAddingMemberFor(null);
    setNewMemberName('');
  };

  const saveMemberName = (memberId: string) => {
    const name = editingMemberName.trim();
    if (!name) {
      setEditingMember(null);
      return;
    }
    onChange({
      teams,
      members: members.map((m) => (m.id === memberId ? { ...m, name } : m)),
      people: people.map((p) => (p.memberId === memberId ? { ...p, name } : p)),
    });
    setEditingMember(null);
  };

  const saveNote = (memberId: string) => {
    onChange({
      teams,
      members: members.map((m) => (m.id === memberId ? { ...m, note: noteText } : m)),
      people,
    });
    setEditingNote(null);
    setNoteText('');
  };

  const saveExtId = (memberId: string) => {
    const v = extIdText.trim();
    onChange({
      teams,
      members: members.map((m) => (m.id === memberId ? { ...m, externalUserId: v || undefined } : m)),
      people,
    });
    setEditingExtId(null);
    setExtIdText('');
  };

  const requestDeleteMember = (member: Member) => {
    const hasData = !!peopleByMemberId.get(member.id);
    setDeleteMemberDialog({ member, mode: hasData ? 'orphan' : 'cascade', moveTo: '' });
  };

  const confirmDeleteMember = () => {
    if (!deleteMemberDialog) return;
    const { member, mode, moveTo } = deleteMemberDialog;
    if (mode === 'cascade') {
      onChange(
        {
          teams,
          members: members.filter((m) => m.id !== member.id),
          people: people.filter((p) => p.memberId !== member.id),
        },
        { label: t('undo.deleteMember') },
      );
    } else if (mode === 'orphan') {
      const ensured = ensureUnassignedTeam(teams);
      onChange(
        {
          teams: ensured.teams,
          members: members.map((m) =>
            m.id === member.id ? { ...m, teamId: ensured.team.id } : m,
          ),
          people,
        },
        { label: t('undo.deleteMember') },
      );
    } else if (mode === 'move' && moveTo) {
      const target = members.find((m) => m.id === moveTo);
      if (!target) return;
      const sourcePerson = peopleByMemberId.get(member.id);
      let nextPeople = people;
      if (sourcePerson) {
        const targetPerson = peopleByMemberId.get(target.id);
        if (targetPerson) {
          const seenDates = new Set(targetPerson.rows.map((r) => r.date.getTime()));
          const seenMetric = new Set((targetPerson.dailyApiMetrics ?? []).map((m) => m.dateStr));
          const mergedRows = [
            ...targetPerson.rows,
            ...sourcePerson.rows.filter((r) => !seenDates.has(r.date.getTime())),
          ];
          const mergedMetrics = [
            ...(targetPerson.dailyApiMetrics ?? []),
            ...(sourcePerson.dailyApiMetrics ?? []).filter((m) => !seenMetric.has(m.dateStr)),
          ];
          nextPeople = people
            .map((p) => {
              if (p.memberId === target.id) {
                return { ...p, rows: mergedRows, dailyApiMetrics: mergedMetrics };
              }
              return p;
            })
            .filter((p) => p.memberId !== member.id);
        } else {
          nextPeople = people
            .map((p) => (p.memberId === member.id ? { ...p, memberId: target.id, name: target.name } : p));
        }
      }
      onChange(
        {
          teams,
          members: members.filter((m) => m.id !== member.id),
          people: nextPeople,
        },
        { label: t('undo.deleteMember') },
      );
    }
    setDeleteMemberDialog(null);
  };

  const moveMemberData = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      setMovingMember(null);
      return;
    }
    const sourcePerson = peopleByMemberId.get(sourceId);
    const target = members.find((m) => m.id === targetId);
    if (!target) return;
    if (!sourcePerson) {
      setMovingMember(null);
      return;
    }
    const targetPerson = peopleByMemberId.get(targetId);
    let nextPeople = people;
    if (targetPerson) {
      const seenDates = new Set(targetPerson.rows.map((r) => r.date.getTime()));
      const seenMetric = new Set((targetPerson.dailyApiMetrics ?? []).map((m) => m.dateStr));
      const mergedRows = [
        ...targetPerson.rows,
        ...sourcePerson.rows.filter((r) => !seenDates.has(r.date.getTime())),
      ];
      const mergedMetrics = [
        ...(targetPerson.dailyApiMetrics ?? []),
        ...(sourcePerson.dailyApiMetrics ?? []).filter((m) => !seenMetric.has(m.dateStr)),
      ];
      nextPeople = people
        .map((p) => (p.memberId === targetId ? { ...p, rows: mergedRows, dailyApiMetrics: mergedMetrics } : p))
        .filter((p) => p.memberId !== sourceId);
    } else {
      nextPeople = people.map((p) =>
        p.memberId === sourceId ? { ...p, memberId: targetId, name: target.name } : p,
      );
    }
    onChange({ teams, members, people: nextPeople }, { label: t('undo.moveData') });
    setMovingMember(null);
  };

  const removeCsv = (memberId: string) => {
    onChange({
      teams,
      members,
      people: people
        .map((p) => (p.memberId === memberId ? { ...p, rows: [] } : p))
        .filter((p) => p.rows.length > 0 || (p.dailyApiMetrics?.length ?? 0) > 0),
    });
  };

  const removeJson = (memberId: string) => {
    onChange({
      teams,
      members,
      people: people
        .map((p) => (p.memberId === memberId ? { ...p, dailyApiMetrics: undefined } : p))
        .filter((p) => p.rows.length > 0 || (p.dailyApiMetrics?.length ?? 0) > 0),
    });
  };

  const handleAttachFiles = useCallback(
    async (member: Member, fileList: FileList) => {
      const valid = Array.from(fileList).filter(
        (f) => f.name.endsWith('.csv') || f.name.endsWith('.json'),
      );
      if (!valid.length) return;
      const inputs: FileInput[] = await Promise.all(
        valid.map(
          (file) =>
            new Promise<FileInput>((resolve) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve({ name: file.name, text: e.target?.result as string });
              reader.readAsText(file);
            }),
        ),
      );
      const result = attachFilesToMember(people, members, member, inputs);
      onChange({ teams, members: result.members, people: result.people });
      const dupReports = result.matched.filter((r) => r.duplicates > 0);
      if (dupReports.length > 0 && onMatchedReports) onMatchedReports(dupReports);
    },
    [people, members, teams, onChange, onMatchedReports],
  );

  const handleExportRoster = () => {
    const snapshot: RosterSnapshot = { teams, members, people };
    const csv = exportRosterCsv(snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roster-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onMemberDragOver = (e: DragEvent, memberId: string) => {
    if (e.dataTransfer.types.includes(MEMBER_DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    if (dropTargetRef.current !== memberId) {
      dropTargetRef.current = memberId;
    }
  };
  const onMemberDragLeave = (memberId: string) => {
    if (dropTargetRef.current === memberId) {
      dropTargetRef.current = null;
    }
  };
  const onMemberDrop = (e: DragEvent, member: Member) => {
    if (e.dataTransfer.types.includes(MEMBER_DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    dropTargetRef.current = null;
    if (e.dataTransfer.files.length) {
      handleAttachFiles(member, e.dataTransfer.files);
    }
  };

  const onMemberDragStart = (e: DragEvent, memberId: string) => {
    e.dataTransfer.setData(MEMBER_DRAG_TYPE, memberId);
    e.dataTransfer.setData('text/plain', memberId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedMemberId(memberId);
  };
  const onMemberDragEnd = () => {
    setDraggedMemberId(null);
    setTeamDropTarget(null);
  };

  const onTeamDragOver = (e: DragEvent, teamId: string) => {
    if (!e.dataTransfer.types.includes(MEMBER_DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (teamDropTarget !== teamId) setTeamDropTarget(teamId);
  };
  const onTeamDragLeave = (e: DragEvent, teamId: string) => {
    if (!e.dataTransfer.types.includes(MEMBER_DRAG_TYPE)) return;
    if (teamDropTarget === teamId) setTeamDropTarget(null);
  };
  const onTeamDrop = (e: DragEvent, teamId: string) => {
    if (!e.dataTransfer.types.includes(MEMBER_DRAG_TYPE)) return;
    e.preventDefault();
    e.stopPropagation();
    const memberId = e.dataTransfer.getData(MEMBER_DRAG_TYPE);
    setTeamDropTarget(null);
    setDraggedMemberId(null);
    if (memberId) changeMemberTeam(memberId, teamId);
  };

  const triggerFilePicker = (member: Member, accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = accept;
    input.onchange = () => {
      if (input.files) handleAttachFiles(member, input.files);
    };
    input.click();
  };

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {t('team.manager')}
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('team.searchPlaceholder')}
          style={{
            flex: 1,
            minWidth: 180,
            padding: '6px 10px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            color: '#e0e0e0',
            fontSize: 12,
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
        <button onClick={collapsed.size === teams.length ? expandAll : collapseAll} style={btnGhost}>
          {collapsed.size === teams.length ? t('team.expandAll') : t('team.collapseAll')}
        </button>
        <button onClick={addTeam} style={btnPrimary}>+ {t('team.add')}</button>
        <button onClick={handleExportRoster} style={btnGhost}>{t('roster.export')}</button>
        <button onClick={onImportRosterClick} style={btnGhost}>{t('roster.import')}</button>
      </div>

      {sortedT.length === 0 && (
        <div style={{ fontSize: 12, color: '#666', padding: '12px 0' }}>
          {t('team.empty')}
        </div>
      )}

      {sortedT.map((team) => {
        const teamMembers = membersOfTeam(members, team.id).sort((a, b) => a.name.localeCompare(b.name));
        const visibleMembers = filteredMemberIds
          ? teamMembers.filter((m) => filteredMemberIds.has(m.id))
          : teamMembers;
        if (filteredMemberIds && visibleMembers.length === 0) return null;
        const isCollapsed = collapsed.has(team.id);

        return (
          <div
            key={team.id}
            onDragOver={(e) => onTeamDragOver(e, team.id)}
            onDragLeave={(e) => onTeamDragLeave(e, team.id)}
            onDrop={(e) => onTeamDrop(e, team.id)}
            style={{
              borderLeft: `3px solid ${team.color}`,
              background: teamDropTarget === team.id ? `${team.color}1f` : 'rgba(255,255,255,0.02)',
              border: teamDropTarget === team.id ? `1px dashed ${team.color}` : '1px solid transparent',
              borderRadius: 10,
              marginBottom: 10,
              padding: '10px 12px',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => toggleCollapse(team.id)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#888',
                  fontSize: 11,
                  padding: 2,
                  width: 20,
                  fontFamily: 'inherit',
                }}
                aria-label={isCollapsed ? t('team.show') : t('team.hide')}
              >
                {isCollapsed ? '▶' : '▼'}
              </button>
              {editingTeam === team.id ? (
                <input
                  autoFocus
                  value={editingTeamName}
                  onChange={(e) => setEditingTeamName(e.target.value)}
                  onBlur={() => saveTeamName(team.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTeamName(team.id);
                    if (e.key === 'Escape') setEditingTeam(null);
                  }}
                  placeholder={team.name}
                  style={inputInline}
                />
              ) : (
                <span
                  onClick={() => {
                    setEditingTeam(team.id);
                    setEditingTeamName(team.name);
                  }}
                  style={{ fontSize: 14, fontWeight: 600, color: '#e0e0e0', cursor: 'text' }}
                >
                  {team.name}
                </span>
              )}
              <span style={{ fontSize: 11, color: '#666', fontFamily: "'JetBrains Mono', monospace" }}>
                {teamMembers.length}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, position: 'relative' }}>
                {team.id !== UNASSIGNED_TEAM_ID && (
                  <>
                    <button
                      onClick={() => onChange({ teams: moveTeam(teams, team.id, 'up'), members, people })}
                      disabled={!canMoveTeam(teams, team.id, 'up')}
                      style={{
                        ...btnGhost,
                        padding: '2px 8px',
                        opacity: canMoveTeam(teams, team.id, 'up') ? 1 : 0.3,
                        cursor: canMoveTeam(teams, team.id, 'up') ? 'pointer' : 'not-allowed',
                      }}
                      title={t('team.moveUp')}
                      aria-label={t('team.moveUp')}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => onChange({ teams: moveTeam(teams, team.id, 'down'), members, people })}
                      disabled={!canMoveTeam(teams, team.id, 'down')}
                      style={{
                        ...btnGhost,
                        padding: '2px 8px',
                        opacity: canMoveTeam(teams, team.id, 'down') ? 1 : 0.3,
                        cursor: canMoveTeam(teams, team.id, 'down') ? 'pointer' : 'not-allowed',
                      }}
                      title={t('team.moveDown')}
                      aria-label={t('team.moveDown')}
                    >
                      ↓
                    </button>
                  </>
                )}
                <button
                  onClick={() => setColorPickerFor(colorPickerFor === team.id ? null : team.id)}
                  style={{ ...btnGhost, padding: '2px 8px' }}
                  title={t('team.color')}
                >
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: team.color }} />
                </button>
                {colorPickerFor === team.id && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 28,
                      right: 0,
                      background: '#1a1a24',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: 8,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, 18px)',
                      gap: 6,
                      zIndex: 30,
                    }}
                  >
                    {TEAM_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => setTeamColor(team.id, c)}
                        style={{ width: 18, height: 18, borderRadius: 4, background: c, border: c === team.color ? '2px solid #fff' : 'none', cursor: 'pointer' }}
                        aria-label={c}
                      />
                    ))}
                  </div>
                )}
                {team.id !== UNASSIGNED_TEAM_ID && (
                  <button onClick={() => requestDeleteTeam(team)} style={btnDanger} title={t('team.delete')}>×</button>
                )}
              </div>
            </div>

            {!isCollapsed && (
              <>
                {visibleMembers.length === 0 && (
                  <div style={{ fontSize: 11, color: '#555', padding: '8px 0 4px 16px' }}>{t('team.empty')}</div>
                )}
                {visibleMembers.map((member) => {
                  const person = peopleByMemberId.get(member.id);
                  const csvCount = person?.rows.length ?? 0;
                  const jsonCount = person?.dailyApiMetrics?.length ?? 0;

                  return (
                    <div
                      key={member.id}
                      draggable
                      onDragStart={(e) => onMemberDragStart(e, member.id)}
                      onDragEnd={onMemberDragEnd}
                      onDragOver={(e) => onMemberDragOver(e, member.id)}
                      onDragLeave={() => onMemberDragLeave(member.id)}
                      onDrop={(e) => onMemberDrop(e, member)}
                      style={{
                        marginTop: 6,
                        padding: '8px 10px',
                        background: 'rgba(255,255,255,0.02)',
                        border: dropTargetRef.current === member.id ? `1px dashed ${team.color}` : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 8,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        opacity: draggedMemberId === member.id ? 0.4 : 1,
                        cursor: 'grab',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {editingMember === member.id ? (
                          <input
                            autoFocus
                            value={editingMemberName}
                            onChange={(e) => setEditingMemberName(e.target.value)}
                            onBlur={() => saveMemberName(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveMemberName(member.id);
                              if (e.key === 'Escape') setEditingMember(null);
                            }}
                            style={inputInline}
                          />
                        ) : (
                          <span
                            onClick={() => {
                              setEditingMember(member.id);
                              setEditingMemberName(member.name);
                            }}
                            style={{ fontSize: 13, color: '#e0e0e0', cursor: 'text' }}
                          >
                            {member.name}
                          </span>
                        )}
                        {csvCount > 0 && (
                          <span style={{ ...badge, background: 'rgba(42,157,143,0.15)', color: '#2a9d8f' }}>
                            {t('member.csvBadge', csvCount)}
                            <button onClick={() => removeCsv(member.id)} style={badgeBtn} title={t('member.removeCsv')}>×</button>
                          </span>
                        )}
                        {jsonCount > 0 && (
                          <span style={{ ...badge, background: 'rgba(69,123,157,0.15)', color: '#9bb6cf' }}>
                            {t('member.jsonBadge', jsonCount)}
                            <button onClick={() => removeJson(member.id)} style={badgeBtn} title={t('member.removeJson')}>×</button>
                          </span>
                        )}
                        {csvCount === 0 && jsonCount === 0 && (
                          <span style={{ fontSize: 10, color: '#555', fontStyle: 'italic' }}>{t('member.noData')}</span>
                        )}

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                          <button onClick={() => triggerFilePicker(member, '.csv')} style={btnGhostSm} title={t('member.attachCsv')}>+ CSV</button>
                          <button onClick={() => triggerFilePicker(member, '.json')} style={btnGhostSm} title={t('member.attachJson')}>+ JSON</button>
                          <button
                            onClick={() => {
                              if (editingNote === member.id) {
                                setEditingNote(null);
                              } else {
                                setEditingNote(member.id);
                                setNoteText(member.note ?? '');
                              }
                            }}
                            style={btnGhostSm}
                            title={t('member.note')}
                          >
                            {member.note ? '✏ ' : ''}{t('member.note').toLowerCase()}
                          </button>
                          <button
                            onClick={() => {
                              if (editingExtId === member.id) {
                                setEditingExtId(null);
                              } else {
                                setEditingExtId(member.id);
                                setExtIdText(member.externalUserId ?? '');
                              }
                            }}
                            style={btnGhostSm}
                            title={t('person.externalUserId')}
                          >
                            id
                          </button>
                          {teams.length > 1 && (
                            <button
                              onClick={() => setChangingTeamFor(changingTeamFor === member.id ? null : member.id)}
                              style={btnGhostSm}
                              title={t('member.changeTeam')}
                            >
                              → team
                            </button>
                          )}
                          {csvCount + jsonCount > 0 && (
                            <button onClick={() => setMovingMember(movingMember === member.id ? null : member.id)} style={btnGhostSm} title={t('member.move')}>↗</button>
                          )}
                          <button onClick={() => requestDeleteMember(member)} style={btnDangerSm} title={t('member.delete')}>×</button>
                        </div>
                      </div>

                      {changingTeamFor === member.id && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#888' }}>
                          <span>{t('member.changeTeamTo')}</span>
                          <select
                            value={member.teamId}
                            onChange={(e) => {
                              changeMemberTeam(member.id, e.target.value);
                              setChangingTeamFor(null);
                            }}
                            style={selectInline}
                          >
                            {sortedT.map((tm) => (
                              <option key={tm.id} value={tm.id}>{tm.name}</option>
                            ))}
                          </select>
                          <button onClick={() => setChangingTeamFor(null)} style={btnGhostSm}>{t('team.cancel')}</button>
                        </div>
                      )}

                      {editingNote === member.id && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            autoFocus
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onBlur={() => saveNote(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNote(member.id);
                              if (e.key === 'Escape') setEditingNote(null);
                            }}
                            placeholder={t('member.notePlaceholder')}
                            style={{ ...inputInline, flex: 1 }}
                          />
                        </div>
                      )}
                      {editingExtId === member.id && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            autoFocus
                            value={extIdText}
                            onChange={(e) => setExtIdText(e.target.value)}
                            onBlur={() => saveExtId(member.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveExtId(member.id);
                              if (e.key === 'Escape') setEditingExtId(null);
                            }}
                            placeholder={t('member.externalUserIdPlaceholder')}
                            style={{ ...inputInline, flex: 1 }}
                          />
                        </div>
                      )}
                      {movingMember === member.id && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 11, color: '#888' }}>
                          <span>{t('member.moveTo')}</span>
                          <select
                            onChange={(e) => moveMemberData(member.id, e.target.value)}
                            defaultValue=""
                            style={selectInline}
                          >
                            <option value="" disabled>—</option>
                            {members.filter((m) => m.id !== member.id).map((m) => {
                              const tm = teams.find((t) => t.id === m.teamId);
                              return (
                                <option key={m.id} value={m.id}>
                                  {tm ? `[${tm.name}] ` : ''}{m.name}
                                </option>
                              );
                            })}
                          </select>
                          <button onClick={() => setMovingMember(null)} style={btnGhostSm}>{t('team.cancel')}</button>
                        </div>
                      )}
                      {member.note && editingNote !== member.id && (
                        <div style={{ fontSize: 11, color: 'rgba(233,196,106,0.85)', fontStyle: 'italic', paddingLeft: 2 }}>
                          {member.note}
                        </div>
                      )}
                      {member.externalUserId && editingExtId !== member.id && (
                        <div style={{ fontSize: 10, color: '#888', fontFamily: "'JetBrains Mono', monospace", paddingLeft: 2 }}>
                          {t('person.externalUserId')}: {member.externalUserId}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div style={{ marginTop: 6, paddingLeft: 4 }}>
                  {addingMemberFor === team.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        autoFocus
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        onBlur={() => confirmAddMember(team.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmAddMember(team.id);
                          if (e.key === 'Escape') setAddingMemberFor(null);
                        }}
                        placeholder={t('member.namePlaceholder')}
                        style={{ ...inputInline, flex: 1 }}
                      />
                    </div>
                  ) : (
                    <button onClick={() => startAddMember(team.id)} style={btnGhostSm}>+ {t('member.add')}</button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}

      {deleteTeamDialog && (
        <ConfirmModal
          title={t('team.deleteConfirmTitle')}
          onCancel={() => setDeleteTeamDialog(null)}
          onConfirm={confirmDeleteTeam}
          confirmLabel={t('team.confirm')}
          cancelLabel={t('team.cancel')}
        >
          <label style={radioRow}>
            <input
              type="radio"
              checked={deleteTeamDialog.mode === 'cascade'}
              onChange={() => setDeleteTeamDialog({ ...deleteTeamDialog, mode: 'cascade' })}
            />
            {t('team.deleteWithMembers')}
          </label>
          {teams.filter((t) => t.id !== deleteTeamDialog.team.id).length > 0 && (
            <label style={radioRow}>
              <input
                type="radio"
                checked={deleteTeamDialog.mode === 'reassign'}
                onChange={() =>
                  setDeleteTeamDialog({
                    ...deleteTeamDialog,
                    mode: 'reassign',
                    reassignTo: teams.find((t) => t.id !== deleteTeamDialog.team.id)?.id ?? '',
                  })
                }
              />
              <span>
                {t('team.deleteReassign')}{' '}
                <select
                  disabled={deleteTeamDialog.mode !== 'reassign'}
                  value={deleteTeamDialog.reassignTo}
                  onChange={(e) => setDeleteTeamDialog({ ...deleteTeamDialog, reassignTo: e.target.value })}
                  style={selectInline}
                >
                  {teams.filter((t) => t.id !== deleteTeamDialog.team.id).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </span>
            </label>
          )}
        </ConfirmModal>
      )}

      {deleteMemberDialog && (
        <ConfirmModal
          title={t('member.deleteConfirmTitle')}
          onCancel={() => setDeleteMemberDialog(null)}
          onConfirm={confirmDeleteMember}
          confirmLabel={t('team.confirm')}
          cancelLabel={t('team.cancel')}
        >
          <label style={radioRow}>
            <input
              type="radio"
              checked={deleteMemberDialog.mode === 'cascade'}
              onChange={() => setDeleteMemberDialog({ ...deleteMemberDialog, mode: 'cascade' })}
            />
            {t('safeDelete.cascade')}
          </label>
          {peopleByMemberId.get(deleteMemberDialog.member.id) && (
            <>
              <label style={radioRow}>
                <input
                  type="radio"
                  checked={deleteMemberDialog.mode === 'orphan'}
                  onChange={() => setDeleteMemberDialog({ ...deleteMemberDialog, mode: 'orphan' })}
                />
                {t('safeDelete.orphan')}
              </label>
              {members.filter((m) => m.id !== deleteMemberDialog.member.id).length > 0 && (
                <label style={radioRow}>
                  <input
                    type="radio"
                    checked={deleteMemberDialog.mode === 'move'}
                    onChange={() =>
                      setDeleteMemberDialog({
                        ...deleteMemberDialog,
                        mode: 'move',
                        moveTo: members.find((m) => m.id !== deleteMemberDialog.member.id)?.id ?? '',
                      })
                    }
                  />
                  <span>
                    {t('safeDelete.move')}{' '}
                    <select
                      disabled={deleteMemberDialog.mode !== 'move'}
                      value={deleteMemberDialog.moveTo}
                      onChange={(e) => setDeleteMemberDialog({ ...deleteMemberDialog, moveTo: e.target.value })}
                      style={selectInline}
                    >
                      {members
                        .filter((m) => m.id !== deleteMemberDialog.member.id)
                        .map((m) => {
                          const tm = teams.find((t) => t.id === m.teamId);
                          return (
                            <option key={m.id} value={m.id}>
                              {tm ? `[${tm.name}] ` : ''}{m.name}
                            </option>
                          );
                        })}
                    </select>
                  </span>
                </label>
              )}
            </>
          )}
        </ConfirmModal>
      )}
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  cancelLabel: string;
  children: React.ReactNode;
}

function ConfirmModal({ title, onCancel, onConfirm, confirmLabel, cancelLabel, children }: ConfirmModalProps) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1a24',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 12,
          padding: 22,
          minWidth: 360,
          maxWidth: 480,
          color: '#e0e0e0',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <button onClick={onCancel} style={btnGhost}>{cancelLabel}</button>
          <button onClick={onConfirm} style={btnPrimary}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.5)',
  background: 'rgba(230,57,70,0.18)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnGhost: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#aaa',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnGhostSm: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#888',
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnDanger: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: 8,
  border: '1px solid rgba(230,57,70,0.3)',
  background: 'transparent',
  color: '#e63946',
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
};

const btnDangerSm: React.CSSProperties = {
  padding: '3px 8px',
  borderRadius: 6,
  border: '1px solid rgba(230,57,70,0.25)',
  background: 'transparent',
  color: '#e63946',
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  lineHeight: 1,
};

const inputInline: React.CSSProperties = {
  padding: '4px 8px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 12,
  outline: 'none',
  fontFamily: 'inherit',
};

const selectInline: React.CSSProperties = {
  padding: '3px 6px',
  background: '#1a1a24',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6,
  color: '#e0e0e0',
  fontSize: 11,
  outline: 'none',
  fontFamily: 'inherit',
};

const badge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 4px 1px 8px',
  borderRadius: 999,
  fontSize: 11,
  fontFamily: "'JetBrains Mono', monospace",
};

const badgeBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 13,
  lineHeight: 1,
  padding: '0 4px',
};

const radioRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: '#ccc',
  cursor: 'pointer',
};
