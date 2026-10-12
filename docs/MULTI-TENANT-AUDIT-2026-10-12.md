# Çok kiracı (multi-tenant) kod denetimi — 2026-10-12

## Doğru yapılanlar (korunmalı)

- Sunucu dosya ayrımı: `data/store.json` (main) / `data/tenants/<id>/store.json`
- `/api/data` GET/PUT: token `tenantId` eşleşmesi, `tenantStoreGuard`, `tenantWritePolicy`
- POS `localStorage` çekirdek anahtarları: `posLocalStorageKeys()` (`::lima-market` suffix)
- Katalog izolasyonu: Lima’ya Greenleaf bulk yazılamaz / okunamaz
- Otomatik tenant yedek: `data/backups/auto-tenant/<id>/`
- Testler: `multi-tenant-data-safety-smoke.mjs`, `verify-tenant-isolation.mjs`

## Bu turda düzeltilen hatalar

| # | Sorun | Düzeltme |
|---|--------|----------|
| 1 | Muhasebe localStorage **tüm mağazalar ortak** → Lima snapshot’a Greenleaf muhasebe karışabilirdi | `accountingPersistence.ts` tenant suffix; izole tenant’ta merge yalnızca sunucu |
| 2 | CRM / bekleyen satış / CRM ekleri ortak anahtar | `crmPersistence`, `heldPosSales`, `crmAttachments` → `tenantLocalStorageSuffix()` |
| 3 | Lima sayfa açılışında **her zaman** sunucu → yerel eziliyordu | `useStore` boot: `deviceHasLocalStoreData()` (main ile aynı mantık) |
| 4 | Otomatik sunucu kaydı token≠tenant iken çalışabilirdi | `scheduleAdminServerSync` + `persistStoreNow` token tenant kontrolü |
| 5 | `GET /api/bill-email/inbox` kimlik doğrulamasız | `assertPosApiAuth` eklendi |

## Açık kalan riskler (öncelik sırasıyla)

### Yüksek

1. **`/app` girişi mağaza kodu sormuyor** — Lima için önce `/giris?tenant=lima-market` veya mağaza kodu gerekir (`LoginScreen` vs `LandingLogin`).
2. **PIN girişi** landing’de tenant seçimi zayıf (`PinLoginPad`).
3. **Tenant değişince** sadece `products` yenileniyor; satış/sepet bellekte kalabilir (`TENANT_ID_CHANGED_EVENT` — tam state reset önerilir).
4. **`POST /api/auth/register`** herkese açık — prod’da rate limit / kapalı kayıt düşünün.
5. **Email outbox / contact** bazı route’lar global veya zayıf auth — Posta modülü; POS kasa için ayrı.

### Orta

6. `authSession` / `lastQuickUser` tenant’a göre ayrılmıyor — tenant değişiminde temizlenmeli.
7. `main` store’da `limaadmin` kullanıcısı **yasak değil** (canlıda görüldü) — operasyonel temizlik + isteğe bağlı sunucu kuralı.
8. `lima*` kullanıcı adı → `lima-market` heuristic (`LandingLogin`) — kırılgan; explicit mağaza kodu daha iyi.
9. Bill-email **istemci** bazı çağrılarda `?tenant=` eksik olabilir — auth sonrası gözden geçirin.

### Düşük

10. Logout tenant id’yi silmiyor (Lima kiosk için kasıtlı olabilir).
11. Yanlış `?tenant=typo` yeni boş tenant dizini açabilir — prod allowlist.

## Manuel test checklist (mağaza başına)

- [ ] Doğru kullanıcı + tenant ile giriş
- [ ] Stok/fotoğraf değiştir → diğer cihazda görünür
- [ ] Diğer mağaza kullanıcısı ile aynı tarayıcıda **veri karışmıyor**
- [ ] Ayarlar → sürüm ve senkron satırı

## İlgili

- `docs/TENANT-AUTO-SAVE-POLICY.md`
- `docs/MULTI-TENANT-QA-REPORT-2026-10-12.md`
