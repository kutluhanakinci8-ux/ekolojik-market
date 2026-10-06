# Ekolojik Posta — prod kapatma (Faz 12 sonrası)

NB parite kodu **Faz 6–12** ile tamamlandı. Canlı “yeşil” için altyapı + tek komut doğrulama.

## Sıra

1. **Faz 6 altyapı** — DNS (SPF/DKIM/DMARC), Postfix veya harici relay, `EKOLOJIK_SMTP_HOST=mail.ekolojikmarket.com.tr` (VPS IP değil)
2. **`.env` audit** — NB env karışmıyor, köprü kapalı
3. **Parite smoke** — hub API, export, SSE
4. **Yedek cron** — `sunucu-ekolojik-data-yedek.sh`
5. **Manuel** — `EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md` (~30 dk)

## VPS tek komut

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-prod-kapat.sh
```

Alt adımlar:

- `scripts/sunucu-ekolojik-env-audit.sh`
- `scripts/sunucu-ekolojik-posta-parite-dogrula.sh`

Deploy sonrası (uyarı modu, deploy’u düşürmez):

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
