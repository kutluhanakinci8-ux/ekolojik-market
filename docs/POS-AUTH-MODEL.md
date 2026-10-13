# POS kimlik doğrulama modeli (Greenleaf / EkoPos)

## Rakiplerde neden sorun çıkmıyor?

| Yaklaşım | Square / Shopify POS | EkoPos (eski) | EkoPos (yeni) |
|----------|----------------------|---------------|---------------|
| Oturum | Sunucu token (OAuth / merchant login) | Sunucu token (`/api/auth/pos-token`) | Aynı |
| Şifre hash konumu | **Asla** kasa snapshot’ında değil | `store.json` içinde `users[]` | **`credential-vault/{tenant}.json`** + store |
| Tarayıcı senkronu | Ürün, satış, stok | Tüm mağaza + kullanıcı listesi | Kullanıcı listesi **sırlar olmadan** |
| PUT ile şifre silme | Mümkün değil | Mümkündü (boş hash) | **Engellendi** |

Eski tasarımda istemci her 5 saniyede `PUT /api/data` ile kullanıcı dizisini gönderiyordu; API cevabında hash olmadığı için tarayıcı boş `passwordHash` ile sunucuyu ezebiliyordu. Rakipler bu veriyi hiç senkron etmez.

## Yeni kurallar

1. **`credential-vault/`** — `passwordHash`, `pinHash`, `totpSecret` yalnızca burada ve diskteki `store.json` kopyasında (vault’tan hydrate).
2. **PUT `/api/data`** — İstemciden gelen sırlar strip edilir; yalnızca geçerli yeni SHA-256 hash (şifre değişimi) kabul edilir.
3. **`mergeStoreUserSecrets`** — Boş gelen alanlar disk + vault ile doldurulur.
4. **`usersForServerSnapshot` (istemci)** — Boş hash sunucuya gönderilmez.

## Operasyon

- Şifre sıfırlama: `node scripts/ensure-greenleaf-credentials.mjs` (VPS) veya Ayarlar → kullanıcı şifresi değiştir.
- Giriş testi: `POST /api/auth/pos-token` body `{"username":"kutluhan08","password":"..."}`.

## Bilinen kullanıcılar (main tenant)

- `kutluhan08` — mağaza sahibi (şifre işletme tarafından belirlenir)
- `yonetici` — varsayılan demo admin (`yonetici123` seed hash)
- `kasiyer` — `kasiyer123`
