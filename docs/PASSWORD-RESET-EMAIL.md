# Şifre sıfırlama e-postası (bildirim@)

## Rakipler / sektör standardı

| Uygulama | Gönderen (From) | Alıcı (To) | İçerik |
|----------|-----------------|------------|--------|
| Square, Shopify, Lightspeed | `notifications@` / `no-reply@` (işlem e-postası) | Kullanıcının **kayıtlı e-postası** | Tek kullanımlık link, süre (ör. 1 saat), “ben yapmadım” metni |
| Pazarlama bülteni | `news@` / ayrı subdomain | Segment | Kampanya — **şifre reset ile aynı IP kullanılmaz** |
| EkoPos (Greenleaf) | **`bildirim@ekolojikmarket.com.tr`** (`EKOLOJIK_MAIL_FROM`) | Kullanıcı **`recoveryEmail`** | HTML + düz metin, 60 dk token, Reply-To: `info@` |

Özet kurallar (Postmark, SendLayer, Notify vb. rehberlerle uyumlu):

1. **Şifreyi e-postada asla göndermeyin** — yalnızca sıfırlama linki.
2. **From** tanınır marka + doğrulanmış domain (bizde `bildirim@`).
3. **Reply-To** izlenen destek kutusu (`info@`).
4. **To** kullanıcının hesabına bağlı e-posta; formda kullanıcı adı + e-posta **eşleşmeli** (hesap keşfini zorlaştırır).
5. Başarısız eşleşmede de **aynı genel mesaj** (“kayıtlıysanız mail gitti”).
6. SPF / DKIM / DMARC — `docs/EKOLOJIK-DNS-TURHOST-PANEL.md`.

## EkoPos akışı

1. Yönetici: **Ayarlar → Kullanıcılar** → «Şifre sıfırlama e-postası» (her kullanıcı için).
2. Kullanıcı: **Giriş → Şifremi unuttum** → kullanıcı adı + kayıtlı e-posta.
3. Sunucu: `POST /api/auth/password-reset-request` → outbox → SMTP → **bildirim@** ile gönderim.
4. Kullanıcı linke tıklar → `/giris?reset=...` → yeni şifre → `POST /api/auth/password-reset-confirm`.

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `EKOLOJIK_MAIL_FROM` | `bildirim@ekolojikmarket.com.tr` |
| `EKOLOJIK_MAIL_REPLY_TO` | `info@ekolojikmarket.com.tr` |
| `GREENLEAF_OWNER_RECOVERY_EMAIL` | `kutluhan08` için sıfırlama e-postası (ensure script) |

Posta Merkezi’nde gelen kutusu **info@** içindir; **giden** otomatik bildirimler **bildirim@** ile gider (plan 6.5).
