# Posta E2E smoke (manuel ~15 dk)

Ortam: canlı POS veya staging, SMTP + IMAP yapılandırılmış.

## Akış A — iletişim → Gelen → yanıt → Gönderilen

1. Siteden iletişim formu gönderin (veya test kaydı API ile).
2. Posta **Gelen**’de yeni satır; rozet artar.
3. Satırı açın — mesaj metni okunabilir (JSON değil).
4. **Yanıt** → Yaz; kısa metin gönderin.
5. **Gönderilen**’de outbox `sent` (veya kuyruk → **Kuyruğu işle**).
6. Ayarlar → outbox CSV’de satırlar görünür.

## Akış B — müşteri mesajı

1. Posta → Müşteri mesajları → yeni thread + mesaj.
2. Ops e-postası açıksa `EKOLOJIK_OPS_EMAIL` kutusuna bildirim (SMTP gerekir).
3. Thread’de staff yanıtı; badge güncellenir (SSE ~15 sn).

## Akış C — otomatik VPS

```bash
bash /var/www/market-pos/scripts/sunucu-ekolojik-posta-parite-dogrula.sh
bash /var/www/market-pos/scripts/sunucu-ekolojik-smtp-dogrula.sh
```

Beklenen: health `smtpVerified: true`, hub API 200, export uçları dosya döner.

## Bilinen sınırlar (NB farkı)

- Dovecot/JMAP yok — IMAP tek kutu.
- AI compose, open/click analitiği yok.
- WebSocket yok; SSE veya periyodik yenileme.
