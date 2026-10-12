import { useState } from 'react';
import { DEFAULT_TENANT_ID } from '../storage/tenantSession';
import { TenantStoreCodeField } from './TenantStoreCodeField';

interface LoginTenantStoreSectionProps {
  tenantId: string;
  onTenantIdChange: (tenantId: string) => void;
  /** URL veya kayıtlı kod ile Lima vb. — alan baştan açık */
  initialExpanded?: boolean;
  /** Greenleaf sahibi — mağaza kodu gösterilmez, her zaman main */
  hideForOwnerAccount?: boolean;
}

/**
 * Varsayılan giriş: mağaza kodu gizli (Greenleaf / main).
 * Diğer tenant’lar: «Farklı mağaza kodu» ile açılır — kurumsal ekranda Lima adı geçmez.
 */
export function LoginTenantStoreSection({
  tenantId,
  onTenantIdChange,
  initialExpanded = false,
  hideForOwnerAccount = false,
}: LoginTenantStoreSectionProps) {
  const [expanded, setExpanded] = useState(
    initialExpanded || (tenantId !== DEFAULT_TENANT_ID && tenantId.trim() !== ''),
  );

  if (hideForOwnerAccount) {
    return null;
  }

  if (!expanded) {
    return (
      <p className="login-tenant-advanced-toggle">
        <button
          type="button"
          className="btn btn-text"
          onClick={() => setExpanded(true)}
        >
          Farklı mağaza kodu ile giriş
        </button>
      </p>
    );
  }

  return (
    <div className="login-tenant-advanced-panel">
      <TenantStoreCodeField tenantId={tenantId} onTenantIdChange={onTenantIdChange} />
      {tenantId === DEFAULT_TENANT_ID ? (
        <button
          type="button"
          className="btn btn-text"
          onClick={() => {
            onTenantIdChange(DEFAULT_TENANT_ID);
            setExpanded(false);
          }}
        >
          Mağaza kodunu gizle
        </button>
      ) : null}
    </div>
  );
}
