# Outbox failed temizlik (ops)

Geçmiş **failed** JSON dosyaları hub sayacını ve CSV export’u şişirir. Çoğu kaynak: eski `outbox-failed-ops` döngüsü veya geçersiz alıcı (550).

## Özet rapor

```bash
node scripts/outbox-failed-archive-report.mjs /var/www/market-pos/data
```

## Arşiv (önerilen — silmez, `failed/archive/{tenant}/` taşır)

```bash
# Önizleme
EKOLOJIK_DRY_RUN=1 bash scripts/sunucu-ekolojik-outbox-failed-arsivle.sh /var/www/market-pos

# Uygula
EKOLOJIK_DRY_RUN=0 bash scripts/sunucu-ekolojik-outbox-failed-arsivle.sh /var/www/market-pos
```

Haftalık cron: `scripts/sunucu-ekolojik-outbox-failed-cron-kur.sh` (Pazar 04:30 UTC).

## Doğrulama

```bash
curl -sS http://127.0.0.1:5180/api/email/health | jq .counts
# Aktif failed (arşiv hariç):
find /var/www/market-pos/data/email-outbox/failed \
  -path '*/archive/*' -prune -o -name '*.json' -print | wc -l
```

Yeni hatalar için: `scripts/sunucu-ekolojik-smtp-ops-recipient-dogrula.sh` (ops alıcı Postfix uyumu).

**Not:** `failed/archive/` arşiv klasörüdür; `/api/email/health` `counts.failed` yalnızca aktif `failed/{tenant}/*.json` sayar (kod: `OUTBOX_FAILED_ARCHIVE_DIR`).
