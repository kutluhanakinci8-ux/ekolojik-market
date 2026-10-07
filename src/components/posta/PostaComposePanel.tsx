import { useEffect, useRef, useState } from 'react';
import type { MailTemplate } from '../../services/postaInboxService';
import {
  formatPostaComposePreview,
  POSTA_COMPOSE_MAX_ATTACH_BYTES,
  totalAttachmentBytes,
  type OutboundAttachment,
  type PostaComposeBodyFormat,
} from '../../utils/postaComposeClient';
import { PostaComposeRichEditor } from './PostaComposeRichEditor';

export type PostaComposePanelProps = {
  ourEmails: string[];
  hints: string[];
  templates: MailTemplate[];
  loading: boolean;
  composeTo: string;
  composeCc: string;
  composeBcc: string;
  composeSubject: string;
  composeBody: string;
  bodyFormat: PostaComposeBodyFormat;
  attachments: OutboundAttachment[];
  onChange: (patch: {
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    body?: string;
    bodyFormat?: PostaComposeBodyFormat;
    attachments?: OutboundAttachment[];
  }) => void;
  onSend: () => void;
  onSaveDraft: () => void;
  autosaveDraft: () => void;
  signaturePreviewHtml?: string | null;
  onAiSuggest?: () => void;
  aiBusy?: boolean;
};

