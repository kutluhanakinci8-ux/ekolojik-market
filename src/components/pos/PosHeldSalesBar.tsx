import type { Store } from '../../store/useStore';
import { formatCurrency } from '../../utils/format';

interface PosHeldSalesBarProps {
  store: Store;
  onRecalled?: () => void;
}

export function PosHeldSalesBar({ store, onRecalled }: PosHeldSalesBarProps) {
  const held = store.heldPosSales;
  if (held.length === 0) return null;

  return (
    <div className="pos-held-bar" role="region" aria-label="Bekletilen satışlar">
      <span className="pos-held-bar__label">Bekleyen ({held.length})</span>
      <ul className="pos-held-bar__list">
        {held.map((entry) => {
          const total = entry.cart
            .filter((i) => i.priceType !== 'sample')
            .reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="pos-held-bar__btn"
                onClick={() => {
                  store.recallHeldSale(entry.id);
                  onRecalled?.();
                }}
              >
                {entry.label}
                <em>{formatCurrency(total)} · {entry.cart.length} kalem</em>
              </button>
              <button
                type="button"
                className="pos-held-bar__discard"
                aria-label="Sil"
                onClick={() => store.discardHeldSale(entry.id)}
              >
                ✕
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
