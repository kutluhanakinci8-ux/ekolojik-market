# Mağaza verisi — otomatik kayıt (tenant bazlı)

Her mağaza (Greenleaf `main`, Lima `lima-market`, …) **aynı mantıkla** korunur; veriler birbirine karışmaz.

## 1) Sunucu — asıl kayıt (her mağaza ayrı dosya)

| Tenant | Canlı dosya |
|--------|-------------|
| Greenleaf | `data/store.json` |
| Diğer | `data/tenants/<tenantId>/store.json` |

**Her başarılı kayıt (API PUT veya otomatik senkron)** sonrası:

- Canlı dosya güncellenir.
- **Otomatik dönen yedek:** `data/backups/auto-tenant/<tenantId>/store-<zaman>.json`
- Varsayılan **son 48** kopya tutulur (`TENANT_AUTO_BACKUP_KEEP` ile değişir).

**Tüm mağazaları kapsayan arşiv:** deploy öncesi `data-backups/market-pos-data-*.tar.gz` (tüm `data/` klasörü).

## 2) Kasa PC (tarayıcı) — otomatik sunucuya gönderim

Yönetici oturumu + geçerli API token + yetkili kullanıcı (`kutluhan08` → yalnızca Greenleaf; `limaadmin` → Lima; `yonetici` → tümü):

- Stok, satış, müşteri, ayar, fotoğraf vb. değişince **~5 sn** sonra otomatik **Sunucuya Yükle** (manuel buton gerekmez).
- Sayfa ilk açılışında **4 sn** bekleme — sunucudan gelen veriyi yanlışlıkla ezmeyi önler.
- Sepet (henüz satış olmayan) otomatik sunucuya gitmez.

Durum: Ayarlar → **Veri Senkronu** («Sunucu ile senkron» / «Yalnızca bu cihaz»).

## 3) Manuel Tam Yedek (ek güvenlik)

- **Ayarlar → Tam Yedek:** JSON indir (cihazda ek kopya).
- Sunucu arşivi ve otomatik tenant yedekleri **operasyonel kurtarma** için; kullanıcıya «günlük Tam Yedek» hâlâ önerilir.

## 4) Yapılmaması gerekenler

- «Sunucudan yenile» onayı verip sonra veri kaybı şikâyeti (bilinçli üzerine yazma).
- `www` olmayan adres veya farklı tarayıcı profili (ayrı yerel depo).
- Lima hesabıyla Greenleaf verisini beklemek (farklı tenant).

## İlgili

- `docs/MULTI-TENANT-QA-REPORT-2026-10-12.md`
- `docs/DEPLOY-DATA-POLICY.md`
- `docs/MAIN-GELISTIRME.md`
