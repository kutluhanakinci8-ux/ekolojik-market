# Ekolojik Market — bağımsız mail & mesaj planı (Nakliye Borsası’ndan ayrı)

## Karar (net)

| | Nakliye Borsası | Ekolojik Market |
|---|-----------------|-----------------|
| **Ürün** | Yük / ihale / lojistik | POS, stok, Greenleaf satış |
| **Mail altyapısı** | Kendi VPS, outbox, `mail.lerta.tr` | **Kendi** — paylaşımlı API / ortak outbox **yok** |
| **Mesajlaşma** | NB PostgreSQL thread’leri | **Kendi** — NB thread’lerine **bağlanmaz** |
| **Veri** | NB `apps/api` DB | Ekolojik `data/` + ileride kendi DB |
| **Admin** | `/admin/bildirimler` (NB) | Ekolojik ayarlar / ileride mini admin |

**Referans, kopya değil:** NB’deki **tasarım fikirleri** (outbox kuyruk, retry, şablon, tercih) Ekolojik’e **ayrı kod ve ayrı sunucu** olarak uyarlanır. İki sistem **aynı instance olmayacak**.

> Repo’daki `server/lertaPlatformBridge.mjs` **varsayılan kapalı** (`LERTA_PLATFORM_BRIDGE=0`). Ortak NB API yalnızca bilinçli test için; üretim hedefi değil.

---

## Mevcut Ekolojik durum (Faz 0)

| Parça | Durum |
|-------|--------|
| CRM e-posta | `server/crmOutreach.mjs` — Resend veya `data/crm-outbox/` |
| İletişim formu | `POST /api/contact` → JSON dosya |
| Mesaj / sohbet | **Yok** |
| Fatura e-posta (IMAP) | Stub |
| Müşteri CRM | İstemci tarafı kuyruk + şablonlar |

**Domain hedefi (örnek):** `bildirim@ekolojikmarket.com.tr` veya ayrı subdomain `mail.ekolojikmarket.com.tr` — NB `notifications@mail.lerta.tr` ile **karışmayacak**.

---

## Faz 1 — Giden e-posta (Ekolojik-only)

**Amaç:** Tüm Ekolojik bildirimleri tek hat: kendi outbox + kendi SMTP.

| # | İş | Çıktı |
|---|-----|--------|
| 1.1 | `EmailOutbox` benzeri modül (Node): `data/email-outbox/` | ✅ `server/emailOutbox.mjs` |
| 1.2 | Gönderim: Ekolojik VPS **Postfix** (SMTP env) | ✅ `server/ekolojikSmtp.mjs` + nodemailer |
| 1.3 | DNS: SPF, DKIM, DMARC **ekolojikmarket.com.tr** | VPS / isimtescil (sizin) |
| 1.4 | `sendCrmEmail` → yalnızca Ekolojik outbox + SMTP | ✅ |
| 1.5 | Şablonlar: CRM (`emailTemplates.ts`) | Mevcut (HTML wrapper Faz 2) |
| 1.6 | İdempotency + retry (3 deneme) | ✅ outbox processor |

**Kabul:** CRM test maili Ekolojik From adresinden gider; NB admin outbox’unda **görünmez**.

---

## Faz 2 — İletişim & operasyon maili

**Amaç:** Landing + POS’tan gelen talepler Ekolojik posta hattına girer.

| # | İş |
|---|-----|
| 2.1 | `/api/contact` → outbox’a “iç bildirim” + isteğe bağlı otomatik yanıt müşteriye | ✅ `server/contactMail.mjs` |
| 2.2 | Operatör adresi: `EKOLOJIK_OPS_EMAIL` | ✅ |
| 2.3 | Ayarlar → “Mail testi” butonu (SMTP health) | ✅ (Faz 1 panel) |
| 2.4 | Gönderim günlüğü UI (son 50 outbox satırı, POS admin) | ✅ `EmailOutboxSettingsPanel` |
| 2.5 | `GET /api/contact/messages` — JSON iletişim kayıtları | ✅ |

