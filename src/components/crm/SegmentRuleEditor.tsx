import type { CrmSegmentRule } from '../../types/crm';

const FIELDS: Array<{ value: CrmSegmentRule['field']; label: string }> = [
  { value: 'days_since_purchase', label: 'Son alışverişten gün' },
  { value: 'lifetime_spend', label: 'Ömür boyu ciro' },
  { value: 'open_balance', label: 'Açık bakiye' },
  { value: 'loyalty_tier', label: 'Sadakat kademesi' },
  { value: 'tag', label: 'Etiket ID' },
];

const OPS: Array<{ value: CrmSegmentRule['operator']; label: string }> = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq', label: '=' },
  { value: 'includes', label: 'içerir' },
];

interface SegmentRuleEditorProps {
  rules: CrmSegmentRule[];
  onChange: (rules: CrmSegmentRule[]) => void;
}

export function SegmentRuleEditor({ rules, onChange }: SegmentRuleEditorProps) {
  const updateRule = (id: string, patch: Partial<CrmSegmentRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addRule = () => {
    onChange([
      ...rules,
      { id: `rule-${Date.now()}`, field: 'days_since_purchase', operator: 'gt', value: '90' },
    ]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="segment-rule-editor">
      {rules.map((rule) => (
        <div key={rule.id} className="segment-rule-row">
          <select
            value={rule.field}
            onChange={(e) => updateRule(rule.id, { field: e.target.value as CrmSegmentRule['field'] })}
          >
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={rule.operator}
            onChange={(e) => updateRule(rule.id, { operator: e.target.value as CrmSegmentRule['operator'] })}
          >
            {OPS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={rule.value}
            onChange={(e) => updateRule(rule.id, { value: e.target.value })}
            placeholder="Değer"
          />
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeRule(rule.id)}>Sil</button>
        </div>
      ))}
      <button type="button" className="btn btn-sm btn-outline" onClick={addRule}>Kural ekle</button>
    </div>
  );
}
