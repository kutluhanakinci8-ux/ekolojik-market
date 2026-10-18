import type { PosNote } from '../types/business';
import { useIdleNotesBroadcast } from '../hooks/useIdleNotesBroadcast';
import { CartIdleClock } from './CartIdleClock';

interface CartIdleStageProps {
  businessName: string;
  notes: PosNote[];
  displayDurationSec: number;
  repeatIntervalMin: number;
}

export function CartIdleStage({
  businessName,
  notes,
  displayDurationSec,
  repeatIntervalMin,
}: CartIdleStageProps) {
  const { mode, currentNote, currentIndex, activeNotes, hasNotes } = useIdleNotesBroadcast(
    notes,
    displayDurationSec,
    repeatIntervalMin,
  );

  if (mode === 'notes' && hasNotes && currentNote) {
    return (
      <div className="cart-idle-clock cart-idle-note" role="status" aria-live="polite" aria-label="Satış notu">
        <div className="cart-idle-clock-ambient" aria-hidden>
          <span className="cart-idle-clock-glow cart-idle-note-glow" />
          <span className="cart-idle-clock-orbit cart-idle-clock-orbit--a" />
          <span className="cart-idle-clock-orbit cart-idle-clock-orbit--b" />
        </div>

        <div className="cart-idle-clock-inner cart-idle-note-inner">
          <div className="cart-idle-note-stage">
            <article className="cart-idle-note-panel" key={currentNote.id}>
              <div className="cart-idle-note-panel__shine" aria-hidden />

              <header className="cart-idle-note-panel__head">
                <div className="cart-idle-note-panel__title">
                  <span className="cart-idle-note-panel__icon" aria-hidden>!</span>
                  <span className="cart-idle-note-panel__label">Bilgilendirme</span>
                </div>
                {activeNotes.length > 1 && (
                  <span className="cart-idle-note-panel__counter">
                    {currentIndex + 1} / {activeNotes.length}
                  </span>
                )}
              </header>

              <p className="cart-idle-note-panel__text">{currentNote.text}</p>

              {activeNotes.length > 1 && (
                <div className="cart-idle-note-panel__progress" aria-hidden>
                  {activeNotes.map((note, dotIndex) => (
                    <span
                      key={note.id}
                      className={`cart-idle-note-panel__segment ${dotIndex === currentIndex ? 'is-active' : ''} ${dotIndex < currentIndex ? 'is-done' : ''}`}
                    />
                  ))}
                </div>
              )}
            </article>
          </div>

          <div className="cart-idle-clock-footer cart-idle-note-footer">
            <span className="cart-idle-clock-chip cart-idle-note-chip">{businessName}</span>
            <p className="cart-idle-clock-hint">Not yayını sonrası saat ekranına dönülür</p>
          </div>
        </div>
      </div>
    );
  }

  return <CartIdleClock businessName={businessName} />;
}