---

## Faz 3 — Ekolojik mesajlaşma (NB’den bağımsız)

**Amaç:** Müşteri / tedarikçi ile **Ekolojik içi** yazışma; ihale thread’i değil.

| # | İş |
|---|-----|
| 3.1 | Veri modeli: `MessagingThread`, `Message` → `data/messaging/` veya SQLite | ✅ `data/messaging/{tenant}/` |
| 3.2 | API: `GET/POST /api/messaging/threads`, `…/messages` (Ekolojik `server.mjs`) | ✅ |
| 3.3 | POS: CRM müşteri kartında “Mesajlar” sekmesi | ✅ `MessagingPanel` |
| 3.4 | Bildirim: yeni mesaj → Faz 1 outbox (e-posta özeti) veya ileride push | ✅ `messaging/notify.mjs` |
| 3.5 | Dosya eki (opsiyonel Faz 3b): `data/messaging-attachments/` | (sonra) |

**Kabul:** NB `public/lerta-messaging/v1` **çağrılmaz**; thread id’ler Ekolojik namespace’inde.

---

## Faz 4 — Gelen posta (isteğe bağlı, Ekolojik-only)

**Amaç:** `info@` / fatura maili — NB Faz C’den **ayrı** kutu.

| # | İş |
|---|-----|
| 4.1 | IMAP veya forwarding → `billEmailClient.mjs` gerçek implementasyon |
| 4.2 | Fatura / sipariş e-postalarını ayrı klasör; POS’tan eşleme |
| 4.3 | NB inbound MX **kullanılmaz** |

---

## Faz 5 — Sertleştirme & ayrım kontrol listesi

- [ ] VPS: Ekolojik `market-pos` ayrı process; NB ayrı PM2 / port
- [ ] Env dosyaları karışmıyor (`EKOLOJIK_*` vs `MAIL_PLATFORM_*`)
- [ ] Monitoring: Ekolojik outbox failed sayacı
- [ ] Yedek: `data/email-outbox` + `data/messaging` günlük backup
- [ ] KVKK: mesaj/mail retention politikası (Ekolojik ayarlardan)

---

## Nakliye Borsası tarafı (dokunulmaz)

NB kendi roadmap’inde kalır (`docs/EMAIL_PLATFORM_STRATEGY_ABC.md`). Ekolojik entegrasyonu **yapılmaz**. İki firma, iki DNS, iki outbox.

---

## Zamanlama (teknik sıra, takvim değil)

1. **Faz 1** — giden mail (bloklayıcı; CRM çalışır hale gelir)  
2. **Faz 2** — contact + log UI  
3. **Faz 3** — mesajlaşma  
4. **Faz 4** — gelen mail (ihtiyaç varsa)  
5. **Faz 5** — prod checklist  

---

## Kod yolu (Ekolojik repo)

| Faz | Tahmini dosyalar |
|-----|------------------|
| 1 | `server/emailOutbox.mjs`, `server/ekolojikSmtp.mjs`, `crmOutreach.mjs` refactor |
| 2 | `server.mjs` contact handler, `SettingsScreen` mail panel |
| 3 | `server/messaging/*`, `src/components/crm/MessagingPanel.tsx` |
| 4 | `server/billEmailClient.mjs` |

**Silinmeyecek (legacy):** Resend/outbox dosyası geliştirme fallback olarak kalabilir; üretimde Faz 1 SMTP.

---

## Özet cümle

**Evet — anlaşıldı:** Mail ve mesaj **Ekolojik’te kendi sisteminde**, **Nakliye Borsası’nda kendi sisteminde**; ortak platform, ortak API, ortak outbox **hedef değil**. NB sadece “nasıl iyi yapılır” referansı; uygulama **tamamen ayrı**.
