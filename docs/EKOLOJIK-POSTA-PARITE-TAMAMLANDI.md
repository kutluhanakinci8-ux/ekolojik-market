# Ekolojik Posta & Mesaj — NB parite tamamlandı

**Durum:** Faz **1–22** kapandı (2026-10-07). Nakliye Borsası Lerta Posta ile **işlevsel eşdeğer** hub; bilinçli altyapı farkları dokümante.

## Tek komut doğrulama (VPS)

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

Deploy sonrası (mevcut):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-prod-kapat.sh /var/www/market-pos
```

## Operasyon (Faz 23 — süreklilik)

| Görev | Komut |
|--------|--------|
| Haftalık otomatik | `bash scripts/sunucu-ekolojik-posta-parite-cron-kur.sh` |
| Manuel haftalık | `bash scripts/sunucu-ekolojik-posta-haftalik-dogrula.sh` |
| Tam kabul sırası | `EKOLOJIK_SKIP_E2E=1 bash scripts/sunucu-ekolojik-posta-kabul-sira.sh` |
| Günlük yedek | `scripts/sunucu-ekolojik-data-yedek-cron-kur.sh` |

## Referanslar

- Plan (Faz 14–22): `docs/PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`
- Operatör: `docs/EKOLOJIK-POSTA-KULLANIM.md`
- Checklist: `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md`
- E2E: `docs/EKOLOJIK-POSTA-E2E-SMOKE.md`

## Bilinçli NB farkları (kapatılmadı — tasarım)

- Dovecot/JMAP tam webmail yok — IMAP + birleşik hub.
- ESP seviyesi açılma/tıklama yok — `EKOLOJIK_MAIL_TRACK=1` lite piksel.
- WebSocket yok — SSE / yenileme.
