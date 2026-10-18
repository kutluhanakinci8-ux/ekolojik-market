import type { Store } from '../../store/useStore';
import { getCustomerCrmProfile } from '../../utils/crm/profile';

interface CustomerTagPickerProps {
  store: Store;
  customerId: string;
}

export function CustomerTagPicker({ store, customerId }: CustomerTagPickerProps) {
  const customer = store.customers.find((c) => c.id === customerId);
  if (!customer) return null;

  const crm = getCustomerCrmProfile(customer, store.crmSettings);
  const tags = store.crmData.tagDefinitions;

  const toggleTag = (tagId: string) => {
    const next = crm.tagIds.includes(tagId)
      ? crm.tagIds.filter((id) => id !== tagId)
      : [...crm.tagIds, tagId];
    store.updateCustomerCrm(customerId, { tagIds: next });
  };

  const addTag = () => {
    const label = window.prompt('Yeni etiket adı');
    if (!label?.trim()) return;
    const created = store.addCrmTag(label.trim());
    if (created) {
      store.updateCustomerCrm(customerId, { tagIds: [...crm.tagIds, created.id] });
    }
  };

  return (
    <div className="customer-tag-picker">
      <span className="customer-tag-picker-label">Etiketler</span>
      <div className="customer-tag-chips">
        {tags.map((tag) => {
          const active = crm.tagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              className={`customer-tag-chip ${active ? 'is-active' : ''}`}
              style={{ borderColor: tag.color, background: active ? `${tag.color}22` : undefined }}
              onClick={() => toggleTag(tag.id)}
            >
              {tag.label}
            </button>
          );
        })}
        <button type="button" className="customer-tag-chip customer-tag-chip--add" onClick={addTag}>
          + Etiket
        </button>
      </div>
    </div>
  );
}
