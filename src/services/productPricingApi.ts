import type { ProductPricingInput } from '../utils/productPricing';
import type { Product } from '../types/product';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from './posApiAuth';

function pricingApiUrl(): string {
  const tenant = loadTenantId();
  const base = '/api/store/product-pricing';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

const PRICING_PATCH_TIMEOUT_MS = 20_000;

export async function patchProductPricingOnServer(
  productId: number,
  input: ProductPricingInput,
): Promise<{ ok: boolean; product?: Product; error?: string; httpStatus?: number }> {
  try {
    const res = await posApiFetch(pricingApiUrl(), {
      method: 'PATCH',
      headers: posApiAuthHeaders({ 'Content-Type': 'application/json', Accept: 'application/json' }),
      body: JSON.stringify({ productId, ...input }),
      signal: AbortSignal.timeout(PRICING_PATCH_TIMEOUT_MS),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      product?: Product;
      error?: string;
      message?: string;
    };
    if (!res.ok || !data.ok || !data.product) {
      return {
        ok: false,
        httpStatus: res.status,
        error: data.error ?? data.message ?? 'Fiyat sunucuya kaydedilemedi',
      };
    }
    return { ok: true, product: data.product };
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      ok: false,
      error: timedOut
        ? 'Sunucu yanıt vermedi (20 sn) — sayfayı yenileyip tekrar deneyin'
        : 'Bağlantı hatası — fiyat sunucuya yazılamadı',
    };
  }
}
