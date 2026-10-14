# Platform Destek — Komuta Merkezi (ürün planı)

**Durum:** Operasyonel (2026-10-14) — çekirdek D1–D6 canlı; aşağıdaki gap tablosu tarihsel referans + kalan işler.  
**Hedef kullanıcı:** `kutluhan08` ve platform operatörleri  
**Vizyon:** Destek sekmesi yalnızca SLA tablosu değil; **omnichannel operasyon + kiracı 360° + sistem geneli üst düzey yönetim** merkezi.

---

## 1. Durum özeti (2026-10-14)

| Alan | Canlı | Kalan / risk |
|------|--------|----------------|
| Gelen kutusu | destek@ IMAP/outbox köprüsü, thread UI, ekler, okundu toplu | Harici DNS/alias VPS doğrulaması (`sunucu-ekolojik-support-imap-dogrula.sh`) |
| Kanallar | Case + e-posta + mesaj (thread bağlı) + iletişim formu kuyruğu | Outbox/güvenlik uyarıları hâlâ ayrı sekmelerde özet |
| SLA / kuyruk | Smoke filtresi (UI + önizleme), prod kuyruk, SLA canlı panel, **özür kuyruğu + toplu gönder** (`sla-apology` API) | Tam otomatik cron özür (onaysız) yok — operatör onayı gerekli |
| Yanıt | Case detay: not / e-posta / mesaj; makrolar; AI taslak | Mesaj yanıtı thread bağlantısı olmadan çalışmaz |
| Operasyon | Komut paleti, kiracı 360, Zendesk köprüsü, CSV export | Zendesk canlı webhook testi ortam bağımlı |
| Outbox | Kiracı Posta + platform komut `/requeue_outbox`; Destek hero **opsSignals** (failed + kritik uyarı) | Prod **failed/pending** triage: `scripts/ops-outbox-health.mjs` |

Teslim öncesi: `npm run test:ci`, `node scripts/pre-release-qa.mjs https://…`, `node scripts/ops-outbox-health.mjs` (VPS data dir).

---

## 2. Rakip kıyası (2025–2026)

| Ürün | Güçlü yan | Ekolojik için öğrenilecek |
|------|-----------|---------------------------|
| **Zendesk Suite** | Omnichannel routing, SLA breach önceliği, skills, canlı dashboard | Tek kuyruk + SLA breach sıralama + agent kapasitesi |
| **Freshdesk Omni** | Email + chat + WhatsApp tek inbox; saniye seviyesi SLA chat için | “Command center” layout; kanal bazlı SLA |
| **Intercom** | Messenger + Fin AI + kullanıcı bağlamı | Sağ panel **müşteri/kiracı 360** |
| **Front** | Paylaşımlı ekip inbox, atama, iç not | `destek@` için paylaşımlı kutu + @mention |
| **Salesforce Service Cloud** | Case + Account + entegrasyon | **Case** = talep; Account = kiracı |
| **Linear / Jira** | Sorun/talep yaşam döngüsü | “Sorun” tipi kayıtlar (bug, infra, faturalama) |

**Premium farkımız (hedef):** Multi-tenant POS + posta + muhasebe + stok **tek operatör konsolunda**; rakiplerin çoğu ya sadece destek ya sadece CRM.

---

## 3. Ürün konumlandırma

**Destek 2.0 = “Ekolojik Operasyon Merkezi”** (sekme adı kullanıcıya: **Destek** kalabilir; alt başlık: *Komuta merkezi*).

Üç katman:

1. **Gelen (Inbox)** — insan + otomatik giden iletişim  
2. **İş (Work)** — talep, sorun, SLA, atama  
3. **Eylem (Act)** — kiracı/kullanıcı/stok/muhasebe/güvenlik kısayolları

Diğer platform sekmeleri **derinleşme** için kalır; Destek onlara **bağlantı + özet KPI** taşır (duplicate etmez).

---

## 4. `destek@ekolojikmarket.com.tr` — teknik plan

### 4.1 Posta altyapısı (mevcut VPS)

- Domain: `ekolojikmarket.com.tr` (Postfix + virtual alias — `info@` ile aynı model).
- **Yeni alias:** `destek@ekolojikmarket.com.tr` → platform operatör kuyruğu (veya `ekolojik-inbound-destek-…` postmap).
- Env: `EKOLOJIK_MAIL_ALIASES` içine ekle; deliverability hub’da görünür.
- **Giden:** `bildirim@` veya `destek@` From/Reply-To politikası:
  - Müşteri/kiracıya yanıt: **Reply-To: destek@**
  - Sistem otomasyonları: mevcut `bildirim@` kalabilir; operatör yanıtları `destek@` imzası.

