# Ekolojik platform operatörü (kutluhan08)

## Amaç

`kutluhan08` artık **Greenleaf (`main`) mağaza kullanıcı listesinde değil**. Tüm kiracıları (`main`, `lima-market`, …) tek merkezden izleyen ve gerektiğinde her birinin POS’una geçen **platform operatörü** hesabıdır.

## Giriş

1. **Giriş** sayfasında kullanıcı adı: `kutluhan08` (veya `kutluhan` / `kutluhanakinci8`)
2. Mağaza kodu **gerekmez** (otomatik platform oturumu)
3. Başarılı giriş → **`/platform`** konsolu

## Konsol (`/platform`)

1. **Cari & tahsilat** — kiracı bazında açık cari, 30 gün tahsilat, en borçlu müşteriler
2. **Otomatik uyarılar** — gecikmiş ödemeler, bugünkü vadeler, düşük stok, eksik sıfırlama e-postası
3. **Birleşik ödeme takvimi** — tüm kiracıların `paymentReminders` (elektrik, su, vergi, kira vb.) tek görünümde
4. **POS aç** — seçilen kiracı için tam POS (`/app`)
5. **Kullanıcı işlemleri** sekmesi — toplam/aktif/terk, uyuyan hesaplar, 2FA ve e-posta kapsamı, mağaza özeti, filtreli kullanıcı dizini, son giriş akışı (`GET /api/platform/users`)
6. **Kiracılar** sekmesi — plan/deneme, askıya alma, salt okunur mod, operasyon notları (`GET /api/platform/tenants/lifecycle`, `PUT /api/platform/tenants/:id/lifecycle`)
7. **Altyapı** sekmesi — izolasyon kontrolleri, outbox, depolama, yedek/cron, SMTP/IMAP canlı test (`GET /api/platform/infrastructure`, `POST /api/platform/infrastructure/probe`)
8. **Denetim** sekmesi — olay zaman çizelgesi, bildirim geçmişi, eşik uyarıları, CSV (`GET /api/platform/audit`, `GET /api/platform/audit/export.csv`)
9. **Gelir** sekmesi — kiracı ciro, cari/tahsilat, plan dağılımı, tahmini MRR (`GET /api/platform/billing`, `GET /api/platform/billing/export.csv`)
10. **Destek** sekmesi — gelen kutusu (destek@), kayıtlar (case), SLA, kiracı 360, AI özet/taslak (aşağıda API listesi)
11. **Yapılandırma** sekmesi — runtime/allowlist özeti, operatör listesi, bakım bandı, deneme süresi, plan MRR (`GET /api/platform/settings`, `PUT /api/platform/settings` → `data/platform/console-settings.json`)
12. **Entegrasyonlar** sekmesi — SMTP/IMAP, Lerta, mesaj API, webhook, kiracı kanal matrisi (`GET /api/platform/integrations`, `POST /api/platform/integrations/probe`, `GET /api/platform/integrations/export.csv`)

API: `GET /api/platform/alerts`, `GET /api/platform/calendar?year=&month=`, `GET /api/platform/users`, `GET /api/platform/tenants/lifecycle`

Askıya alınan veya denemesi biten kiracılarda mağaza girişi engellenir (`data/platform/tenant-lifecycle.json`).

## Teknik

| Bileşen | Açıklama |
|---------|----------|
| Kimlik | `data/credential-vault/_platform.json` + `data/platform/operators.json` |
| Token | `role: platform`, `tenantId: __platform__` — kiracı API’lerinde yönetici yetkisi |
| API | `GET /api/platform/tenants`, `GET /api/platform/tenants/:id` |
| Deploy | `GREENLEAF_OWNER_PASSWORD` → `scripts/ensure-platform-operator.mjs` |

`yonetici` hesabı kiracı içi demo/platform yedek giriş olarak kalabilir; `kutluhan08` yalnızca platform kasasında tutulur.

## Destek (platform API özeti)

Tüm uçlar platform Bearer gerektirir (`kutluhan08` oturumu).

