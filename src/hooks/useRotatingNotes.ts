import { useEffect, useMemo, useState } from 'react';
import type { PosNote } from '../types/business';

export function useRotatingNotes(
  notes: PosNote[],
  durationSec: number,
  resetKey: number,
) {
  const activeNotes = useMemo(
    () => notes.filter((note) => note.isActive && note.text.trim()),
    [notes],
  );

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [resetKey, activeNotes.length]);

  useEffect(() => {
    if (activeNotes.length <= 1) return undefined;
    const ms = Math.max(3, durationSec) * 1000;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % activeNotes.length);
    }, ms);
    return () => window.clearInterval(timer);
  }, [activeNotes.length, durationSec, resetKey]);

  const safeIndex = activeNotes.length > 0 ? index % activeNotes.length : 0;
  const currentNote = activeNotes[safeIndex] ?? null;

  return {
    activeNotes,
    currentNote,
    currentIndex: safeIndex,
    hasNotes: activeNotes.length > 0,
  };
}
