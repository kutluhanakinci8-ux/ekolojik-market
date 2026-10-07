# Ekolojik Posta — NB Wave 2 (PM haritası → POS uyarlaması)

**Kural:** Nakliye Borsası `LERTA_MAIL_MESSAGING_PARITY_100_ROADMAP.md` (PM-1…PM-10) referans; Ekolojik **ayrı kod** (`EKOLOJIK_*`), NB API kullanılmaz.

## Wave 1 (kapandı)

Faz 1–24: hub, IMAP, compose, sohbet, depolama, kurallar, AI/track lite, PWA lite, doğrulama scriptleri.

## Wave 2 sırası (NB → Ekolojik)

| Faz | NB | Ekolojik uyarlaması | Durum |
|-----|-----|---------------------|--------|
| **25** | PM-3 + PM-7 (hesap/DNS/deliverability) | `GET /api/posta/deliverability` + Ayarlar paneli | ✅ |
| **26** | PM-8 (bildirim matrisi) | Olay×kanal tablosu (ops e-posta) | ✅ |
| **27** | PM-2 (RTE compose) | Zengin metin araç çubuğu genişletme | ✅ |
| **28** | PM-5 (CalDAV/CardDAV) | Harici sync köprüsü veya ICS export | ✅ |
| **29** | PM-10 (engagement) | Tıklama + bounce CSV, webhook lite | ✅ |
| **30** | PM-4 (PWA push) | Web push VAPID (POS PWA) | ✅ |
| **31** | PM-9 (kurallar G5+) | Nested OR, gönderen+ek boyutu kuralları | ✅ |
| **32** | PM-6 (canlılık) | SSE iyileştirme / mesaj gecikme metrik | ✅ |
| **33** | Sohbet: okundu/typing (NB envanter #34) | Thread read receipt lite | plan |
| **34** | Parite kapanış wave 2 | `sunucu-ekolojik-posta-nb-wave2-kapat.sh` | plan |

**Bilinçli NB farkı (ürün kararı):** Tam JMAP, WebSocket gateway, native mobil uygulama, Gmail admin embed — POS’ta PWA + IMAP yeterli.

Her faz bitişi:

```bash
bash scripts/ekolojik-posta-faz-kapat.sh "Faz N" cursor/posta-fazN-94bd
```
