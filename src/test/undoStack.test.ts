import { describe, it, expect } from 'vitest';
import { pushUndo, dropUndo, pruneExpired, UNDO_MAX_ENTRIES } from '../utils/undoStack';
import { ensureUnassignedTeam } from '../utils/teams';

const snapshot = () => ({ teams: ensureUnassignedTeam([]).teams, members: [], people: [] });

describe('undoStack', () => {
  it('pushes new entries to the front', () => {
    const s1 = pushUndo([], { label: 'A', snapshot: snapshot() });
    const s2 = pushUndo(s1, { label: 'B', snapshot: snapshot() });
    expect(s2[0].label).toBe('B');
    expect(s2[1].label).toBe('A');
  });

  it('caps stack at UNDO_MAX_ENTRIES', () => {
    let stack: any[] = [];
    for (let i = 0; i < UNDO_MAX_ENTRIES + 3; i++) {
      stack = pushUndo(stack, { label: 'L' + i, snapshot: snapshot() });
    }
    expect(stack).toHaveLength(UNDO_MAX_ENTRIES);
  });

  it('drops by id', () => {
    const s = pushUndo([], { label: 'A', snapshot: snapshot() });
    const next = dropUndo(s, s[0].id);
    expect(next).toHaveLength(0);
  });

  it('prunes expired entries', () => {
    const s = pushUndo([], { label: 'A', snapshot: snapshot() });
    const future = Date.now() + 60_000;
    expect(pruneExpired(s, future)).toHaveLength(0);
    expect(pruneExpired(s)).toHaveLength(1);
  });
});