### 4.2 Uygulama

| Bileşen | Görev |
|---------|--------|
| `platform-support-inbox.json` veya IMAP klasörü | Gelen destek maillerinin normalize kaydı |
| IMAP poll / mevcut `posta-inbox` | `destek@` için ayrı filtre veya etiket |
| Outbox | Operatör yanıtları `enqueue` + tenant `__platform__` veya global kasa |
| Messaging bridge | Aynı **case id** altında email + thread birleştirme (Faz 2) |

### 4.3 Otomatik mail & mesaj

- **Giriş:** Mevcut `contactMail`, şifre sıfırlama, outbox failed, güvenlik notify → operatör kuyruğuna **sistem olayı** olarak düşer.
- **Çıkış:** Makro şablonları (TR): ilk yanıt, SLA ihlali özür, deneme bitişi, ödeme hatırlatması.
- **Mesaj:** Kiracı `messaging` thread’ine operatörden staff mesajı (`appendMessagingMessage`) — platform UI’dan.
- **Onay:** Kritik otomasyonlar için “öneri + tek tık gönder” (tam otopilot sonra).

---

## 5. Birleşik kayıt modeli: **Operasyon kaydı (Case)**

Tek ID altında toplanacaklar:

| Kaynak | `case.kind` | Örnek |
|--------|-------------|--------|
| Messaging thread | `conversation` | Müşteri mesajı |
| destek@ mail | `email` | Gelen e-posta |
| İletişim formu | `contact_form` | Web formu |
| Platform alert | `alert` | Gecikmiş ödeme, düşük stok, failed login spike |
| Operatör manuel | `manual` | İç talep |

**Alanlar (özet):** `id`, `tenantId`, `priority`, `status` (new/open/pending/solved), `channel`, `subject`, `requester`, `assignee` (platform op), `slaDueAt`, `tags[]`, `linkedThreadId`, `linkedEmailId`, `createdAt`, `updatedAt`.

**Sorun vs talep:**

- **Talep (request):** müşteri/kiracı odaklı (iade, eğitim, limit artışı).  
- **Sorun (incident):** sistem odaklı (outbox down, IMAP fail, entegrasyon kırık).

---

## 6. Sekme içi bilgi mimarisi (premium UX)

### 6.1 Layout (Freshdesk/Zendesk + Front karışımı)

```
┌─────────────────────────────────────────────────────────────────┐
│ Hero: Açık case · SLA risk · destek@ bekleyen · WS canlı        │
├──────────┬──────────────────────────────┬───────────────────────┤
│ Sol nav  │ Orta: Liste veya konuşma   │ Sağ: Kiracı 360       │
│ · Gelen  │ (inbox / timeline)         │ · Mağaza özeti        │
│ · Talep  │                            │ · Son satış / cari     │
│ · Sorun  │                            │ · Kullanıcılar (top)   │
│ · Otomasyon│                          │ · Hızlı eylemler       │
│ · SLA    │                            │ · POS aç / askıya al   │
└──────────┴──────────────────────────────┴───────────────────────┘
```

### 6.2 Görsel dil

- Mevcut `platform-shell--premium` ile uyum; Destek için **ikinci seviye nav** (pill tabs).
- SLA: canlı geri sayım çubuğu (kritik = amber/kırmızı).
- Kuyruk: severity şeridi + kiracı logosu/initials (mevcut `platformUserUi`).
- Boş durum: “destek@ henüz bağlanmadı” → kurulum checklist (DNS, alias, IMAP test).

### 6.3 Kiracı 360 — hızlı eylemler

| Eylem | Kaynak API / sekme |
|--------|---------------------|
| POS aç | Mevcut tenant switch |
| Askıya al / salt okunur | `PUT .../lifecycle` |
| Kullanıcı oturumu kapat | Güvenlik revoke |
| Outbox işle / failed requeue | Posta |
| Ödeme / cari özeti | Gelir / Genel bakış |
| Düşük stok listesi | Kiracı alerts |
| Demo / deneme uzat | Yapılandırma + lifecycle |
| Güvenlik skoru | Güvenlik snapshot |

---

## 7. Modül haritası (sistemin bütünü)

Destek sekmesinde **özet widget + case’e bağlama**; detay ilgili sekmede.

| Domain | Widget | Tetikleyici → case |
|--------|--------|---------------------|
| **Muhasebe** | Açık cari, gecikmiş ödeme | `alert` → operatör arar |
| **Stok** | Düşük stok sayısı | alert |
| **Kullanıcılar** | Uyuyan admin, 2FA eksik | alert → Güvenlik’e link |
| **Güvenlik** | 24s failed login, eşik | alert + webhook durumu |
| **Demo hesaplar** | Deneme bitişi 7 gün | otomatik mail makrosu |
| **Talepler** | Manuel + form + mail | request case |
| **Sorunlar** | Infra probe fail, outbox | incident case |
| **Entegrasyonlar** | SMTP/IMAP/Lerta | incident + probe butonu |

