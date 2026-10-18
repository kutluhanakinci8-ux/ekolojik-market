import { formatBusinessBrand } from '../utils/format';
import type { AppSettings } from '../types/business';

interface PosTenantBootstrapProps {
  settings: AppSettings;
}

/** Mağaza verisi senkronize olana kadar satış ekranının Greenleaf kataloğu ile flaşlamasını engeller. */
export function PosTenantBootstrap({ settings }: PosTenantBootstrapProps) {
  return (
    <div className="pos-tenant-bootstrap" role="status" aria-live="polite">
      <div className="pos-tenant-bootstrap-card">
        <span className="pos-tenant-bootstrap-spinner" aria-hidden />
        <p className="pos-tenant-bootstrap-title">{formatBusinessBrand(settings.businessName)}</p>
        <p className="pos-tenant-bootstrap-hint">Mağaza verileri yükleniyor…</p>
      </div>
    </div>
  );
}
