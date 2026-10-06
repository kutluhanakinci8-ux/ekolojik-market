import { useState } from 'react';
import type { Customer } from '../../types/business';
import type { Store } from '../../store/useStore';
import { getCustomerCrmProfile } from '../../utils/crm/profile';
import { loadCrmAttachment } from '../../storage/crmAttachments';

interface CrmDocumentAttachmentsProps {
  store: Store;
  customer: Customer;
}

export function CrmDocumentAttachments({ store, customer }: CrmDocumentAttachmentsProps) {
  const [label, setLabel] = useState('');
  const crm = getCustomerCrmProfile(customer, store.crmSettings);

  const onUpload = async (file: File | undefined) => {
    if (!file || !label.trim()) return;
    await store.addCrmCustomerDocument(customer.id, label.trim(), file);
    setLabel('');
  };

  return (
    <div className="crm-document-attachments">
      <h3>Ek dosyalar</h3>
      <div className="crm-center-form-row">
        <input placeholder="Belge adı" value={label} onChange={(e) => setLabel(e.target.value)} />
        <label className="btn btn-outline crm-import-label">
          Dosya seç
          <input
            type="file"
            hidden
            accept="image/*,.pdf,.doc,.docx"
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
        </label>
      </div>
      <ul className="crm-center-list">
        {crm.documents.map((doc) => {
          const dataUrl = doc.storageKey ? loadCrmAttachment(doc.storageKey) : undefined;
          return (
            <li key={doc.id}>
              <strong>{doc.label}</strong>
              {doc.fileName && <span>{doc.fileName}</span>}
              {dataUrl && (
                <a href={dataUrl} download={doc.fileName ?? doc.label} className="btn btn-sm btn-outline">
                  İndir
                </a>
              )}
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => store.removeCrmCustomerDocument(customer.id, doc.id)}
              >
                Sil
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