---

## 8. Uygulama fazları (önerilen sıra)

### Faz D1 — Temiz kuyruk & güven (1 sprint)

- [ ] QA/smoke thread filtresi (`channel`, `customerName`, `subject` kuralları; `data/platform/support-filters.json`).
- [ ] Kuyruk önceliği: gerçek müşteri vs test etiketi.
- [ ] SLA uyumu: yalnızca `human` yanıtlar veya prod etiketli thread’ler.

### Faz D2 — `destek@` MVP (1–2 sprint)

- [ ] VPS alias + IMAP routing dokümantasyonu ve doğrulama scripti.
- [ ] Platform API: `GET/POST /api/platform/support/inbox`, `POST .../inbox/reply`.
- [ ] UI: sol “Gelen” listesi, okuma/yazma, şablonlar (3 adet).

### Faz D3 — Case modeli (2 sprint)

- [ ] `data/platform/cases.json` veya sqlite-lite jsonl.
- [ ] Messaging + email → case bağlama.
- [ ] Talep / Sorun ayrımı, atama, durum.

### Faz D4 — Omnichannel yanıt (2 sprint)

- [ ] Tek ekrandan: e-posta yanıtı + mesaj + iç not.
- [ ] Otomasyon: SLA breach → destek@’ten şablon (onaylı).
- [ ] İletişim formu kayıtları kuyruğa.

### Faz D5 — Komuta 360 (2 sprint)

- [ ] Sağ panel kiracı özeti (mevcut API’leri birleştir).
- [ ] Widget’lar: muhasebe, stok, güvenlik, demo.
- [ ] Komut paleti (`/`): “lima askıya al”, “outbox requeue”.

### Faz D6 — Premium & AI (opsiyonel)

- [ ] Özet önerisi (thread uzun), yanıt taslağı (TR).
- [ ] Canlı SLA dashboard (Zendesk tarzı).

---

## 9. Başarı metrikleri

- İlk yanıt süresi (medyan) — prod case’lerde < 4 saat (iş saatleri).
- `destek@` gün içi kapanmayan mail sayısı.
- SLA ihlal oranı (case bazlı).
- Operatörün sekme değiştirme sayısı (hedef: düşüş — her şey Destek’ten çözülür).
- QA kuyruk gürültüsü: smoke thread’lerin operasyon kuyruğunda %0.

---

## 10. Onaylanan kararlar (2026-10-13)

| Konu | Karar |
|------|--------|
| Sekme adı | **Destek** |
| destek@ | **Ayrı posta kutusu** (`scripts/sunucu-ekolojik-destek-mailbox.sh`) |
| Otomatik alındı | **destek@** (giden kimlik) |
| Smoke/QA | **Tamamen gizli** (`data/platform/support-filters.json`) |
| Harici ticket | **Evet** — `externalTicketRef` alanı (Zendesk vb. Faz D3) |

## 11. Uygulama durumu

- **D1:** Smoke filtresi + üretim SLA/kuyruk (`platformSupportFilters.mjs`)
- **D2:** destek@ IMAP senkron, otomatik alındı, gelen kutusu UI, yanıt API (`platformSupportInbox.mjs`)
- **D3:** Case modeli, Zendesk ref, kuyruk/gelen otomatik bağlama
- **D4:** Case detay omnichannel (e-posta / mesaj / iç not), makrolar, iletişim formu kuyruğu
- **D5:** Kiracı 360 sağ panel, komut paleti (`/suspend`, `/requeue_outbox`), POS kısayolu
- **D6:** AI özet/taslak (yerel şablon; `EKOLOJIK_POSTA_AI=1` + URL/key ile harici), **SLA canlı** sekmesi
- **VPS destek@:** `bash scripts/sunucu-ekolojik-destek-mailbox.sh --apply` (root) → `EKOLOJIK_SUPPORT_*`, doğrulama: `sunucu-ekolojik-support-imap-dogrula.sh`
- **VPS senkron cron:** deploy ile `sunucu-ekolojik-support-inbox-sync-cron-kur.sh` (5 dk) → `platform-support-inbox-sync.mjs`; hata → ops@ (`EKOLOJIK_SUPPORT_IMAP_SYNC_ALERT`)

İlgili kod (bugün): `PlatformSupportTab.tsx`, `platformSupportMetrics.mjs`, `postaInbox`, `messaging/store.mjs`, `contactMail.mjs`.
