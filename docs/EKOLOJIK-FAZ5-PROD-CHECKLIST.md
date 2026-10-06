# Ekolojik Market — Faz 5 üretim kontrol listesi

Plan: `docs/PLAN-EKOLOJIK-MAIL-MESAJ-BAGIMSIZ.md`

## Otomatik özet (POS)

Ayarlar → Sistem → **Faz 5 ayrım kontrolü** veya:

`GET /api/system/ekolojik-isolation`

## Manuel checklist

### Altyapı

- [ ] `market-pos` ayrı process / port (NB PM2 ile karışmıyor)
- [ ] `.env` yalnızca `EKOLOJIK_*`; `LERTA_PLATFORM_BRIDGE=0`
- [ ] NB `MAIL_PLATFORM_*` env bu VPS’te yok veya farklı dosyada

### Giden posta (Faz 1–2)

- [ ] SPF / DKIM / DMARC — `ekolojikmarket.com.tr`
- [ ] `EKOLOJIK_SMTP_*`, `EKOLOJIK_MAIL_FROM`, `EKOLOJIK_OPS_EMAIL`
- [ ] Outbox `failed` = 0 (Ayarlar paneli)

### Mesajlaşma (Faz 3)

- [ ] `data/messaging/` yedekleniyor
- [ ] NB `public/lerta-messaging` çağrılmıyor (köprü kapalı)

### Gelen fatura postası (Faz 4)

- [ ] Gmail uygulama şifresi veya kurumsal IMAP
- [ ] `data/bill-email-inbox/` yedekleniyor
- [ ] NB inbound MX kullanılmıyor

### İzleme & KVKK

- [ ] Günlük yedek: `data/email-outbox`, `data/messaging`, `data/bill-email-inbox`
- [ ] Mail/mesaj saklama süresi işletme politikasına göre

### Posta admin (Faz 11 — NB PM-3 / PM-10 lite)

- [ ] Ayarlar → E-posta: **Gönderen adı**, Reply-To, ops e-postası, imza kaydediliyor
- [ ] Bildirim tercihleri: iletişim / mesaj ops mail açık-kapalı
- [ ] Outbox + iletişim CSV indir; mesajlaşma ZIP (`GET /api/messaging/export`)
- [ ] `data/posta-mail-settings.json` yedek listesinde

### Cron & env audit

- [ ] Günlük yedek cron aktif (`sunucu-ekolojik-data-yedek.sh`)
- [ ] `.env` audit: yalnızca `EKOLOJIK_*`, SMTP host = mail subdomain (VPS IP değil)
- [ ] `bash scripts/sunucu-ekolojik-posta-prod-kapat.sh` exit 0 (env + parite)
- [ ] `bash scripts/sunucu-ekolojik-smtp-dogrula.sh` yeşil (Faz 6)
- [ ] Otomatik özet: `bash scripts/sunucu-ekolojik-faz5-prod-dogrula.sh` (E2E için `EKOLOJIK_RUN_E2E=1`)
- [ ] Akış C sonrası sıra: `EKOLOJIK_SKIP_E2E=1 bash scripts/sunucu-ekolojik-posta-kabul-sira.sh`
- [ ] DNS TXT: `EKOLOJIK_RUN_DNS=1 bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh`
- [ ] Outbox failed temizliği: `bash scripts/sunucu-ekolojik-outbox-failed-arsivle.sh` (önce `EKOLOJIK_DRY_RUN=1`)

## VPS yedek örneği

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-data-yedek.sh
```

Cron (günlük 03:00):

```bash
0 3 * * * root bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-data-yedek.sh >> /var/log/ekolojik-backup.log 2>&1
```

Manuel tar (alternatif):
  /var/www/market-pos/data/email-outbox \
  /var/www/market-pos/data/messaging \
  /var/www/market-pos/data/bill-email-inbox \
  /var/www/market-pos/data/contact-messages.json \
  /var/www/market-pos/data/posta-mail-settings.json
