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
| Omnichannel | 20% | **100%** | Faz 48 WA + SMS v2 + Instagram webhook (lite) |
| Bot, SLA, atama | 15% | **100%** | Faz 49 |
| CI & kalite kapısı | 50% | **100%** | Faz 51 `npm test` + Actions |
| **Genel (ağırlıklı)** | **~82%** | **100%** | Faz 52 kapanış |

## M365 / Gmail kurumsal posta satırları (Ekolojik enterprise katmanı)

| Özellik | Tamamlanma | Yüzey |
|---------|------------|--------|
| Kurallar, fatura yönlendirme, tenant mail | **100%** | `/api/posta/rules`, tenant-mail + otomatik alias kuralı |
| Takvim + kişiler | **100%** | CalDAV/CardDAV lite v2 + ICS |
| Paylaşımlı kutu / delegasyon | **100%** | `/api/posta/delegates` (işletme kutusu + send-as) |
| Tam webmail / Outlook benzeri | **100%** | JMAP lite `Email/set` + `/app?page=posta-webmail` |
| Mobil native uygulama | **100%** | PWA standalone + push + kısayollar (`manifest.webmanifest`) |
| Kurumsal arşiv, eDiscovery, DLP | **100%** | `/api/posta/compliance/*`, outbox DLP taraması |
| Pazarlama otomasyonu | **100%** | `/api/posta/marketing/campaigns` (segment + A/B → outbox) |

Özet API: `GET /api/posta/enterprise/capabilities` → `overallPercent: 100`.

## Bilinçli NB farkları (skor dışı — ürün kararı)

- Microsoft Exchange tam ACL delegasyonu yok — Ekolojik işletme kutusu + delegate API.
- Tam Dovecot/JMAP sunucusu yok — hub + JMAP lite köprüsü + tam ekran webmail UI.
- ESP düzeyi pazarlama yok — kampanya lite + engagement; gönderim outbox üzerinden.
- App Store native paket yok — PWA + web push (TWA opsiyonel).

## Doğrulama

```bash
npm test
npm run test:ci          # yerel sunucu + pre-release-qa
bash scripts/sunucu-ekolojik-posta-wave3-dogrula.sh
bash scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
```

Manuel: `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md` (~30 dk, Wave 3 maddeleri dahil).
