import { useState } from 'react';
import type { Store } from '../../store/useStore';
import type { CrmSmsTemplate } from '../../types/crm';

interface SmsTemplatesPanelProps {
  store: Store;
}

export function SmsTemplatesPanel({ store }: SmsTemplatesPanelProps) {
  const templates = store.crmData.smsTemplates;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  const startEdit = (t: CrmSmsTemplate) => {
    setEditingId(t.id);
    setName(t.name);
    setBody(t.body);
  };

  const reset = () => {
    setEditingId(null);
    setName('');
    setBody('');
  };

  const save = () => {
    store.saveCrmSmsTemplate(editingId, name, body);
    reset();
  };

  return (
    <div className="sms-templates-panel">
      <p className="module-hint">
        Değişkenler: <code>{'{{name}}'}</code>, <code>{'{{business}}'}</code>, <code>{'{{balance}}'}</code>,
        <code>{'{{points}}'}</code>, <code>{'{{dueDate}}'}</code>, <code>{'{{greenleaf}}'}</code>
      </p>

      <div className="crm-center-form-row">
        <input placeholder="Şablon adı" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea
          placeholder="Mesaj metni"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <button type="button" className="btn btn-primary" onClick={save}>Kaydet</button>
        {editingId && (
          <button type="button" className="btn btn-ghost" onClick={reset}>İptal</button>
        )}
      </div>

      <ul className="crm-center-list">
        {templates.map((t) => (
          <li key={t.id}>
            <div>
              <strong>{t.name}</strong>
              <p className="sms-template-preview">{t.body}</p>
            </div>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => startEdit(t)}>Düzenle</button>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => store.removeCrmSmsTemplate(t.id)}
            >
              Sil
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
