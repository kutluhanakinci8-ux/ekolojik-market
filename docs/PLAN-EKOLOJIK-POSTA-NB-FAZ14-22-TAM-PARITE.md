# Ekolojik Posta & Mesaj — NB tam parite (Faz 14–22)

**Hedef:** Nakliye Borsası (Lerta Posta + `/messaging`) ile **işlevsel eşdeğer** — eksik özellik kalmayacak.  
**Kural:** Ayrı kod, ayrı veri, ayrı DNS (`EKOLOJIK_*`). NB `lerta-mail-*` API **kullanılmaz**.

**Tamamlanan temel:** Faz 1–5 (bağımsız mail/mesaj), Faz 6–12 (SMTP/IMAP, hub, export, doğrulama), **Faz 13** (NB sol menü + bayraklar + taslaklar + Posta/Sohbet/Tam).

**Her faz bitişi (zorunlu):**

```bash
bash scripts/ekolojik-posta-faz-kapat.sh "Faz N" cursor/posta-fazN-94bd
```

Bu komut: `main` merge → `publish` push → VPS `sunucu-market-pos-deploy.sh` → `/var/www/market-pos` (PM2).  
Sadece `git checkout` / repo içi `npm run build` **canlıyı güncellemez**.

---

## Durum matrisi (özet)

| Alan | NB (Lerta Posta) | Ekolojik bugün | Faz |
|------|------------------|----------------|-----|
| Sol menü klasörleri | Tümü…Kişiler | ✅ Faz 13 | — |
| Gelen + IMAP sync | INBOX | ✅ tek kutu | 14 |
| IMAP Sent/Junk/Trash/Drafts | ✅ | Kısmen (outbox + bayrak) | **14** |
| Konuşma görünümü | Thread by header | Satır liste | **15** |
| Arama / filtre | Gelişmiş | Yok | **15** |
| Yaz: CC/BCC, ek, ilet | ✅ | ✅ Faz 16 | — |
| Yanıtla / tümünü yanıtla / ilet | ✅ | ✅ Faz 16 | — |
| Kişiler defteri | CardDAV benzeri | ✅ Faz 17 | — |
| Takvim | Posta içi | ✅ Faz 17 | — |
| Müşteri mesajları hub | Tam sohbet UX | ✅ Faz 18 | — |
| Sohbet tam ekran | ✅ | ✅ Faz 18 | — |
| Depolama göstergesi | ✅ | Yok | **19** |
| Toplu işlem | Seç + işlem | Yok | **19** |
| Bildirim matrisi | Olay×kanal | JSON settings (Faz 11) | **18–19** |
| Açılma / tıklama | ESP | Yok (bilinçli lite) | **20** |
| AI compose | Opsiyonel | Yok | **20** (env) |
| PWA offline posta | NB | POS PWA kısıtlı | **21** (lite) |

---

## Faz 14 — IMAP klasör senkronu & Gönderilen birleşik ✅ (2026-10-07)

**Amaç:** Spam/çöp/arşiv bayrakları mümkün olduğunda **sunucu klasörüyle** uyumlu; Gönderilen = outbox + IMAP Sent.

| # | İş | Çıktı |
|---|-----|--------|
| 14.1 | `billEmailImap.mjs`: INBOX, Sent, Trash, Junk, Drafts listeleme | `fetchMailboxMessages(config, folder)` |
| 14.2 | Sync job: klasör bazlı ingest + `postaInboxStore` metadata `imapFolder` | `syncPostaInboxFromImap` genişlet |
| 14.3 | Bayrak işlemleri → IMAP MOVE (Trash/Spam) opsiyonel `EKOLOJIK_IMAP_WRITE=1` | `postaInbox.mjs` + flags |
| 14.4 | Hub **Gönderilen**: outbox `sent/failed` + IMAP Sent tek liste | `EkolojikPostaHubScreen` + API |
| 14.5 | Taslaklar: IMAP Drafts + yerel compose drafts birleşik | `listPostaComposeDrafts` |
| 14.6 | Script: `sunucu-ekolojik-imap-klasor-dogrula.sh` | VPS smoke |

