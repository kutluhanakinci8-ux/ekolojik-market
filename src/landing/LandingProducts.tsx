import { useMemo, useState } from 'react';
import {
  getShopBrands,
  GREENLEAF_SHOP,
  productDisplayDescription,
  productDisplayFeatures,
  productDisplayName,
  type GreenleafShopProduct,
} from '../data/greenleafShopProducts';

function ProductDetailModal({
  product,
  onClose,
}: {
  product: GreenleafShopProduct;
  onClose: () => void;
}) {
  const bullets = productDisplayFeatures(product);

  return (
    <div className="landing-product-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="landing-product-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="product-modal-title"
      >
        <button type="button" className="landing-product-modal-close" onClick={onClose} aria-label="Kapat">
          ×
        </button>
        <div className="landing-product-modal-grid">
          <div className="landing-product-modal-image">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={productDisplayName(product)} loading="lazy" />
            ) : (
              <div className="landing-product-no-image">🌿</div>
            )}
          </div>
          <div className="landing-product-modal-body">
            <span className="landing-product-brand">{product.brand}</span>
            <h2 id="product-modal-title">{productDisplayName(product)}</h2>
            <div className="landing-product-meta-row">
              {product.boxQuantity != null && (
                <span className="landing-product-tag">Kutu: {product.boxQuantity} adet</span>
              )}
              {product.pv != null && product.pv > 0 && (
                <span className="landing-product-tag">PV: {product.pv}</span>
              )}
            </div>
            {productDisplayDescription(product) && (
              <p className="landing-product-description">{productDisplayDescription(product)}</p>
            )}
            {bullets.length > 0 && (
              <div className="landing-product-features">
                <h3>Özellikler</h3>
                <ul>
                  {bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline landing-product-source-link"
            >
              Greenleaf kaynağında görüntüle
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingProducts() {
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState('all');
  const [selected, setSelected] = useState<GreenleafShopProduct | null>(null);
  const brands = useMemo(() => getShopBrands(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GREENLEAF_SHOP.products.filter((product) => {
      if (brand !== 'all' && product.brand !== brand) return false;
      if (!q) return true;
      const haystack = `${productDisplayName(product)} ${product.name} ${product.brand} ${productDisplayDescription(product)}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, brand]);

  return (
    <section className="landing-section landing-products-section">
      <div className="landing-section-head">
        <h2>Ürünler</h2>
        <p>
          Greenleaf Global kataloğundan {GREENLEAF_SHOP.count} ürün — Türkçe özellikler ve detaylar.
          Fiyat bilgisi yayınlanmaz; güncel fiyatlar için POS paneline giriş yapın.
        </p>
      </div>

      <div className="landing-products-toolbar">
        <input
          type="search"
          className="landing-products-search"
          placeholder="Ürün veya marka ara..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="landing-products-filter"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
        >
          <option value="all">Tüm markalar</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <span className="landing-products-count">{filtered.length} ürün</span>
      </div>

      <div className="landing-products-grid">
        {filtered.map((product) => (
          <article key={product.slug} className="landing-product-card">
            <button
              type="button"
              className="landing-product-card-btn"
              onClick={() => setSelected(product)}
            >
              <div className="landing-product-card-image">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt="" loading="lazy" />
                ) : (
                  <span className="landing-product-no-image">🌿</span>
                )}
              </div>
              <div className="landing-product-card-body">
                <span className="landing-product-brand">{product.brand}</span>
                <h3>{productDisplayName(product)}</h3>
                {productDisplayDescription(product) && (
                  <p>
                    {productDisplayDescription(product).slice(0, 120)}
                    {productDisplayDescription(product).length > 120 ? '…' : ''}
                  </p>
                )}
                <div className="landing-product-card-tags">
                  {product.boxQuantity != null && (
                    <span>{product.boxQuantity} adet/kutu</span>
                  )}
                  {product.pv != null && product.pv > 0 && (
                    <span>{product.pv} PV</span>
                  )}
                </div>
              </div>
            </button>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="landing-products-empty">Aramanızla eşleşen ürün bulunamadı.</p>
      )}

      <p className="landing-products-source">
        Kaynak: <a href={GREENLEAF_SHOP.source} target="_blank" rel="noopener noreferrer">greenleaf-global.com/shop</a>
        · Son güncelleme: {new Date(GREENLEAF_SHOP.scrapedAt).toLocaleDateString('tr-TR')}
      </p>

      {selected && (
        <ProductDetailModal product={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
