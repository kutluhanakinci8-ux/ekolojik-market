import { useState } from 'react';
import type { Store } from '../store/useStore';
import { APP_BUILD_ID, APP_FEATURE_TAG } from '../version';

interface PosNotesSettingsProps {
  store: Store;
}

export function PosNotesSettings({ store }: PosNotesSettingsProps) {
  const config = store.settings.posNotes;
  const [durationSec, setDurationSec] = useState(String(config.displayDurationSec));
  const [repeatIntervalMin, setRepeatIntervalMin] = useState(String(config.repeatIntervalMin));
  const [draftText, setDraftText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const saveTiming = () => {
    const durationValue = Number.parseInt(durationSec, 10);
    const intervalValue = Number.parseInt(repeatIntervalMin, 10);
    store.updatePosNotesSettings({
      displayDurationSec: Number.isNaN(durationValue) ? 8 : Math.min(120, Math.max(3, durationValue)),
      repeatIntervalMin: Number.isNaN(intervalValue) ? 1 : Math.min(120, Math.max(1, intervalValue)),
    });
    setDurationSec(String(store.settings.posNotes.displayDurationSec));
    setRepeatIntervalMin(String(store.settings.posNotes.repeatIntervalMin));
  };

  const addNote = () => {
    const text = draftText.trim();
    if (!text) return;
    store.addPosNote(text);
    setDraftText('');
  };

  const startEdit = (id: string, text: string) => {
    setEditingId(id);
    setEditingText(text);
  };

  const saveEdit = () => {
    if (!editingId) return;
    store.updatePosNote(editingId, { text: editingText });
    setEditingId(null);
    setEditingText('');
  };

  return (
    <section className="settings-panel settings-panel--notes">
      <div className="settings-panel-head">
        <div>
          <h2>Satış Notları</h2>
          <p>
            Boş sepette saat ile notlar aynı alanda dönüşümlü gösterilir. Sepete ürün eklenince
            notlar gizlenir ve sepet ürünleri için alan açılır.
          </p>
        </div>
      </div>

      <div className="pos-notes-settings-grid">
        <label className="settings-field">
          <span>Not gösterim süresi (saniye)</span>
          <input
            type="number"
            min="3"
            max="120"
            value={durationSec}
            onChange={(event) => setDurationSec(event.target.value)}
          />
          <small className="pos-notes-hint">Her not ekranda bu süre kalır, sonra sıradaki gösterilir.</small>
        </label>

        <label className="settings-field">
          <span>Not tekrar aralığı (dakika)</span>
          <input
            type="number"
            min="1"
            max="120"
            value={repeatIntervalMin}
            onChange={(event) => setRepeatIntervalMin(event.target.value)}
          />
          <small className="pos-notes-hint">
            Boş sepette saat bu kadar süre görünür, ardından notlar saat alanında yayınlanır.
          </small>
        </label>

        <div className="settings-field settings-field--full">
          <button type="button" className="btn btn-outline btn-sm" onClick={saveTiming}>
            Zamanlama ayarlarını kaydet
          </button>
        </div>

        <div className="settings-field settings-field--full">
          <span>Yeni not</span>
          <div className="pos-notes-add-row">
            <input
              type="text"
              placeholder="Örn. Kampanya bu hafta %10 indirimli..."
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') addNote();
              }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={addNote}>
              Ekle
            </button>
          </div>
        </div>
      </div>

      <p className="pos-notes-build-tag">
        Sürüm: {APP_FEATURE_TAG} · {APP_BUILD_ID}
      </p>

      <div className="pos-notes-list">
        {config.items.length === 0 ? (
          <p className="pos-notes-empty">Henüz not eklenmedi. Yukarıdan yeni not ekleyin.</p>
        ) : (
          config.items.map((note, order) => (
            <article key={note.id} className={`pos-notes-item ${note.isActive ? '' : 'is-inactive'}`}>
              <div className="pos-notes-item__order">{order + 1}</div>
              <div className="pos-notes-item__body">
                {editingId === note.id ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveEdit();
                      if (event.key === 'Escape') setEditingId(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <p>{note.text}</p>
                )}
              </div>
              <div className="pos-notes-item__actions">
                <label className="pos-notes-toggle" title={note.isActive ? 'Yayında' : 'Kapalı'}>
                  <input
                    type="checkbox"
                    checked={note.isActive}
                    onChange={(event) => store.updatePosNote(note.id, { isActive: event.target.checked })}
                  />
                  <span>{note.isActive ? 'Açık' : 'Kapalı'}</span>
                </label>
                {editingId === note.id ? (
                  <button type="button" className="btn btn-sm btn-primary" onClick={saveEdit}>Kaydet</button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={() => startEdit(note.id, note.text)}
                  >
                    Düzenle
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-danger-soft"
                  onClick={() => store.removePosNote(note.id)}
                >
                  Sil
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