**Kabul:** Sunucuda Junk’a taşınan mail IMAP’te Junk’ta; Gönderilen’de SMTP giden + Sent klasörü görünür.

---

## Faz 15 — Konuşma görünümü, arama, liste UX ✅ (2026-10-07)

**Amaç:** NB “konuşma” ve liste filtreleri.

| # | İş | Çıktı |
|---|-----|--------|
| 15.1 | Thread grupla: `Message-ID`, `References`, `In-Reply-To`, konu normalizasyonu | `server/postaConversation.mjs` |
| 15.2 | Hub liste modu: **Mesaj** / **Konuşma** toggle | UI |
| 15.3 | Konuşma detay: zincir halinde gövde (en eski → yeni) | Sağ panel |
| 15.4 | `GET /api/posta/inbox/search?q=&folder=&unread=&hasAttachment=` | Sunucu + indeks (basit) |
| 15.5 | Liste filtreleri: okunmamış, yıldızlı, ekli | UI chips |
| 15.6 | **Tam** görünüm: liste daralt / detay geniş layout tamamla | CSS + state |

**Kabul:** Aynı konuya 3 yanıt tek konuşmada; arama “smoke” ile bulunur.

---

## Faz 16 — Yaz ekranı tam parite (compose) ✅ (2026-10-07)

**Amaç:** NB compose özellik seti.

| # | İş | Çıktı |
|---|-----|--------|
| 16.1 | CC, BCC alanları + outbox kaydı | `sendEmailTest` / outbox schema |
| 16.2 | **İlet** / **Tümünü yanıtla** gelen/konuşmadan | Hub actions |
| 16.3 | Giden **ek** (multipart MIME, 10 MB toplam) | `emailOutboxProcessor` |
| 16.4 | İmza HTML otomatik append (`postaSettings.signatureHtml`) | Compose |
| 16.5 | Zengin metin: markdown + canlı önizleme veya hafif RTE | `PostaCompose` bileşeni |
| 16.6 | Gönder öncesi taslak otosave (debounce) | Hub + drafts API |

**Kabul:** Ekli PDF gider; Reply-All doğru `To`/`Cc`; imza her giden mailde.

---

## Faz 17 — Kişiler & Takvim (NB menü maddeleri) ✅ (2026-10-07)

**Amaç:** Kişiler ve Takvim menüleri NB seviyesinde işlevsel.

| # | İş | Çıktı |
|---|-----|--------|
| 17.1 | `data/posta-contacts/` — müşteri + manuel + mail’den öneri | CRUD API |
| 17.2 | Kişi kartı: son yazışma, e-posta tık → Yaz | Hub **Kişiler** |
| 17.3 | vCard `.vcf` export / import (CSV fallback) | Export handler |
| 17.4 | Takvim: ödeme hatırlatmaları + manuel etkinlik + snooze tarihi | `postaCalendar.mjs` + UI |
| 17.5 | Mail → “Takvime ekle” (fatura dışı genel) | Detail action |

**Kabul:** Kişiler NB gibi aranır; Takvim’de snooze bitişi görünür.

---

## Faz 18 — Mesajlaşma (Sohbet) tam parite ✅ (2026-10-07)

**Amaç:** NB `/messaging` hub deneyimi.

| # | İş | Çıktı |
|---|-----|--------|
| 18.1 | **Sohbet** modu: tam genişlik thread, mobil uyum | `EkolojikPostaHubScreen` |
| 18.2 | Thread: arşiv, sabitle, sessize al | `messaging/store.mjs` flags |
| 18.3 | Thread içi arama | API + UI |
| 18.4 | Yeni mesaj: ses/badge + ops e-posta (Faz 11 matrisi ile) | `notify.mjs` genişlet |
| 18.5 | Müşteri kartı ↔ hub thread senkron deep link | `?customerId=` + CRM |
| 18.6 | (Opsiyonel) Müşteriye e-posta “yazışmanız var” özeti şablonu | `mailTemplates.mjs` |

**Kabul:** Sohbet sekmesi NB yürüyüşünde 5 dk test geçer; CRM’den açılan thread hub’da aynı.

---

## Faz 19 — Operasyon, depolama, toplu işlem

