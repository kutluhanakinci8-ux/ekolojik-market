import { DEFAULT_TENANT_ID } from '../storage/tenantSession';
import { normalizeStoreCodeInput, storeCodePlaceholder } from '../config/knownTenants';

interface TenantStoreCodeFieldProps {
  tenantId: string;
  onTenantIdChange: (tenantId: string) => void;
  disabled?: boolean;
}

export function TenantStoreCodeField({ tenantId, onTenantIdChange, disabled }: TenantStoreCodeFieldProps) {
  const display = tenantId === DEFAULT_TENANT_ID ? '' : tenantId;

  return (
    <label>
      Mağaza kodu
      <input
        type="text"
        value={display}
        disabled={disabled}
        onChange={(e) => onTenantIdChange(normalizeStoreCodeInput(e.target.value))}
        placeholder={storeCodePlaceholder()}
        autoComplete="off"
      />
    </label>
  );
}
