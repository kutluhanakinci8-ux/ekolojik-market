# Ekolojik platform operatörü (kutluhan08)

## Amaç

`kutluhan08` artık **Greenleaf (`main`) mağaza kullanıcı listesinde değil**. Tüm kiracıları (`main`, `lima-market`, …) tek merkezden izleyen ve gerektiğinde her birinin POS’una geçen **platform operatörü** hesabıdır.

## Giriş

1. **Giriş** sayfasında kullanıcı adı: `kutluhan08` (veya `kutluhan` / `kutluhanakinci8`)
2. Mağaza kodu **gerekmez** (otomatik platform oturumu)
3. Başarılı giriş → **`/platform`** konsolu

## Konsol (`/platform`)

- Tüm kiracıların özet tablosu: ürün sayısı, düşük stok, son 30 gün satış, aktif kullanıcı
- **Detay**: kullanıcılar, 2FA, şifre sıfırlama e-postası eksikleri
- **POS aç**: seçilen kiracı için `/app` (stok, muhasebe, tahsilat — tam POS)

## Teknik

| Bileşen | Açıklama |
|---------|----------|
| Kimlik | `data/credential-vault/_platform.json` + `data/platform/operators.json` |
| Token | `role: platform`, `tenantId: __platform__` — kiracı API’lerinde yönetici yetkisi |
| API | `GET /api/platform/tenants`, `GET /api/platform/tenants/:id` |
| Deploy | `GREENLEAF_OWNER_PASSWORD` → `scripts/ensure-platform-operator.mjs` |

`yonetici` hesabı kiracı içi demo/platform yedek giriş olarak kalabilir; `kutluhan08` yalnızca platform kasasında tutulur.
