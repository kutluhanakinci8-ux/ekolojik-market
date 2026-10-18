import type { PosNote } from '../types/business';
import { useRotatingNotes } from '../hooks/useRotatingNotes';

interface CartNotesTickerProps {
  notes: PosNote[];
  durationSec: number;
  resetKey: number;
  variant: 'idle' | 'cart';
}

export function CartNotesTicker({ notes, durationSec, resetKey, variant }: CartNotesTickerProps) {
  const { activeNotes, currentNote, currentIndex, hasNotes } = useRotatingNotes(
    notes,
    durationSec,
    resetKey,
  );

  if (!hasNotes || !currentNote) return null;

  return (
    <div
      className={`cart-notes-ticker cart-notes-ticker--${variant}`}
      role="status"
      aria-live="polite"
      aria-label="Satış notları"
    >
      <div className="cart-notes-ticker__accent" aria-hidden />
      <div className="cart-notes-ticker__head">
        <div className="cart-notes-ticker__title">
          <span className="cart-notes-ticker__icon" aria-hidden>!</span>
          <span className="cart-notes-ticker__badge">Bilgilendirme</span>
        </div>
        {activeNotes.length > 1 && (
          <span className="cart-notes-ticker__counter">
            {currentIndex + 1} / {activeNotes.length}
          </span>
        )}
      </div>
      <p className="cart-notes-ticker__text" key={currentNote.id}>{currentNote.text}</p>
      {activeNotes.length > 1 && (
        <div className="cart-notes-ticker__progress" aria-hidden>
          {activeNotes.map((note, dotIndex) => (
            <span
              key={note.id}
              className={`cart-notes-ticker__segment ${dotIndex === currentIndex ? 'is-active' : ''} ${dotIndex < currentIndex ? 'is-done' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
