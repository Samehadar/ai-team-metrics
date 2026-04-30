import { useCallback, useState } from 'react';

export interface HighlightApi {
  hovered: string | null;
  isolated: string | null;
  setHovered: (key: string | null) => void;
  toggleIsolated: (key: string | null) => void;
  reset: () => void;
  opacityFor: (key: string | null | undefined) => number;
  isDimmed: (key: string | null | undefined) => boolean;
}

export function useHighlight(): HighlightApi {
  const [hovered, setHovered] = useState<string | null>(null);
  const [isolated, setIsolated] = useState<string | null>(null);

  const toggleIsolated = useCallback((k: string | null) => {
    setIsolated((cur) => (cur === k || k === null ? null : k));
  }, []);
  const reset = useCallback(() => {
    setHovered(null);
    setIsolated(null);
  }, []);

  const opacityFor = useCallback(
    (k: string | null | undefined) => {
      if (isolated) return isolated === k ? 1 : 0.15;
      if (hovered) return hovered === k ? 1 : 0.45;
      return 1;
    },
    [hovered, isolated],
  );

  const isDimmed = useCallback(
    (k: string | null | undefined) => {
      if (isolated) return isolated !== k;
      if (hovered) return hovered !== k;
      return false;
    },
    [hovered, isolated],
  );

  return { hovered, isolated, setHovered, toggleIsolated, reset, opacityFor, isDimmed };
}
