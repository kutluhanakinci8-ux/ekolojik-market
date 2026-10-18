# NB mail/mesaj parite boşlukları — Ekolojik kapanış (2026-10-07)

| Öncelik | Konu | Ekolojik çözüm |
|--------|------|----------------|
| P0 | Okundu + typing | Faz 33 — `readByStaffAt` / `readByCustomerAt`, `/typing`, SSE `messaging` |
| P0 | Wave 2 kapanış | Faz 34 — `sunucu-ekolojik-posta-nb-wave2-kapat.sh` |
| P1 | Müşteri mesaj girişi | Faz 35 — `EKOLOJIK_MESSAGING_PUBLIC_KEY`, `/api/public/messaging/v1`, `public/ekolojik-messaging-widget.js` |
| P1 | Mesaj düzeyinde okundu | Faz 33 — `POST …/messages/:id/read` |
| P2 | JMAP / Dovecot | Faz 36 — `GET /api/posta/jmap-lite/*` (IMAP hub köprüsü, tam JMAP değil) |
| P2 | CalDAV / CardDAV | Faz 36 — `GET/POST /api/posta/caldav-lite/events` (+ mevcut ICS) |
| P2 | WebSocket | Faz 36 — `ws://host/api/posta/ws` (SSE ile aynı olaylar) |
| P3 | Public mail API | Faz 37 — `EKOLOJIK_PUBLIC_MAIL_API_KEY`, `POST /api/public/mail/v1/messages` |
| P3 | Multi-tenant list | Faz 37 — `GET /api/posta/tenants` |
| P3 | Gmail embed / native app | Ürün sınırı — POS PWA + widget; ayrı native uygulama planlanmadı |

Doğrulama:

```bash
bash scripts/sunucu-ekolojik-posta-nb-wave2-kapat.sh /var/www/market-pos
```
