# Faz 7 — Gelen kutusu (IMAP info@)

**Amaç:** Posta hub **Gelen** sütununda gerçek e-posta + iletişim formu birlikte görünsün.

## Seçenek A — Aynı VPS (MX zaten bu sunucu)

MX `ekolojikmarket.com.tr` → VPS. Yerel kutu:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-imap-vps-kur.sh --apply
```

Bu script:

- `info@ekolojikmarket.com.tr` maildir oluşturur (`/var/mail/vhosts/…`)
- Dovecot passdb ekler (**Lerta** `lerta-imap-passwd` dosyasına dokunmaz)
- Postfix alias ekler (**Lerta** `lerta-inbound-virtual` satırlarına dokunmaz)
- `.env` → `EKOLOJIK_IMAP_HOST=127.0.0.1`, port **143**, kullanıcı `info@…`

Doğrulama:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-imap-dogrula.sh
curl -s http://127.0.0.1:5180/api/posta/inbox/sync -X POST
```

POS: **Posta → Gelen → Senkronize et**

Gelen teslim smoke:

```bash
bash scripts/sunucu-ekolojik-imap-vps-alias-fix.sh   # bir kez (Lerta myorigin ortamı)
bash scripts/sunucu-ekolojik-posta-gelen-smoke.sh
```

## Seçenek B — Harici IMAP (Gmail / kurumsal)

`.env`:

```env
EKOLOJIK_IMAP_HOST=imap.gmail.com
EKOLOJIK_IMAP_PORT=993
EKOLOJIK_IMAP_SECURE=1
EKOLOJIK_IMAP_USER=info@ekolojikmarket.com.tr
EKOLOJIK_IMAP_PASS=uygulama-sifresi
```

`pm2 restart market-pos --update-env` (veya deploy).

## API

- `GET /api/posta/imap/health` — yapılandırma + bağlantı testi
- `POST /api/posta/inbox/sync` — IMAP → `data/posta-inbox/`

## Kabul

- `imapVerified: true`
- Gelen’de en az 1 mail veya test iletişim satırı okunabilir gövde ile açılır
