# NB Lerta Posta ↔ Ekolojik — 30 dk karşılaştırma

Referans: Nakliye Borsası Lerta Posta. Ekolojik hedef: **aynı UX hissi**, ayrı altyapı.

| # | NB | Ekolojik | ✓ |
|---|----|-----------|---|
| 1 | Nav’da Posta + badge | `AppShell` badge + unread API | |
| 2 | 3 sütun hub | `EkolojikPostaHubScreen` | |
| 3 | Gelen IMAP + okunabilir gövde | Birleşik inbox + MIME parse | |
| 4 | Yaz + şablon + yanıt | Şablonlar + compose hints + yanıt | |
| 5 | Müşteri mesajları hub’da | Thread + compose + ek | |
| 6 | Gönderilen / outbox detay | Outbox list + retry | |
| 7 | Canlı güncelleme (SSE) | `/api/posta/events` | |
| 8 | Gönderen / ops ayarları | Faz 11 panel + JSON settings | |
| 9 | Export / rapor | CSV + messaging ZIP | |
| 10 | Bağımsız DNS/SMTP | `EKOLOJIK_*`, bridge kapalı | |

Notlar alanı:

- SMTP host / relay: ___________________
- IMAP kutu: ___________________
- Eksik kabul edilen (bilinçli): ___________________

Tamamlayınca: `docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md` maddelerini işaretleyin.

Otomatik API doğrulama (VPS):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh
```
