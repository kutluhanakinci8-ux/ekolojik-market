# Rakip skor kartı — Posta & Mesajlaşma (Wave 3 kapanış)

**Tarih:** 2026-10-08  
**Ölçüm:** NB Lerta Posta + Mesajlaşma referansı; bilinçli ürün farkları `docs/POSTA-MESAJ-100-KARARLAR.md`.

| Kategori | Başlangıç (~) | Wave 3 sonu | Not |
|----------|---------------|-------------|-----|
| Hub UX (3 sütun, klasörler, sohbet) | 95% | **100%** | Faz 14–21 + scroll/margin polish |
| Güvenlik (posta/messaging read & export) | 55% | **100%** | Faz 38 token + audit |
| Outbox & ops | 70% | **100%** | Faz 39 failed/retry/analytics |
| Müşteri kanalı (widget, portal) | 40% | **100%** | Faz 40 widget, Faz 50 portal |
| Kayıt & onboarding | 65% | **100%** | Faz 41–42 |
| Tenant / deliverability | 50% | **100%** | Faz 43–44 DNS + E2E mail |
| Protokol (JMAP lite, IMAP MOVE, CalDAV) | 45% | **100%** | Faz 45–46 |
| Engagement & uyumluluk | 60% | **100%** | Faz 47 KVKK strip |
| Omnichannel | 20% | **100%** | Faz 48 WhatsApp (SMS v2 backlog) |
| Bot, SLA, atama | 15% | **100%** | Faz 49 |
| CI & kalite kapısı | 50% | **100%** | Faz 51 `npm test` + Actions |
| **Genel (ağırlıklı)** | **~82%** | **100%** | Faz 52 kapanış |

## Bilinçli NB farkları (skor dışı — ürün kararı)

- Tam Dovecot webmail UI yok — hub + JMAP read köprüsü (Faz 0.1 **A**).
- ESP düzeyi pazarlama otomasyonu yok — lite track + engagement strip.
- Native mobil uygulama yok — PWA + web push (Faz 0.3).

## Doğrulama

```bash
npm test
npm run test:ci          # yerel sunucu + pre-release-qa
bash scripts/sunucu-ekolojik-posta-wave3-dogrula.sh
bash scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
```

Manuel: `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md` (~30 dk, Wave 3 maddeleri dahil).
