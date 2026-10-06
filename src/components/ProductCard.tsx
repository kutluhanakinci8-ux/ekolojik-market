import type { Product, SaleMode } from '../types/product';
import { getCategoryLabel } from '../data/categories';
import { isValidGreenleafNumber } from '../utils/customerValidation';
import { formatCurrency } from '../utils/format';
import { getProductSalePrice, resolveSalePriceType } from '../utils/salePricing';
import { getPlaceholderImage, getProductImageUrl } from '../utils/productImage';
import { getSampleStock, isSampleProduct } from '../utils/sampleProduct';

interface ProductCardProps {
  product: Product;
  greenleafNumber: string;
  saleMode: SaleMode;
  lowStockThreshold: number;
  onAdd: (productId: number) => void;
  onAddSample: (productId: number) => void;
}

export function ProductCard({
  product,
  greenleafNumber,
  saleMode,
  lowStockThreshold,
  onAdd,
  onAddSample,
}: ProductCardProps) {
  const isSample = isSampleProduct(product);
  const sampleStock = getSampleStock(product);
  const displayStock = isSample ? sampleStock : product.stock;
  const outOfStock = displayStock <= 0;
  const isLowStock = !outOfStock && displayStock <= lowStockThreshold;
  const trimmedGl = greenleafNumber.trim();
  const canShowPrice = !trimmedGl || isValidGreenleafNumber(greenleafNumber);
  const priceType = resolveSalePriceType(greenleafNumber, saleMode);
  const price = getProductSalePrice(product, priceType, 10);

  const handleAdd = () => {
    if (outOfStock) return;
    if (isSample) {
      onAddSample(product.id);
      return;
    }
    onAdd(product.id);
  };

  return (
    <article className={`market-card ${outOfStock ? 'out-of-stock' : ''} ${isSample ? 'market-card--sample' : ''}`}>
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
        <img
          className="market-card-photo"
          src={getProductImageUrl(product)}
          alt={product.name}
          loading="lazy"
          draggable={false}
          onError={(e) => {
            e.currentTarget.src = getPlaceholderImage(product);
          }}
        />

        <div className="market-card-shade" aria-hidden />

        <div className="market-card-overlay">
          <div className="market-card-info">
            <span className="market-card-cat">{getCategoryLabel(product.category)}</span>
            <h3 className="market-card-name" title={product.name}>{product.name}</h3>
            <div className="market-card-price-row">
              {isSample ? (
                <span className="market-card-price market-card-price--sample">Numune · Ücretsiz</span>
              ) : canShowPrice ? (
                <span className="market-card-price">{formatCurrency(price)}</span>
              ) : null}
              <span
                className={`market-card-stock ${outOfStock ? 'is-out' : isLowStock ? 'is-low' : 'is-ok'}`}
                title={isSample ? 'Numune stok' : 'Satış stoku'}
              >
                Stok: {displayStock}
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className={`market-card-add ${isSample ? 'market-card-add--sample' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            handleAdd();
          }}
          disabled={outOfStock}
          aria-label={isSample ? 'Numune sepete ekle' : 'Sepete ekle'}
        >
          {isSample ? '🎁' : '+'}
        </button>

        {isSample && (
          <span className="market-badge sample">Numune</span>
        )}
        {!outOfStock && displayStock <= lowStockThreshold && (
          <span className="market-badge low">
            Az: {displayStock}
          </span>
        )}
        {outOfStock && (
          <span className="market-badge out">{isSample ? 'Numune bitti' : 'Tükendi'}</span>
        )}
      </div>
    </article>
  );
}
