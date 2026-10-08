# NB Lerta Posta ↔ Ekolojik — karşılaştırma checklist

Referans: Nakliye Borsası Lerta Posta + Mesajlaşma. Ekolojik: **aynı UX**, ayrı altyapı.

## Temel (Faz 1–13)

| # | NB | Ekolojik | ✓ |
|---|----|-----------|---|
| 1 | Nav’da Posta + badge | `AppShell` + unread API | |
| 2 | 3 sütun hub | `EkolojikPostaHubScreen` | |
| 3 | Sol menü klasörleri | Tümü…Çöp, Taslaklar, Takvim, Kişiler (Faz 13) | |
| 4 | Gelen IMAP + okunabilir gövde | Birleşik inbox + MIME | |
| 5 | Yaz + şablon + yanıt | Şablonlar + hints + yanıt | |
| 6 | Müşteri mesajları hub’da | Thread + compose + ek | |
| 7 | Gönderilen / outbox detay | Outbox + retry | |
| 8 | Canlı güncelleme (SSE) | `/api/posta/events` | |
| 9 | Gönderen / ops ayarları | Faz 11 panel | |
| 10 | Export / rapor | CSV + messaging ZIP | |
| 11 | Bağımsız DNS/SMTP | `EKOLOJIK_*`, bridge kapalı | |
| 12 | Yıldız / spam / çöp / erteleme | `inbox/flags` (Faz 13) | |

## Tam parite (Faz 14–22) — plan

| # | NB | Ekolojik hedef | Faz |
|---|----|----------------|-----|
| 13 | IMAP Sent/Junk/Trash/Drafts | Klasör sync + MOVE | 14 |
| 14 | Konuşma görünümü | Thread gruplama | 15 |
| 15 | Arama / filtre | inbox search API | 15 |
| 16 | CC/BCC, ilet, ekli giden | Compose tam | 16 |
| 17 | Kişiler defteri | CRUD + vCard | 17 |
| 18 | Posta takvimi | Etkinlik + ödeme | 17 |
| 19 | Sohbet tam ekran | Sohbet modu polish | 18 |
| 20 | Thread arşiv / sabitle | messaging flags | 18 |
| 21 | Depolama çubuğu | storage API | 19 |
| 22 | Toplu işlem | batch API | 19 |
| 23 | Kurallar / otomasyon | postaRules | 20 |
| 24 | Açılma izleme (opsiyonel) | env flag | 20 |
| 25 | Klavye kısayolları | j/k, c, r, / | 21 |
| 26 | Offline posta (lite) | SW + localStorage | 21 |
| 27 | Genişletilmiş UI yürüyüşü | ~30 dk doküman | 21 |

Plan: `docs/PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`

## Faz 14–21 tamamlanan maddeler (özet)

- IMAP klasörleri, konuşma/arama, compose tam, kişi/takvim, sohbet, depolama/toplu, kurallar/analitik, kısayol + offline lite.

Notlar:

- SMTP host / relay: ___________________
- IMAP kutu: ___________________
- Wave 2 (kapandı): `docs/PLAN-EKOLOJIK-POSTA-NB-WAVE2.md`
- **Wave 3 (%100):** `docs/PLAN-POSTA-MESAJ-100-PARITE.md` — güvenlik, widget, kayıt, tenant DNS, omnichannel, CI, kapanış Faz 52

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh
```
