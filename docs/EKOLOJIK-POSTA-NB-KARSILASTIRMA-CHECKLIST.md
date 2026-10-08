# NB Lerta Posta ↔ Ekolojik — karşılaştırma checklist

Referans: Nakliye Borsası Lerta Posta + Mesajlaşma. Ekolojik: **aynı UX**, ayrı altyapı.

**Wave 3 kapanış (2026-10-08):** tüm satırlar ✓ — skor: `docs/RAKIP-SKOR-KARTI.md`

## Temel (Faz 1–13)

| # | NB | Ekolojik | ✓ |
|---|----|-----------|---|
| 1 | Nav’da Posta + badge | `AppShell` + unread API | ✓ |
| 2 | 3 sütun hub | `EkolojikPostaHubScreen` | ✓ |
| 3 | Sol menü klasörleri | Tümü…Çöp, Taslaklar, Takvim, Kişiler (Faz 13) | ✓ |
| 4 | Gelen IMAP + okunabilir gövde | Birleşik inbox + MIME | ✓ |
| 5 | Yaz + şablon + yanıt | Şablonlar + hints + yanıt | ✓ |
| 6 | Müşteri mesajları hub’da | Thread + compose + ek | ✓ |
| 7 | Gönderilen / outbox detay | Outbox + retry | ✓ |
| 8 | Canlı güncelleme (SSE) | `/api/posta/events` | ✓ |
| 9 | Gönderen / ops ayarları | Faz 11 panel | ✓ |
| 10 | Export / rapor | CSV + messaging ZIP (auth) | ✓ |
| 11 | Bağımsız DNS/SMTP | `EKOLOJIK_*`, bridge kapalı | ✓ |
| 12 | Yıldız / spam / çöp / erteleme | `inbox/flags` (Faz 13) | ✓ |

## Tam parite (Faz 14–22)

| # | NB | Ekolojik hedef | ✓ |
|---|----|----------------|---|
| 13 | IMAP Sent/Junk/Trash/Drafts | Klasör sync + MOVE | ✓ |
| 14 | Konuşma görünümü | Thread gruplama | ✓ |
| 15 | Arama / filtre | inbox search API | ✓ |
| 16 | CC/BCC, ilet, ekli giden | Compose tam | ✓ |
| 17 | Kişiler defteri | CRUD + vCard | ✓ |
| 18 | Posta takvimi | Etkinlik + ödeme | ✓ |
| 19 | Sohbet tam ekran | Sohbet modu polish | ✓ |
| 20 | Thread arşiv / sabitle | messaging flags | ✓ |
| 21 | Depolama çubuğu | storage API | ✓ |
| 22 | Toplu işlem | batch API | ✓ |
| 23 | Kurallar / otomasyon | postaRules | ✓ |
| 24 | Açılma izleme (opsiyonel) | env flag | ✓ |
| 25 | Klavye kısayolları | j/k, c, r, / | ✓ |
| 26 | Offline posta (lite) | SW + localStorage | ✓ |
| 27 | Genişletilmiş UI yürüyüşü | ~30 dk doküman | ✓ |

Plan: `docs/PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`

## Wave 3 — %100 (Faz 38–52)

| # | NB / rakip beklenti | Ekolojik | ✓ |
|---|---------------------|----------|---|
| 28 | Okuma/export güvenliği | Posta + messaging token (Faz 38) | ✓ |
| 29 | Outbox failed & analitik | Faz 39 | ✓ |
| 30 | Web widget / embed | Faz 40 | ✓ |
| 31 | Kayıt → posta kurulum | Faz 41–42 | ✓ |
| 32 | Tenant DNS / deliverability | Faz 43–44 | ✓ |
| 33 | JMAP / klasör paritesi | Faz 45 | ✓ |
| 34 | CalDAV + PWA push | Faz 46 | ✓ |
| 35 | Engagement + KVKK | Faz 47 | ✓ |
| 36 | Omnichannel (WA) | Faz 48 | ✓ |
| 37 | Bot + SLA + atama | Faz 49 | ✓ |
| 38 | Müşteri portal | Faz 50 `/portal/mesajlar` | ✓ |
| 39 | CI / test paketi | Faz 51 `npm test` + Actions | ✓ |
| 40 | Kapanış doğrulama | Faz 52 skor kartı + wave3 script | ✓ |

Plan: `docs/PLAN-POSTA-MESAJ-100-PARITE.md`

## Otomatik doğrulama

```bash
bash scripts/sunucu-ekolojik-posta-wave3-dogrula.sh /var/www/market-pos
bash scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
bash scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh /var/www/market-pos
```

Manuel UI: `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md`

Notlar:

- SMTP host / relay: operatör `.env` / tenant-mail paneli
- IMAP kutu: tenant-mail + IMAP sync
- Wave 2 (kapandı): `docs/PLAN-EKOLOJIK-POSTA-NB-WAVE2.md`
