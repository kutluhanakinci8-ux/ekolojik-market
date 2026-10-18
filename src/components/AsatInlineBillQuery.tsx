import type { UtilityBillSubscription } from '../types/utilityBillSubscription';
import { requestAsatSubscriptionSync } from './AsatPortalPanel';

interface AsatInlineBillQueryProps {
  subscription: UtilityBillSubscription;
}

/** Kart içi kısa yönlendirme — portal üst panelde açılır. */
export function AsatInlineBillQuery({ subscription }: AsatInlineBillQueryProps) {
  return (
    <div className="asat-inline-query asat-inline-query--compact">
      <p className="module-hint">
        Sözleşme <strong>{subscription.contractNumber}</strong> — üstteki portalda giriş yaptığınızda
        borçlar otomatik okunur ve takvime işlenir.
      </p>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        onClick={() => requestAsatSubscriptionSync(subscription)}
      >
        Bu sözleşmeyi portalda göster
      </button>
    </div>
  );
}
