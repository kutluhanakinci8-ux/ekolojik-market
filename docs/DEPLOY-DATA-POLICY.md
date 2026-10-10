# Deploy — veri dokunulmaz politikası

## Kural (kilitli)

1. **Deploy = sadece kod** (`dist`, `server`, `package.json`, PM2 restart). `/var/www/market-pos/data` **üzerine yazılmaz**.
2. **Her deploy öncesi** `scripts/backup-market-pos-data.sh` çalışır → `data-backups/market-pos-data-*.tar.gz`.
3. **Veri migrasyonları** (irsaliye stok, posta onboarding, seed) deploy sırasında **varsayılan kapalı**. Açmak için: `EKOLOJIK_DEPLOY_DATA_MIGRATIONS=1`.
4. **CI / GitHub Actions** seed veya data script çalıştırmaz.

## GitHub vs canlı Lima

| | GitHub (repo) | Canlı VPS |
|---|---------------|-----------|
| Konum | `backups/seeds/lima-market.demo-store.json` (örnek) | `data/tenants/lima-market/store.json` |
| Boyut | ~6 KB demo | ~147 KB (satış, muhasebe, kullanıcılar) |
| Eşit mi? | **Hayır** — canlı tek gerçek kaynak |

Geliştirme sırasında ekranda yapılan değişiklikler canlı `data` içinde kalır; `main` pull bunları silmez (migrasyon/seed kapalıysa).

## Geri yükleme

```bash
tar -xzf /var/www/market-pos/data-backups/market-pos-data-YYYYMMDDTHHMMSSZ.tar.gz -C /var/www/market-pos
pm2 restart market-pos
```