export function PostaComposePanel({
  ourEmails,
  hints,
  templates,
  loading,
  composeTo,
  composeCc,
  composeBcc,
  composeSubject,
  composeBody,
  bodyFormat,
  attachments,
  onChange,
  onSend,
  onSaveDraft,
  autosaveDraft,
  signaturePreviewHtml,
  onAiSuggest,
  aiBusy,
}: PostaComposePanelProps) {
  const [showCcBcc, setShowCcBcc] = useState(Boolean(composeCc || composeBcc));
  const [showPreview, setShowPreview] = useState(false);
  const [autosaveNote, setAutosaveNote] = useState<string | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutosaveOnce = useRef(false);

  useEffect(() => {
    if (skipAutosaveOnce.current) {
      skipAutosaveOnce.current = false;
      return;
    }
    if (!composeTo.trim() && !composeSubject.trim() && !composeBody.trim()) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      autosaveDraft();
      setAutosaveNote('Taslak otomatik kaydedildi');
      setTimeout(() => setAutosaveNote(null), 2500);
    }, 2000);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [composeTo, composeCc, composeBcc, composeSubject, composeBody, bodyFormat, attachments.length, autosaveDraft]);

  const wrapComposeSelection = (before: string, after: string) => {
    const el = document.getElementById('posta-compose-body') as HTMLTextAreaElement | null;
    if (!el) return;
    const start = el.selectionStart ?? composeBody.length;
    const end = el.selectionEnd ?? composeBody.length;
    const next = composeBody.slice(0, start) + before + composeBody.slice(start, end) + after + composeBody.slice(end);
    onChange({ body: next });
  };

  const applyTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    skipAutosaveOnce.current = true;
    onChange({ subject: t.subject, body: t.body, bodyFormat: 'markdown' });
  };

  const attachBytes = totalAttachmentBytes(attachments);
  const isRich = bodyFormat === 'html';

  return (
    <div className="posta-hub-compose-form">
      <h2>Yeni e-posta</h2>
      {ourEmails.length > 0 && (
        <p className="posta-compose-from-hint module-hint">Gönderen: {ourEmails.join(', ')}</p>
      )}
      {templates.length > 0 && (
        <label className="settings-field settings-field--full">
          <span>Şablon</span>
          <select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
            <option value="">— Seçin —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="settings-field settings-field--full">
        <span>Alıcı</span>
        <input
          list="posta-recipient-hints"
          value={composeTo}
          onChange={(e) => onChange({ to: e.target.value })}
        />
        <datalist id="posta-recipient-hints">
          {hints.map((email) => (
            <option key={email} value={email} />
          ))}
        </datalist>
      </label>
      <button type="button" className="btn btn-sm btn-outline posta-compose-toggle-cc" onClick={() => setShowCcBcc((v) => !v)}>
        {showCcBcc ? 'Cc/Bcc gizle' : 'Cc / Bcc'}
      </button>
      {showCcBcc && (
        <>
          <label className="settings-field settings-field--full">
            <span>Cc</span>
            <input value={composeCc} onChange={(e) => onChange({ cc: e.target.value })} placeholder="virgülle ayırın" />
          </label>
          <label className="settings-field settings-field--full">
            <span>Bcc</span>
            <input value={composeBcc} onChange={(e) => onChange({ bcc: e.target.value })} placeholder="virgülle ayırın" />
          </label>
        </>
      )}
      <label className="settings-field settings-field--full">
        <span>Konu</span>
        <input value={composeSubject} onChange={(e) => onChange({ subject: e.target.value })} />
      </label>

      <div className="posta-compose-format-toggle">
        <span className="settings-hint">NB PM-2 — biçim:</span>
        <button
          type="button"
          className={`btn btn-sm ${isRich ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onChange({ bodyFormat: 'html' })}
        >
          Zengin metin
        </button>
        <button
          type="button"
          className={`btn btn-sm ${!isRich ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onChange({ bodyFormat: 'markdown' })}
        >
          Markdown
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setShowPreview((v) => !v)}>
          {showPreview ? 'Düzenle' : 'Önizleme'}
        </button>
        {onAiSuggest && (
          <button type="button" className="btn btn-sm btn-outline" disabled={loading || aiBusy} onClick={onAiSuggest}>
            {aiBusy ? 'AI…' : 'AI öneri'}
          </button>
        )}
      </div>

      {!showPreview ? (
        isRich ? (
          <PostaComposeRichEditor
            html={composeBody}
            disabled={loading}
            onChange={(html) => onChange({ body: html })}
          />
        ) : (
          <>
            <div className="posta-compose-toolbar">
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('**', '**')}>
                Kalın
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('_', '_')}>
                İtalik
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('`', '`')}>
                Kod
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('\n- ', '')}>
                Liste
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('\n> ', '')}>
                Alıntı
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('## ', '')}>
                Başlık
              </button>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => wrapComposeSelection('[', '](https://)')}>
                Link
              </button>
            </div>
            <label className="settings-field settings-field--full">
              <span>Metin (Markdown)</span>
              <textarea
                id="posta-compose-body"
                rows={8}
                value={composeBody}
                onChange={(e) => onChange({ body: e.target.value })}
              />
            </label>
          </>
        )
      ) : (
        <div className="posta-compose-preview">
          <div
            className="posta-compose-preview-body"
            dangerouslySetInnerHTML={{ __html: formatPostaComposePreview(composeBody, bodyFormat) }}
          />
          {signaturePreviewHtml?.trim() ? (
            <div className="posta-compose-preview-sig" dangerouslySetInnerHTML={{ __html: signaturePreviewHtml }} />
          ) : null}
        </div>
      )}

      <label className="settings-field settings-field--full">
        <span>Ek (toplam max 10 MB)</span>
        <input
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const result = String(reader.result ?? '');
              const dataBase64 = result.includes(',') ? result.split(',')[1] : result;
              const next: OutboundAttachment = {
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                dataBase64,
              };
              const nextTotal = totalAttachmentBytes([...attachments, next]);
              if (nextTotal > POSTA_COMPOSE_MAX_ATTACH_BYTES) return;
              onChange({ attachments: [...attachments, next].slice(0, 8) });
            };
            reader.readAsDataURL(file);
          }}
        />
      </label>
      {attachments.length > 0 && (
        <ul className="crm-msg-attachments">
          {attachments.map((f, i) => (
            <li key={`${f.fileName}-${i}`}>
              {f.fileName} ({Math.round(Math.ceil((f.dataBase64.length * 3) / 4) / 1024)} KB)
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => onChange({ attachments: attachments.filter((_, j) => j !== i) })}
              >
                Kaldır
              </button>
            </li>
          ))}
          <li className="posta-compose-attach-total">Toplam: {Math.round(attachBytes / 1024)} KB</li>
        </ul>
      )}
      <div className="posta-hub-compose-actions">
        {autosaveNote && <span className="posta-compose-autosave-note">{autosaveNote}</span>}
        <button type="button" className="btn btn-outline" disabled={loading} onClick={onSaveDraft}>
          Taslak kaydet
        </button>
        <button type="button" className="btn btn-primary" disabled={loading || !composeTo.includes('@')} onClick={onSend}>
          Gönder
        </button>
      </div>
    </div>
  );
}
