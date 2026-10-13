# Ekolojik platform operatörü (kutluhan08)

## Amaç

`kutluhan08` artık **Greenleaf (`main`) mağaza kullanıcı listesinde değil**. Tüm kiracıları (`main`, `lima-market`, …) tek merkezden izleyen ve gerektiğinde her birinin POS’una geçen **platform operatörü** hesabıdır.

## Giriş

1. **Giriş** sayfasında kullanıcı adı: `kutluhan08` (veya `kutluhan` / `kutluhanakinci8`)
2. Mağaza kodu **gerekmez** (otomatik platform oturumu)
3. Başarılı giriş → **`/platform`** konsolu

## Konsol (`/platform`)

1. **Cari & tahsilat** — kiracı bazında açık cari, 30 gün tahsilat, en borçlu müşteriler
2. **Otomatik uyarılar** — gecikmiş ödemeler, bugünkü vadeler, düşük stok, eksik sıfırlama e-postası
3. **Birleşik ödeme takvimi** — tüm kiracıların `paymentReminders` (elektrik, su, vergi, kira vb.) tek görünümde
4. **POS aç** — seçilen kiracı için tam POS (`/app`)

API: `GET /api/platform/alerts`, `GET /api/platform/calendar?year=&month=`

## Teknik

| Bileşen | Açıklama |
|---------|----------|
| Kimlik | `data/credential-vault/_platform.json` + `data/platform/operators.json` |
| Token | `role: platform`, `tenantId: __platform__` — kiracı API’lerinde yönetici yetkisi |
| API | `GET /api/platform/tenants`, `GET /api/platform/tenants/:id` |
| Deploy | `GREENLEAF_OWNER_PASSWORD` → `scripts/ensure-platform-operator.mjs` |

`yonetici` hesabı kiracı içi demo/platform yedek giriş olarak kalabilir; `kutluhan08` yalnızca platform kasasında tutulur.
