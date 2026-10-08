# Posta & mesajlaşma kurulumu — operatör rehberi

Bu belge, **kayıt sonrası 3 adımlı kurulum sihirbazını**, **işletme posta kutusu** kavramını ve **VPS ortam değişkenlerini** özetler. Teknik plan: [PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md](./PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md).

Günlük Posta kullanımı: [EKOLOJIK-POSTA-KULLANIM.md](./EKOLOJIK-POSTA-KULLANIM.md).

---

## İşletme kutusu ≠ kişisel e-posta

| Adres | Ne işe yarar? |
|-------|----------------|
| **Kayıt / ayarlardaki e-posta** | İşletme iletişim ve bildirim adresi (CRM, sözleşme, test maili alıcısı). Kişisel Gmail/Outlook değildir. |
| **Posta → Gelen (IMAP)** | Sunucuda tanımlı **ortak işletme hesabı** (ör. `info@ekolojikmarket.com.tr`). Yetkili personel POS üzerinden aynı kutuyu görür. |
| **Müşteri mesajları (Sohbet)** | `data/messaging/` içi yazışma; e-posta kutusundan bağımsız. Site widget’ı isteğe bağlıdır. |

> Size verilen `info@…` (veya hosting IMAP kullanıcısı) **mağazanın ortak posta kutusudur**. Kişisel hesabınızı bu alana bağlamayın.

---

## Kim kurulum sihirbazını görür?

- Yalnızca **admin** rolü.
- `settings.postaOnboarding.status` **`completed`** veya **`dismissed`** değilse, `/app` girişinde tam ekran sihirbaz açılır.
- **Mevcut mağazalar (main vb.):** deploy sonrası otomatik migrasyon → genelde `completed` (sihirbaz bir daha çıkmaz). Yeni **kayıt** tenant’ları sihirbazı tamamlar.

**Sonra hatırlat:** `status: dismissed` — tekrar açmak için **Ayarlar → E-posta → Kurulumu yeniden aç** veya `POST /api/posta/onboarding/reopen`.

---

## 3 adım — operatör akışı

### Adım 1 — E-posta altyapısı

**Amaç:** SMTP (giden) ve IMAP (gelen) hazır mı kontrol etmek; isteğe bağlı test maili.

| POS’ta | Sunucu API |
|--------|------------|
| SMTP / IMAP durum kartları | `GET /api/email/health`, `GET /api/posta/imap/health` |
| DNS özet (SPF/DKIM) | `GET /api/posta/deliverability` |
| Test gönder | `POST /api/email/test` (sihirbaz “Test gönder”) |
| Gönderen / ops | `GET /api/posta/settings` |

**Geçiş:** “Sunucu yöneticisi hallediyor” → adım atlanır (`mailHealth.skipped`).

**Alias (Faz 5):** `siparis@`, `fatura@` genelde hosting’de aynı IMAP hesabına yönlenir. Sihirbazda **siparis@ / fatura@ kurallarını ekle** veya:

```bash
curl -sS -X POST 'https://ekolojikmarket.com.tr/api/posta/onboarding/seed-alias-rules'
```

Sunucu env: `EKOLOJIK_MAIL_ALIASES=siparis@ekolojikmarket.com.tr,fatura@ekolojikmarket.com.tr` → `GET /api/posta/deliverability` listesinde görünür.

**Tenant özel kutu (Faz 6):** Ayarlar → E-posta → **Mağaza posta kutusu** — “Platform .env” kapatılıp mağaza IMAP girilir (`data/tenant-mail/{tenantId}.json`). `main` varsayılan olarak `.env` kullanır.

**VPS checklist (minimum):**

| Değişken | Açıklama |
|----------|----------|
| `EKOLOJIK_MAIL_FROM` | Giden From adresi |
| `EKOLOJIK_SMTP_HOST` / port | Genelde `127.0.0.1:25` (yerel Postfix) |
| `EKOLOJIK_IMAP_HOST` / user / pass | Gelen kutu (ör. `info@ekolojikmarket.com.tr`) |
| `EKOLOJIK_OPS_EMAIL` | İç bildirimler (iletişim formu, mesaj özeti) |