| Alan | Yöntem | Uç |
|------|--------|-----|
| Özet / SLA | `GET` | `/api/platform/support`, `/api/platform/support/sla-live`, `/api/platform/support/export.csv` |
| Politika | `PUT` | `/api/platform/support/policy` (`closedCaseInbound`: `reopen` \| `keep_closed` \| `new_case`) |
| Gelen kutusu | `GET` | `/api/platform/support/inbox` |
| Senkron | `POST` | `/api/platform/support/inbox/sync` (UI düğmesi; VPS’te ayrıca 5 dk cron) |
| Yanıt | `POST` | `/api/platform/support/inbox/reply` |
| Kayıtlar | `GET` | `/api/platform/support/cases`, `/api/platform/support/cases/export.csv` |
| Kayıt detay | `GET` | `/api/platform/support/cases/:id` |
| Kayıt güncelle | `PUT` | `/api/platform/support/cases/:id` |
| Aksiyon (not / e-posta) | `POST` | `/api/platform/support/cases/:id/action` |
| AI | `POST` | `/api/platform/support/cases/:id/ai` — `kind`: `summary`, `draft_reply`, `apply_macro` (+ `macroId`), `personalize_macro`, `refine_draft` (+ `draft`); harici model: `EKOLOJIK_POSTA_AI=1` |
| Aktivite dışa aktarma | `GET` | `/api/platform/support/cases/:id/activity/export.csv`, `.../export.html` — `?filter=all\|email_inbound\|email_outbound\|note` |
| Kiracı 360 | `GET` | `/api/platform/support/tenant-360?tenantId=` |
| Zendesk köprü | `GET` | `/api/platform/support/zendesk/bridge` |
| Zendesk webhook | `POST` | `/api/platform/support/zendesk/webhook` (secret header; ticket_id + status) |
| Zendesk push | `POST` | `/api/platform/support/cases/:id/zendesk/push` (iç not, API token gerekir) |
| Zendesk create | `POST` | `/api/platform/support/cases/:id/zendesk/create` (yeni ticket + `platform_case_N` etiketi) |
| Zendesk durum | `POST` | `/api/platform/support/cases/:id/zendesk/sync-status` (platform → Zendesk); `PUT` kayıt durumu da senkron dener |
| Makrolar | `GET` / `PUT` | `/api/platform/support/macros` → `data/platform/support-macros.json` |
| Komut paleti | `GET` | `/api/platform/support/commands` · `POST` `/api/platform/support/command` |
| Kayıt meta | `PUT` | `/api/platform/support/cases/:id` (durum/öncelik/tür/atanan; aktivite + isteğe bağlı Zendesk durum senkronu) |
| Manuel kayıt | `POST` | `/api/platform/support/cases` (`channel: manual`) |
| Gelen → kayıt | `POST` | `/api/platform/support/cases/from-inbox` (`messageId` = thread kökü) |
| Kayıt etiketleri | `PUT` / `GET` | `tags` alanı · `GET /api/platform/support/cases/tags` · `?tag=` listesi |
| Gelen okundu | `POST` | `/api/platform/support/inbox/mark-read` — `{ messageIds: [] }` (filtredeki thread’lerdeki tüm okunmamışlar) |
| Kayıt listesi limit | `GET` | `/api/platform/support/cases?limit=` (en fazla 200; kuyruk bağlantısı için UI 500 ister) |
| İletişim kuyruğu | `GET` | `/api/platform/support/contact-queue?limit=` · `GET .../contact-queue/export.csv` · `POST .../cases/from-contact` |
| İletişim özet | `GET` | `/api/platform/support` → `contactForm.total` / `withoutCase` |
| Smoke / QA filtresi | `GET` / `PUT` | `/api/platform/support/smoke-filters` → `data/platform/support-filters.json` |
| Smoke önizleme | `POST` | `/api/platform/support/smoke-filters/preview` — taslak veya kayıtlı filtreyle gizlenecek thread örnekleri |
| SLA CSV | `GET` | `/api/platform/support/export.csv` — `contactFormTotal`, `contactFormWithoutCase` sütunları (platform geneli) |
| Talep CSV | `GET` | `/api/platform/support/cases/export.csv` — `tags` sütunu (`;` ile ayrılmış) |
| Mağaza sohbet | URL | `/app?tenant=&view=posta&threadId=` (platform kuyruktan **Sohbet**) |
| Aktivite filtre | `GET` | `.../activity/export.csv?filter=` — `zendesk`, `case_meta`, `messaging` dahil |

### Ortam değişkenleri (destek@)

| Değişken | Açıklama |
|----------|----------|
| `EKOLOJIK_SUPPORT_*` | destek@ IMAP/giden kimlik (`scripts/sunucu-ekolojik-destek-mailbox.sh`) |
| `EKOLOJIK_SUPPORT_OPS_NOTIFY` | `new_case` spawn sonrası ops@ mail (varsayılan açık; `0` ile kapat) |
| `EKOLOJIK_SUPPORT_OPS_SLA_NOTIFY` | Cron sonrası SLA/kuyruk özeti ops@ (kritik kuyruk veya geciken kayıt; 4 saat throttle) |
| `EKOLOJIK_SUPPORT_IMAP_SYNC_ALERT` | Cron senkron hatasında ops@ (varsayılan: ops notify ile aynı; saatte en fazla 1) |
| `EKOLOJIK_MAIL_LOGO_URL`, `EKOLOJIK_CONTACT_FORM_URL` | Otomatik alındı / spawn mail footer |
| `EKOLOJIK_SOCIAL_*` | Footer sosyal linkleri (tam `https://` URL; boşsa satır gösterilmez) |

### VPS cron (destek@ senkron)

Deploy (root) kurar: `/etc/cron.d/ekolojik-support-inbox-sync` → `scripts/platform-support-inbox-sync.mjs`, log: `/var/log/ekolojik-support-inbox-sync.log`.

Manuel: `MARKET_POS_DATA_DIR=/var/www/market-pos/data node scripts/platform-support-inbox-sync.mjs`

Detaylı ürün notları: `docs/PLATFORM-DESTEK-KOMUTA-MERKEZI.md`.

### Teslim öncesi (posta + mesaj + destek)

```bash
npm run test:ci
node scripts/pre-release-qa.mjs https://<VPS>:5180
MARKET_POS_DATA_DIR=/var/www/market-pos/data node scripts/ops-outbox-health.mjs
# İsteğe bağlı: failed temizlik
MARKET_POS_DATA_DIR=/var/www/market-pos/data node scripts/ops-outbox-health.mjs --requeue-all --process
```

| Değişken | Açıklama |
|----------|----------|
| `EKOLOJIK_CONTACT_AUTOREPLY=1` | İletişim formu müşteri alındı maili |
| `EKOLOJIK_ENABLE_CONTACT_AUTOREPLY=1` | Deploy sırasında `.env` içine otomatik ekleme |
| `PLATFORM_OPERATOR_PASSWORD` | `pre-release-qa` platform destek API kapısı (kutluhan08) |
