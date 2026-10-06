import type { Product, SaleMode } from '../types/product';
import type { ProductSet } from '../types/productSet';
import { isValidGreenleafNumber } from '../utils/customerValidation';
import { formatCurrency } from '../utils/format';
import { getProductImageUrl, getPlaceholderImage } from '../utils/productImage';
import { resolveSalePriceType } from '../utils/salePricing';
import { getProductSetSalePrice } from '../utils/setPricing';

interface SetCardProps {
  set: ProductSet;
  products: Product[];
  greenleafNumber: string;
  saleMode: SaleMode;
  onAdd: (setId: string) => void;
}

export function SetCard({
  set,
  products,
  greenleafNumber,
  saleMode,
  onAdd,
}: SetCardProps) {
  const outOfStock = set.stock <= 0 || !set.isActive;
  const trimmedGl = greenleafNumber.trim();
  const canShowPrice = !trimmedGl || isValidGreenleafNumber(greenleafNumber);
  const priceType = resolveSalePriceType(greenleafNumber, saleMode);
  const price = getProductSetSalePrice(set, priceType, 1);
  const coverProduct = products.find((p) => p.id === set.items[0]?.productId);
  const itemCount = set.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAdd = () => {
    if (outOfStock) return;
    onAdd(set.id);
  };

  return (
    <article className={`market-card market-card--set ${outOfStock ? 'out-of-stock' : ''}`}>
      <div
        className={`market-card-media ${!outOfStock ? 'clickable' : ''}`}
        onClick={!outOfStock ? handleAdd : undefined}
        role={!outOfStock ? 'button' : undefined}
        tabIndex={!outOfStock ? 0 : undefined}
        onKeyDown={(e) => {
          if (!outOfStock && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleAdd();
          }
        }}
      >
        {coverProduct ? (
          <img
            className="market-card-photo"
            src={getProductImageUrl(coverProduct)}
            alt={set.name}
            loading="lazy"
            draggable={false}
            onError={(e) => {
              e.currentTarget.src = getPlaceholderImage(coverProduct);
            }}
          />
        ) : (
          <div className="set-card-placeholder" aria-hidden>🎁</div>
        )}

        <div className="market-card-shade" aria-hidden />

        <div className="market-card-overlay">
          <div className="market-card-info">
            <span className="market-card-cat">Set · {set.stockCode}</span>
            <h3 className="market-card-name" title={set.name}>{set.name}</h3>
            {canShowPrice && (
              <span className="market-card-price">{formatCurrency(price)}</span>
            )}
          </div>
        </div>

        <div className="market-card-badge-layer">
          <span className="market-card-stock-badge">{set.stock}</span>
          <span className="set-card-items-badge">{itemCount} ürün</span>
        </div>

        <button
          type="button"
          className="market-card-add"
          onClick={handleAdd}
          disabled={outOfStock}
          aria-label={`${set.name} setini sepete ekle`}
        >
          +
        </button>
      </div>
    </article>
  );
}
