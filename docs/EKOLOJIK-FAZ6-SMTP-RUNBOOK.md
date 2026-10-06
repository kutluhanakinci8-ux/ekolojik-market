# Faz 6 — Ekolojik SMTP (VPS)

**Belirti:** `connect ECONNREFUSED …:587` — `mail.ekolojikmarket.com.tr` bu VPS IP’sine işaret eder ama **587 dinlemiyor**.

## Seçenek A — Aynı VPS (önerilen, hızlı)

POS ve Postfix **aynı sunucuda** ise uygulama dış IP’ye değil **localhost** kullanmalı:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-postfix-yerel-relay-kur.sh --apply
```

`.env` sonrası:

- `EKOLOJIK_SMTP_HOST=127.0.0.1`
- `EKOLOJIK_SMTP_PORT=25`
- `EKOLOJIK_SMTP_USER` / `PASS` boş

Doğrulama:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-smtp-dogrula.sh
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-prod-kapat.sh
```

**DNS:** Giden posta için SPF/DKIM/DMARC yine `ekolojikmarket.com.tr` üzerinde tanımlı olmalı (Postfix hostname ayrı olsa bile From adresi markanız).

OpenDKIM (VPS, yalnızca `@ekolojikmarket.com.tr` imzası):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-opendkim-kur.sh --apply
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-kabul-dogrula.sh
```

## Seçenek B — Harici relay

SendGrid, Resend, kurumsal SMTP vb.:

```env
EKOLOJIK_SMTP_HOST=smtp.relay-provider.com
EKOLOJIK_SMTP_PORT=587
EKOLOJIK_SMTP_USER=...
EKOLOJIK_SMTP_PASS=...
```

## Seçenek C — Postfix 587 submission (ileri)

Uzak istemciler için SASL + `master.cf` submission — ayrı kullanıcı; POS için genelde A yeterli.

## Kontrol listesi

- [ ] `sunucu-ekolojik-smtp-dogrula.sh` → `smtpVerified: true`
- [ ] Ayarlar → test maili
- [ ] Outbox `failed` = 0
