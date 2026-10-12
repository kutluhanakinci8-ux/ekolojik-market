# Çok kiracı (multi-tenant) kod denetimi — 2026-10-12

## Doğru yapılanlar (korunmalı)

- Sunucu dosya ayrımı: `data/store.json` (main) / `data/tenants/<id>/store.json`
- `/api/data` GET/PUT: token `tenantId` eşleşmesi, `tenantStoreGuard`, `tenantWritePolicy`
- POS `localStorage` çekirdek anahtarları: `posLocalStorageKeys()` (`::lima-market` suffix)
- Katalog izolasyonu: Lima’ya Greenleaf bulk yazılamaz / okunamaz
- Otomatik tenant yedek: `data/backups/auto-tenant/<id>/`
- Testler: `multi-tenant-data-safety-smoke.mjs`, `verify-tenant-isolation.mjs`

## Düzeltilen maddeler (tam liste)

| # | Sorun | Düzeltme |
|---|--------|----------|
| 1 | Muhasebe localStorage ortak | `accountingPersistence` tenant suffix |
| 2 | CRM / bekleyen satış / ekler ortak | tenant suffix |
| 3 | Lima boot sunucu ezmesi | `deviceHasLocalStoreData()` |
| 4 | Otomatik senkron token≠tenant | token tenant kontrolü |
| 5 | bill-email inbox auth’suz | `assertPosApiAuth` |
| 6 | `/app` + PIN mağaza kodu yok | `TenantStoreCodeField`, `/giris?tenant=`, PosApp yönlendirme |
| 7 | Tenant değişince kısmi state | `TENANT_ID_CHANGED` → tam local hydrate + oturum temizliği |
| 8 | `POST /api/auth/register` açık | Prod kapalı + rate limit (`EKOLOJIK_PUBLIC_REGISTER=1` ile açılır) |
| 9 | Posta outbox / contact listesi zayıf | outbox + `GET /api/contact/messages` admin auth; bill-email test/poll auth |
| 10 | authSession / quick user / API token ortak | tenant suffix + tenantId oturumda |
| 11 | `limaadmin` main store | main GET/PUT guard + girişte `lima*` → main engeli |
| 12 | `lima*` kullanıcı heuristic | Kaldırıldı; explicit mağaza kodu |
| 13 | bill-email istemci `?tenant=` | `posApiFetch` + tenant query |
| 14 | Logout / kiosk tenant | Tenant korunur; çapraz mağaza riski scoped session ile giderildi |
| 15 | Yanlış `?tenant=typo` | `tenantAllowlist` + prod strict; boş tenant 404 |

## Yapılandırma

- `config/known-tenants.json` — allowlist ve mağaza etiketleri
- `EKOLOJIK_TENANT_ALLOWLIST` — ops override (virgülle ayrılmış)
- `EKOLOJIK_TENANT_STRICT=0` — prod allowlist gevşetme (acil)
- `EKOLOJIK_PUBLIC_REGISTER=1` — prod kayıt açma

## Manuel test checklist

- [ ] Greenleaf: mağaza kodu boş, `kutluhan08`
- [ ] Lima: `lima-market` + `limaadmin` / kasiyer PIN
- [ ] `/app?tenant=lima-market` → girişte kod korunur
- [ ] Aynı tarayıcıda mağaza değiştir → sepet/oturum karışmaz
- [ ] Ayarlar → sürüm / senkron

## İlgili

- `docs/TENANT-AUTO-SAVE-POLICY.md`
- `docs/MULTI-TENANT-QA-REPORT-2026-10-12.md`
