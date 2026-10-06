# Posta sekmesi — operatör kılavuzu (Ekolojik Market POS)

NB **Lerta Posta** ile aynı **düzen** (Yaz · Gelen · Müşteri mesajları · Gönderilen); veri ve sunucu **Ekolojik’e özeldir**.

## Menü

1. Üst menüden **Posta** — yanındaki rozet okunmamış iletişim + IMAP + mesaj sayısını gösterir.
2. Sol sütun: klasörler (Gelen, Gönderilen, Fatura filtresi, Arşiv).
3. Orta: liste; sağ: okuma / yazma paneli.

## Gelen

- **Senkronize et** (IMAP yapılandırıldıysa) `info@` kutusunu çeker.
- İletişim formu satırları ve e-postalar birlikte listelenir.
- Satıra tıklayınca gövde okunur; **Yanıt** Yaz panelini doldurur.

## Yaz

- Alıcı: müşteri kitaplığı + son iletişim adresleri (otomatik tamamlama).
- Hazır şablonlar (sipariş, stok, teşekkür, KVKK vb.).
- Gönderim Ekolojik outbox + SMTP üzerinden gider.

## Müşteri mesajları

- Thread listesi; alttan mesaj yazın, ek ekleyin.
- **Yeni thread**: müşteri seçerek açın.
- Müşteri kartından **Posta sekmesinde aç** deep link ile aynı ekrana gelir.

## Gönderilen

- Outbox kayıtları: kuyruk, gönderildi, hata.
- Hatalı satırda **Tekrar dene**.

## Ayarlar → E-posta

- SMTP durumu, test maili, kuyruk işleme.
- **Faz 11**: gönderen adı, Reply-To, ops e-postası, imza, bildirim aç/kapa.
- **Rapor**: Outbox CSV, iletişim CSV, mesajlaşma ZIP (KVKK).

## Altyapı hatırlatması

- `.env`: `EKOLOJIK_SMTP_HOST=mail.ekolojikmarket.com.tr` (VPS IP değil).
- `LERTA_PLATFORM_BRIDGE=0` — NB posta API kullanılmaz.

VPS doğrulama: `bash scripts/sunucu-ekolojik-posta-parite-dogrula.sh`