Doğrulama:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

### Adım 2 — Mesajlaşmayı siteye ekleme

**Amaç:** Web sitesinden müşteri mesajı → POS **Posta → Müşteri mesajları**.

| Yöntem | Detay |
|--------|--------|
| **Mağaza anahtarı (önerilen)** | Sihirbaz: “Mağaza API anahtarı oluştur” → `data/messaging/{tenantId}/public-config.json` |
| **Sunucu genel anahtar** | `.env` → `EKOLOJIK_MESSAGING_PUBLIC_KEY` (tenant anahtarı yoksa fallback) |

| API | İş |
|-----|-----|
| `GET /api/messaging/public-config?tenant=…` | Anahtar durumu |
| `POST /api/messaging/public-config` body `{ "rotate": true }` | Yeni tenant anahtarı |
| `GET /api/public/messaging/v1/capabilities?tenant=…` | Widget “API açık mı?” |

Embed örneği (sihirbazda kopyalanır):

- `tenantId` — `main` veya kayıt tenant id
- `apiKey` — mağaza veya env anahtarı
- `apiBase` — `https://ekolojikmarket.com.tr/api/public/messaging/v1`
- Multi-tenant: `?tenant=…` sorgu parametresi

**Geçiş:** “Sadece POS içi sohbet” → `messagingEmbed.skipped`.

### Adım 3 — Posta sekmesi

**Amaç:** Birincil yöneticide **Posta** menüsü (yeni kayıtlarda zaten açıktır).

- **Bitir** → `POST /api/posta/onboarding/complete`
- Diğer kullanıcılar: **Ayarlar → Kullanıcılar** → sekme yetkileri.

---

## Onboarding API (destek / test)

Tümü oturum gerektirmez (POS ile aynı güvenlik modeli); tenant: `?tenant=demo-mağaza`.

| Endpoint | Metot | Açıklama |
|----------|-------|----------|
| `/api/posta/onboarding` | GET | Durum + SMTP/IMAP/messaging özet |
| `/api/posta/onboarding` | PATCH | Adım `done` / `skipped`, `status` |
| `/api/posta/onboarding/complete` | POST | Tamamla + primary admin `posta` |

Örnek (main):

```bash
curl -sS 'https://ekolojikmarket.com.tr/api/posta/onboarding'
```

---

## Deploy sonrası veri migrasyonu (Faz 3)

Her deploy:

```bash
node /var/www/ekolojik-market-pos/scripts/migrate-posta-onboarding.mjs /var/www/market-pos/data
```

(`sunucu-market-pos-deploy.sh` bunu otomatik çalıştırır.)

- Eski mağaza: admin’lere `posta`, onboarding `completed`.
- Yeni kayıt (sihirbaz devam ediyor): otomatik tamamlanmaz.

---

## Sorun giderme

| Belirti | Kontrol |
|---------|---------|
| Sihirbaz sürekli açılıyor | `GET /api/posta/onboarding` → `status`; tamamlamak için adım 3 veya `complete` |
| Posta menüsü yok | Kullanıcı `allowedTabs` içinde `posta`; admin mi? Migrasyon çalıştı mı? |
| Gelen boş | IMAP env + **IMAP yenile**; `GET /api/posta/imap/health` |
| Widget 401/503 | `public-config` / `EKOLOJIK_MESSAGING_PUBLIC_KEY`; `capabilities` |
| Test mail gitmiyor | `GET /api/email/health`, outbox kuyruk (Ayarlar → E-posta) |

---

## İlgili belgeler

- [PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md](./PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md) — faz planı
- [PLAN-EKOLOJIK-MAIL-MESAJ-BAGIMSIZ.md](./PLAN-EKOLOJIK-MAIL-MESAJ-BAGIMSIZ.md) — mail/mesaj bağımsızlık
- [EKOLOJIK-FAZ6-SMTP-RUNBOOK.md](./EKOLOJIK-FAZ6-SMTP-RUNBOOK.md) / [EKOLOJIK-FAZ7-IMAP-RUNBOOK.md](./EKOLOJIK-FAZ7-IMAP-RUNBOOK.md)
