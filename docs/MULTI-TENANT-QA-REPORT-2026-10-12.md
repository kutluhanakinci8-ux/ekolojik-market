# Çok mağaza (multi-tenant) QA raporu — 2026-10-12

Bu rapor **teknik doğrulama** özetidir; hukuki garanti değildir. Canlı tazminat riskini azaltmak için **otomatik test + sunucu kontrolü + kalan manuel adımlar** birlikte değerlendirilmelidir.

## Sonuç (özet)

| Alan | Durum | Not |
|------|--------|-----|
| Mağazalar ayrı dosya / tenant | **Geçti** | `data/store.json` (Greenleaf) ≠ `data/tenants/lima-market/store.json` |
| Ayrı giriş / şifre / API token | **Geçti** | Token yalnızca kendi `tenantId` için geçerli (403 çapraz erişim) |
| Lima ↔ Greenleaf katalog karışması | **Geçti** (guard) | Sunucu `tenantStoreGuard` bulk Greenleaf yazımını/okumasını engeller |
| kutluhan08 yalnızca Greenleaf yazımı | **Geçti** | `tenantWritePolicy` — Lima PUT → 403 |
| Otomatik test paketi | **Geçti** | `scripts/multi-tenant-data-safety-smoke.mjs` + `npm test` |
| Veri kaybı sıfır risk | **Kısmi** | Aşağıdaki «Kalan riskler» — kullanıcı eğitimi + yedek zorunlu |

## Otomatik testler (bu çalıştırma)

```bash
node scripts/multi-tenant-data-safety-smoke.mjs
npm test
```

Doğrulananlar:

1. **İzolasyon birimi:** Lima tenant’a 137’lik Greenleaf listesi yazılamaz; okuma sanitize edilir.
2. **HTTP:** `kutluhan08` / `limaadmin` ayrı token; `main` token → `lima-market` verisi **403**.
3. **Yükleme:** Greenleaf ayar ve Lima ürün sunucuya PUT sonrası GET ile doğrulanır; kutluhan Lima’ya yazamaz.

## Canlı sunucu (VPS) kontrolü — 2026-10-12

| Mağaza | Dosya | Ürün | Satış | Yönetici hesapları |
|--------|-------|------|-------|-------------------|
| Greenleaf | `store.json` | 137 | 36 | yonetici, kutluhan08, … |
| Lima | `tenants/lima-market/store.json` | 4 | 75 | limaadmin |

Deploy öncesi **data yedekleri:** `/var/www/market-pos/data-backups/market-pos-data-*.tar.gz` (son kayıtlar mevcut).

## Mağaza başına kullanım (operasyon)

| Mağaza | Tenant | Giriş | Adres |
|--------|--------|-------|--------|
| Greenleaf Market | `main` (varsayılan) | `kutluhan08` | `https://www.ekolojikmarket.com.tr/app` |
| Lima Market | `lima-market` | `limaadmin` | Aynı URL; giriş sonrası tenant token ile |

**Önemli:** `limaadmin` Greenleaf’e, `kutluhan08` Lima sunucu dosyasına **yazamaz** (politika). Platform: `yonetici` tüm tenant.

## Veri kaybını önleyen ürün kuralları (main’de)

- Sunucu dosyaları tenant’a göre ayrı.
- Girişte / sayfa açılışında **yerel veri varsa sunucu otomatik ezilmez** (#75).
- Greenleaf özel fotoğraflar sunucuya yazılır (#76); yönetici değişikliklerinde gecikmeli otomatik push.
- «Sunucudan yenile» Mac’te **uyarı** ile.
- Deploy **veri klasörünü silmez** (`DEPLOY-DATA-POLICY.md`).

## Kalan riskler (tazminat için kritik)

1. **«Sunucudan yenile» onayı** — kullanıcı onaylarsa yerel yenilikler silinir (tasarım gereği).
2. **Başarısız «Sunucuya Yükle»** — veri yalnızca tarayıcıda kalır; cihaz değişimi / önbellek temizliği riski.
3. **Yanlış URL** (`www` olmayan) — ayrı `localStorage`.
4. **Tam yedek JSON** — Greenleaf özel resimler artık sunucuda da tutulur; yine de **haftalık Tam Yedek** önerilir.
5. **Manuel uç senaryolar** — çoklu sekme, aynı anda iki cihazda çakışan yazım: son `updatedAt` kazanır (klasik POS).

## Önerilen canlı kabul testi (15 dk / mağaza)

Her yeni mağaza veya büyük güncelleme öncesi:

1. **Tam Yedek** indir.
2. Test ürününde stok/fotoğraf değiştir → 5 sn bekle → başka cihazda/tarayıcıda aynı kullanıcı ile kontrol.
3. Ayarlar → **Uygulama (canlı)** sürümü tüm cihazlarda aynı mı bak.
4. Lima ve Greenleaf’i **aynı oturumda karıştırmayın** (farklı kullanıcı).

## Regresyon

Bu rapor commit’i ile birlikte `multi-tenant-data-safety-smoke` CI unit zincirine eklendi.
