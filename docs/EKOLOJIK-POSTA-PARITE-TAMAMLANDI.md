# Ekolojik Posta & Mesaj — NB parite tamamlandı

**Durum:** Faz **1–24** (POS hub) + **Wave 2** (Faz 25–37) + **Wave 3** (Faz 38–52) **kapandı** — Posta & Mesajlaşma **%100** (ölçüm: `docs/RAKIP-SKOR-KARTI.md`).

## Wave 3 kapanış doğrulama

```bash
cd /var/www/ekolojik-market-pos   # veya repo kökü
npm test
bash scripts/sunucu-ekolojik-posta-wave3-dogrula.sh /var/www/market-pos
bash scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
```

Deploy sonrası:

```bash
node scripts/pre-release-qa.mjs http://<VPS>:5180
```

## Tek komut doğrulama (Faz 22 + öncesi)

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

## Operasyon (süreklilik)

| Görev | Komut |
|--------|--------|
| Haftalık otomatik | `bash scripts/sunucu-ekolojik-posta-parite-cron-kur.sh` |
| Manuel haftalık | `bash scripts/sunucu-ekolojik-posta-haftalik-dogrula.sh` |
| Tam kabul (tek komut) | `bash scripts/sunucu-ekolojik-posta-tam-kabul.sh` |
| Wave 3 kapısı | `bash scripts/sunucu-ekolojik-posta-wave3-dogrula.sh` |
| Wave 3 kapanış (merge öncesi) | `bash scripts/sunucu-ekolojik-posta-wave3-kapat.sh` |
| main merge rehberi | `docs/PLAN-POSTA-WAVE3-KAPATMA.md` |
| Tam kabul (adım adım) | `EKOLOJIK_SKIP_E2E=1 bash scripts/sunucu-ekolojik-posta-kabul-sira.sh` |
| DNS strict (panel sonrası) | `EKOLOJIK_DNS_STRICT=1 bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh` |
| Günlük yedek | `scripts/sunucu-ekolojik-data-yedek-cron-kur.sh` |
| CI (GitHub) | `.github/workflows/ci.yml` — `npm test` + `test:ci` |

## Referanslar

- Wave 3 plan: `docs/PLAN-POSTA-MESAJ-100-PARITE.md`
- Kararlar: `docs/POSTA-MESAJ-100-KARARLAR.md`
- Checklist (tüm ✓): `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md`
- Skor kartı: `docs/RAKIP-SKOR-KARTI.md`
- Plan (Faz 14–22): `docs/PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`
- Operatör: `docs/EKOLOJIK-POSTA-KULLANIM.md`
- UI yürüyüş (~30 dk): `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md`
- E2E: `docs/EKOLOJIK-POSTA-E2E-SMOKE.md`

## Bilinçli NB farkları (kapatılmadı — tasarım)

- Dovecot/JMAP tam webmail yok — IMAP + birleşik hub + JMAP lite read.
- ESP seviyesi açılma/tıklama yok — `EKOLOJIK_MAIL_TRACK=1` lite piksel + engagement strip.
- WebSocket yok — SSE / yenileme (+ WS metrics gateway).
- SMS omnichannel v2 backlog — WhatsApp Cloud (Faz 48) aktif.