| # | İş | Çıktı |
|---|-----|--------|
| 19.1 | Depolama çubuğu: ekler + inbox JSON boyutu | `GET /api/posta/storage` |
| 19.2 | Toplu seçim: okundu, arşiv, spam, çöp | UI + batch API |
| 19.3 | “Tümünü okundu işaretle” klasör bazlı | `markPostaInboxRead` batch |
| 19.4 | Ek limit 10 MB (NB PM-7) | Config + UI metin |
| 19.5 | Posta aksiyon audit log (KVKK) | `data/posta-audit.jsonl` |

**Kabul:** Depolama % gösterilir; 50 mail seçilip arşivlenebilir.

---

## Faz 20 — Otomasyon, kurallar, analitik lite

| # | İş | Çıktı |
|---|-----|--------|
| 20.1 | Kural motoru: konu/from → fatura klasörü, etiket | `postaRules.mjs` |
| 20.2 | İsteğe bağlı açılma pikseli (giden outbox) | `EKOLOJIK_MAIL_TRACK=1` |
| 20.3 | AI öneri: `EKOLOJIK_POSTA_AI=1` + harici API | Compose yardım |
| 20.4 | Outbox analitik paneli (gönderim/hata oranı) | Ayarlar sekmesi |

**Kabul:** Fatura konulu IMAP otomatik Fatura’ya düşer; tracking kapalı varsayılan.

---

## Faz 21 — PWA, kısayollar, erişilebilirlik

| # | İş | Çıktı |
|---|-----|--------|
| 21.1 | Klavye kısayolları (j/k, c compose, r reply, / search) | Hub |
| 21.2 | POS PWA: Posta sekmesi offline cache (salt okuma son liste) | Service worker lite |
| 21.3 | NB UI yürüyüşü genişletilmiş (~30 dk) | `EKOLOJIK-POSTA-NB-UI-YURUYUS.md` |
| 21.4 | Karşılaştırma checklist satır satır güncel | `EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md` |

---

## Faz 22 — Tam parite kapısı (yeniden kapatma)

| # | İş | Çıktı |
|---|-----|--------|
| 22.1 | `sunucu-ekolojik-posta-parite-dogrula.sh` — Faz 14–21 API maddeleri | Script |
| 22.2 | E2E: konuşma + ilet + IMAP junk + mesaj thread | `EKOLOJIK-POSTA-E2E-SMOKE.md` |
| 22.3 | `sunucu-ekolojik-posta-kabul-sira.sh` güncel | VPS tek komut |
| 22.4 | `EKOLOJIK-POSTA-KULLANIM.md` operatör rehberi | Doküman |

**Kabul:** Checklist’te “bilinçli eksik” alanı **boş**; prod kapatma yeşil.

---

## Önerilen sıra

```text
Faz 14 (IMAP klasör) ──► Faz 15 (konuşma/arama)
         │                        │
         └──────────┬─────────────┘
                    ▼
              Faz 16 (compose tam)
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
   Faz 17 (kişi/takvim)   Faz 18 (sohbet tam)
         │                     │
         └──────────┬──────────┘
                    ▼
         Faz 19 → 20 → 21 → 22 (kapatma)
```

**Paralel mümkün:** 17 ve 18 farklı dosya setleri; 14 bitmeden 16 ek gönderimi yapılabilir.

---

## NB PM haritası (güncel)

| NB PM | Ekolojik faz |
|-------|----------------|
| PM-1 Nav badge | 10 ✅ |
| PM-2 RTE / şablon | 8 ✅ → **16** genişlet |
| PM-3 Gönderen | 11 ✅ |
| PM-4 PWA offline | **21** lite |
| PM-5 Dovecot/IMAP | 6/7 ✅ → **14** klasör |
| PM-6 SSE | 10 ✅ |
| PM-7 Ek 10 MB | **19** |
| PM-8 Bildirim matrisi | 11 ✅ → **18–19** |
| PM-9 AI | **20** (opsiyonel env) |
| PM-10 Analitik | 11 lite → **20** |

---

*Ana plan: `PLAN-EKOLOJIK-POSTA-NB-PARITE.md` · Bağımsızlık: `PLAN-EKOLOJIK-MAIL-MESAJ-BAGIMSIZ.md`*
