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
5. **Kullanıcı işlemleri** sekmesi — toplam/aktif/terk, uyuyan hesaplar, 2FA ve e-posta kapsamı, mağaza özeti, filtreli kullanıcı dizini, son giriş akışı (`GET /api/platform/users`)
6. **Kiracılar** sekmesi — plan/deneme, askıya alma, salt okunur mod, operasyon notları (`GET /api/platform/tenants/lifecycle`, `PUT /api/platform/tenants/:id/lifecycle`)
7. **Altyapı** sekmesi — izolasyon kontrolleri, outbox, depolama, yedek/cron, SMTP/IMAP canlı test (`GET /api/platform/infrastructure`, `POST /api/platform/infrastructure/probe`)
8. **Denetim** sekmesi — olay zaman çizelgesi, bildirim geçmişi, eşik uyarıları, CSV (`GET /api/platform/audit`, `GET /api/platform/audit/export.csv`)

API: `GET /api/platform/alerts`, `GET /api/platform/calendar?year=&month=`, `GET /api/platform/users`, `GET /api/platform/tenants/lifecycle`

Askıya alınan veya denemesi biten kiracılarda mağaza girişi engellenir (`data/platform/tenant-lifecycle.json`).

## Teknik

| Bileşen | Açıklama |
|---------|----------|
| Kimlik | `data/credential-vault/_platform.json` + `data/platform/operators.json` |
| Token | `role: platform`, `tenantId: __platform__` — kiracı API’lerinde yönetici yetkisi |
| API | `GET /api/platform/tenants`, `GET /api/platform/tenants/:id` |
| Deploy | `GREENLEAF_OWNER_PASSWORD` → `scripts/ensure-platform-operator.mjs` |

`yonetici` hesabı kiracı içi demo/platform yedek giriş olarak kalabilir; `kutluhan08` yalnızca platform kasasında tutulur.
