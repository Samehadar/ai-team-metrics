import type { RosterSnapshot } from '../types';

export interface UndoEntry {
  id: string;
  label: string;
  snapshot: RosterSnapshot;
  expiresAt: number;
}

export const UNDO_TTL_MS = 6000;
export const UNDO_MAX_ENTRIES = 5;

export function pushUndo(stack: UndoEntry[], entry: Omit<UndoEntry, 'expiresAt' | 'id'>): UndoEntry[] {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const next: UndoEntry = { ...entry, id, expiresAt: Date.now() + UNDO_TTL_MS };
  const trimmed = [next, ...stack].slice(0, UNDO_MAX_ENTRIES);
  return trimmed;
}

export function dropUndo(stack: UndoEntry[], id: string): UndoEntry[] {
  return stack.filter((e) => e.id !== id);
}

export function pruneExpired(stack: UndoEntry[], now = Date.now()): UndoEntry[] {
  return stack.filter((e) => e.expiresAt > now);
}
