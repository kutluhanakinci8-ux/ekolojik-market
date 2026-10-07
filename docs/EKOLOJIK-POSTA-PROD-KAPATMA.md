# Ekolojik Posta — prod kapatma (Faz 12 + 22)

NB parite kodu **Faz 6–22** ile tamamlandı. Canlı “yeşil” için altyapı + tek komut doğrulama.

## Sıra

1. **Faz 6 altyapı** — DNS (SPF/DKIM/DMARC), Postfix veya harici relay  
   - Aynı VPS: `bash scripts/sunucu-ekolojik-postfix-yerel-relay-kur.sh --apply`  
   - Runbook: `docs/EKOLOJIK-FAZ6-SMTP-RUNBOOK.md`
2. **`.env` audit** — NB env karışmıyor, köprü kapalı
3. **Parite smoke** — hub API, export, SSE
4. **Yedek cron** — `sunucu-ekolojik-data-yedek.sh`
5. **Manuel** — `EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md` (~30 dk)

## VPS tek komut

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-prod-kapat.sh
```

Tam parite kapısı (Faz 14–21 dahil):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

Haftalık cron (önerilir):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-parite-cron-kur.sh
```

Alt adımlar (prod-kapat):

- `scripts/sunucu-ekolojik-env-audit.sh`
- `scripts/sunucu-ekolojik-posta-parite-dogrula.sh` (Faz 12 + 14–21 API)

Deploy sonrası tam E2E (isteğe bağlı, ~1 dk):

```bash
EKOLOJIK_E2E_SMOKE=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-prod-kapat.sh
# veya
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-e2e-tam.sh
```

Faz 5 otomatik kapı + isteğe bağlı E2E:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh
EKOLOJIK_RUN_E2E=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-faz5-prod-dogrula.sh
```

```bash
# Deploy script otomatik çağırır; atlamak için:
EKOLOJIK_SKIP_POST_DEPLOY_VERIFY=1 bash scripts/sunucu-market-pos-otomatik-deploy.sh

# Deploy’u SMTP hatasında durdurmak için:
EKOLOJIK_POST_DEPLOY_VERIFY_STRICT=1 bash scripts/sunucu-market-pos-otomatik-deploy.sh
```

## Operatör

- Kullanım: `docs/EKOLOJIK-POSTA-KULLANIM.md`
- E2E smoke: `docs/EKOLOJIK-POSTA-E2E-SMOKE.md`
- Faz 5 checklist: `docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md`

## Kabul

- `posta-prod-kapat.sh` exit 0
- Ayarlar → E-posta: SMTP **Hazır**, outbox failed = 0
- NB Lerta Posta API’sine trafik yok (`LERTA_PLATFORM_BRIDGE=0`)
