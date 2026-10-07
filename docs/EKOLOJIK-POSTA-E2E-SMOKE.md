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

Tek komut:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-e2e-tam.sh
```

Veya adım adım:
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-parite-dogrula.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-smtp-dogrula.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-imap-dogrula.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-gelen-smoke.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-akis-a-smoke.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-akis-b-smoke.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh
```

Beklenen: health `smtpVerified: true`, `imapVerified: true`, Gelen smoke test maili listede.

## Akış C sonrası — Faz 5 kabul sırası

Akış C’yi zaten çalıştırdıysanız:

```bash
EKOLOJIK_SKIP_E2E=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-kabul-sira.sh
```

DNS TXT + failed arşiv dahil:

```bash
EKOLOJIK_SKIP_E2E=1 EKOLOJIK_RUN_DNS=1 EKOLOJIK_ARCHIVE_FAILED=1 \
  bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-kabul-sira.sh
```

Tam kabul (E2E atlanmış + ops adım 3–4):

```bash
EKOLOJIK_SKIP_E2E=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-kabul-sira.sh
```

Yalnızca Faz 5 otomatik kapı:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh
```

## Akış D — Faz 22 tam parite (API + manuel)

Otomatik kapı:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

Manuel (~20 dk):

| Adım | NB | Ekolojik |
|------|-----|----------|
| 1 | Konuşma | Gelen → **Konuşma** → zincir aç |
| 2 | İlet | Gelen detay → **İlet** → gönder veya taslak |
| 3 | IMAP Junk | Spam klasörü + **IMAP yenile** |
| 4 | Mesaj thread | Müşteri mesajları → yanıt + ek |
| 5 | Toplu / depolama | Seç → arşiv; üstte depolama % |
| 6 | Kurallar | Ayarlar → Fatura kuralı kayıtlı |

E2E API smoke (Akış C sonunda da çalışır):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-e2e-smoke.sh
```

## Bilinen sınırlar (NB farkı — bilinçli)

- Dovecot/JMAP yok — standart IMAP klasörleri.
- Açılma/tıklama ESP seviyesinde değil; `EKOLOJIK_MAIL_TRACK=1` ile lite piksel.
- AI compose harici API ile opsiyonel; kapalı varsayılan.
- WebSocket yok; SSE veya periyodik yenileme.
