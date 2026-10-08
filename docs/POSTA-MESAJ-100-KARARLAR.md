# Posta & Mesaj — %100 plan Faz 0 kararları

**Onay:** Wave 3 uygulaması başlangıcı (2026-10-08) — plan varsayılanları kabul edildi.

| # | Konu | Karar | Onay tarihi |
|---|------|--------|-------------|
| 0.1 | Tam Dovecot/JMAP webmail | **A** — Read-only JMAP genişlet; POS’ta tam webmail yok | 2026-10-08 |
| 0.2 | Omnichannel (WA/SMS/IG) | **Faz 48** — WhatsApp webhook önce; kanal kanal | 2026-10-08 |
| 0.3 | Native mobil uygulama | **PWA + push** (Faz 46); React Native v2 sonrası | 2026-10-08 |
| 0.4 | Posta okuma auth modeli | **Bearer** — `posta` sekmesi veya admin; SSE/link için `access_token` query | 2026-10-08 |
| 0.5 | Müşteri portal kapsamı | **Magic link mesajlar + ticket** (Faz 50); widget minimum Faz 40 | 2026-10-08 |

**Geçiş:** `EKOLOJIK_POS_POSTA_AUTH=0` yalnızca acil geri alma; prod’da varsayılan açık (Faz 38).

Onaylayan: Wave 3 otomasyon (plan `docs/PLAN-POSTA-MESAJ-100-PARITE.md`)
