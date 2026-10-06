import { useEffect, useMemo, useState } from 'react';
import type { PosNote } from '../types/business';

export type IdleBroadcastMode = 'clock' | 'notes';

export function useIdleNotesBroadcast(
  notes: PosNote[],
  displayDurationSec: number,
  repeatIntervalMin: number,
) {
  const activeNotes = useMemo(
    () => notes.filter((note) => note.isActive && note.text.trim()),
    [notes],
  );

  const [mode, setMode] = useState<IdleBroadcastMode>('clock');
  const [noteIndex, setNoteIndex] = useState(0);
  const [isFirstCycle, setIsFirstCycle] = useState(true);

  useEffect(() => {
    if (activeNotes.length === 0) {
      setMode('clock');
      setNoteIndex(0);
    }
  }, [activeNotes.length]);

  useEffect(() => {
    if (mode !== 'clock' || activeNotes.length === 0) return undefined;

    const waitMs = isFirstCycle
      ? 30 * 1000
      : Math.max(1, repeatIntervalMin) * 60 * 1000;
    const timer = window.setTimeout(() => {
      setNoteIndex(0);
      setMode('notes');
      setIsFirstCycle(false);
    }, waitMs);

    return () => window.clearTimeout(timer);
  }, [mode, repeatIntervalMin, activeNotes.length, isFirstCycle]);

  useEffect(() => {
    if (mode !== 'notes' || activeNotes.length === 0) return undefined;

    const ms = Math.max(3, displayDurationSec) * 1000;
    const timer = window.setInterval(() => {
      setNoteIndex((prev) => {
        const next = prev + 1;
        if (next >= activeNotes.length) {
          setMode('clock');
          return 0;
        }
        return next;
      });
    }, ms);

    return () => window.clearInterval(timer);
  }, [mode, displayDurationSec, activeNotes.length]);

  const safeIndex = activeNotes.length > 0 ? noteIndex % activeNotes.length : 0;
  const currentNote = mode === 'notes' ? activeNotes[safeIndex] ?? null : null;

  return {
    mode,
    currentNote,
    currentIndex: safeIndex,
    activeNotes,
    hasNotes: activeNotes.length > 0,
  };
}
