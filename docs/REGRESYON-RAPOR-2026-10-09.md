# Tam regresyon raporu (2026-10-09)

## Özet

| Katman | Sonuç |
|--------|--------|
| GitHub CI `main` | ✓ (PR #48 merge sonrası) |
| Yerel `npm test` + `test:ci` | ✓ (CI’da auth WARN — demo şifre yok) |
| VPS `pre-release-qa` | ✓ **51 PASS, 0 FAIL** |
| VPS Wave 3 operatör (Playwright) | ✓ |
| VPS DNS `EKOLOJIK_DNS_STRICT=1` | ✓ |
| VPS `faz22-dogrula` | ✓ (Wave2 döngüsü + Faz20 auth + Faz28/29 SIGPIPE sonrası) |
| VPS `e2e-tam` (Akış C) | ✓ (`sunucu-ekolojik-posta-e2e-tam.sh`, main `dd2242a`) |
| VPS `faz22-dogrula` | ✓ |

## Bulunan hata (giderildi)

**Faz 22 / Wave 2 sonsuz iç içe geçme:** `faz22-dogrula` → `faz34` → `nb-wave2-kapat` → tekrar `faz22-dogrula` → yüzlerce süreç (VPS).

- **Fix:** `nb-wave2-kapat.sh` sonundaki `faz22-dogrula` çağrısı kaldırıldı.
- **Koruma:** `faz22-dogrula.sh` `flock` ile tek örnek.

## Uyarılar (bilinçli / ops)

| Konu | Not |
|------|-----|
| Playwright `npm run test:nb-ui-visual` | `EKOLOJIK_POS_QA_MINT_JSON` gerekir — `sunucu-ekolojik-posta-nb-ui-yuruyus.sh` kullanın |
| Playwright WARN #23 WA rozeti | Kanal yok — opsiyonel |
| WARN #22 engagement | İzleme kapalı — opsiyonel |
| `npm audit` | `react-router-dom@6` moderate (major upgrade ayrı iş); `source-map-js` audit fix uygulandı |
| VPS outbox | `failed: 20` — arşiv/cron mevcut |

## Tek komut kapılar (VPS)

```bash
bash scripts/sunucu-ekolojik-posta-wave3-operator-kapi.sh /var/www/market-pos
EKOLOJIK_QA_BASE_URL=http://127.0.0.1:5180 node scripts/pre-release-qa.mjs
EKOLOJIK_DNS_STRICT=1 bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh
bash scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
bash scripts/sunucu-ekolojik-posta-e2e-tam.sh /var/www/market-pos
```
