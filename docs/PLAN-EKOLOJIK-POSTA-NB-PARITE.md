# Ekolojik Posta & Mesaj — NB (Lerta Posta) parite planı

**Referans:** Nakliye Borsası `LERTA_MAIL_MESSAGING_PARITY_100_ROADMAP.md` (PM-1…PM-10)  
**Kural:** Aynı **ürün hissi** (3 sütun, Yaz, Gelen, Mesajlar, Gönderilen) — **ayrı kod, ayrı veri, ayrı DNS**. NB API / `lerta-mail-*` **kullanılmaz**.

**Güncel (2026-10-07):** Faz **1–24** NB posta/mesaj paritesi + ops kapandı. **Faz 23–24:** haftalık cron, tam kabul tek komut, DNS uyarı entegrasyonu. **Prod kapatma:** `docs/EKOLOJIK-POSTA-PROD-KAPATMA.md` · **Tam kapı:** `sunucu-ekolojik-posta-faz22-dogrula.sh` · **Özet:** `docs/EKOLOJIK-POSTA-PARITE-TAMAMLANDI.md`.

---

## Parite hedefi (2026-10-07 güncelleme)

**Kural:** Nakliye Borsası Posta’daki **mail + mesaj** deneyimi Ekolojik’e uyarlanır — “v2 / kapsam dışı” **yok** (yalnızca altyapı farkları aşağıda).

| NB (Lerta Posta) | Ekolojik hedef | Not |
|------------------|----------------|-----|
| Sol menü: Tümü, Gelen, Yıldızlı, Ertelenen, Spam, Arşiv, Çöp, Taslaklar, Takvim, Kişiler | ✅ Faz 13 hub menüsü | Bayraklar `posta-inbox/*/flags.json` |
| Dovecot + tam webmail | **IMAP** + iletişim + fatura birleşik | NB Dovecot kopyası yok |
| JMAP / CalDAV | POS ödeme takvimi + hub **Takvim** | Harici CalDAV sync sonra |
| SSE canlı sohbet | SSE veya 15 sn polling | WebSocket cluster yok |
| AI compose | Sonraki sprint | LLM ayrı env |
| ESP open/click | Outbox sent/failed + CSV export | Pixel tracking sonra |

## Çalışma düzeni (her faz sonrası)

```bash
# 1) Faz branch’inde geliştirme biter bitmez:
bash scripts/ekolojik-posta-faz-kapat.sh "Faz N" cursor/posta-fazN-94bd

# 2) SSH yoksa VPS’te (root):
cd /var/www/ekolojik-market-pos && git pull origin main && bash scripts/sunucu-market-pos-otomatik-deploy.sh
```

Cloud Agent ortamında otomatik deploy için **`VPS_SSH_KEY`** veya **`VPS_SSH_KEY_B64`** secret tanımlayın (`scripts/agent-deploy.sh`).

---

## Durum özeti (2026-10-06 — kod)

| Bölüm | Ekolojik |
|-------|----------|
| Nav + 3 sütun hub | ✅ |
| Gelen (IMAP + iletişim) | ✅ |
| Gelen ek indir + yanıt In-Reply-To | ✅ (Faz 7.3 / 8.2) |
| Fatura → ödeme takvimi | ✅ (Faz 7.5) |
| Yaz / yanıt / şablon + markdown | ✅ (8 adet şablon) |
| Müşteri mesajları hub | ✅ |
| Gönderilen + retry | ✅ |
| Badge + SSE hub yenileme | ✅ |
| Admin / export (Faz 11) | ✅ |
| Doğrulama script (Faz 12) | ✅ |
| Kod statik kapı | `scripts/sunucu-ekolojik-kod-parite-dogrula.sh` |
| **SMTP/DNS canlı (Faz 6)** | **VPS ayarı** — deploy sonrası |

---

## Faz 6 — Altyapı bloker (NB önkoşul değil, Ekolojik zorunlu)

**Amaç:** `ECONNREFUSED :587` kalksın; giden/gelen aynı marka domain.

| # | İş | Çıktı | Sorumlu |
|---|-----|--------|---------|
| 6.1 | DNS: SPF, DKIM, DMARC `ekolojikmarket.com.tr` | Mail tester yeşil | Siz + VPS |
| 6.2 | **Seçenek A:** `mail.ekolojikmarket.com.tr` Postfix 587/465 + auth | `EKOLOJIK_SMTP_HOST=mail.…` | VPS |
| 6.3 | **Seçenek B:** Harici relay (SendGrid/Resend **Ekolojik hesap**) | Env + outbox aynı kalır | Siz |
| 6.4 | `.env` şablon + doğrulama script (`scripts/sunucu-ekolojik-smtp-dogrula.sh`) | Deploy sonrası otomatik test | Kod |
| 6.4b | Aynı VPS yerel relay | `scripts/sunucu-ekolojik-postfix-yerel-relay-kur.sh` · `docs/EKOLOJIK-FAZ6-SMTP-RUNBOOK.md` | Kod |
| 6.5 | `info@` / `bildirim@` ayrımı dokümante | From = bildirim, Reply-To = info | Doküman |

**Kabul:** Ayarlar → E-posta: SMTP **Hazır**; test maili gider.

---

## Faz 7 — Gelen kutusu paritesi (NB “Gelen” sütunu)

**Amaç:** Hub **Gelen** boş JSON değil; okunabilir mail/talep.

| # | İş | Çıktı |
|---|-----|--------|
| 7.1 | `info@` (veya tek kutu) **IMAP** — Posta hub “Gelen” ana kaynak | `billEmailImap.mjs` + `sunucu-ekolojik-imap-vps-kur.sh` |
| 7.2 | İletişim formu + IMAP birleşik liste (tür etiketi, okundu) | `POST /api/posta/inbox/mark-read` |
| 7.3 | Sağ panel: **HTML/text gövde**, ek indir — `JSON.stringify` kaldır | MIME parse (basit) |
| 7.4 | Klasörler: Gelen, Gönderilen (IMAP), Fatura (filtre), Arşiv | Sol sidebar NB gibi |
| 7.5 | Fatura e-postası → ödeme takvimine “işle” kısayolu | POS entegrasyon |

**Kabul:** Gelen’de en az 1 gerçek mail okunur; iletişim formu satırı tıklanınca insan okur.

---

## Faz 8 — Yaz & yanıt paritesi (NB “Yaz” + compose)

| # | İş | Çıktı |
|---|-----|--------|
| 8.1 | Hub **Yaz**: alıcı kitaplığı (müşteri + son contact e-postaları) | Autocomplete |
| 8.2 | **Yanıt / Yanıtla** gelen satırdan (contact + IMAP) | `In-Reply-To`, thread subject |
| 8.3 | 5–10 hazır şablon (sipariş, stok, teşekkür, KVKK) | `server/mailTemplates.mjs` |
| 8.4 | Zengin metin (minimal: kalın, liste, link) veya markdown → HTML | Compose bileşeni |
| 8.5 | Gönderilen’de outbox detay + “tekrar dene” (failed) | Hub sağ panel |

**Kabul:** NB’deki gibi Gelen’den “Yanıt” → Yaz paneli dolu açılır.

---

## Faz 9 — Müşteri mesajları paritesi (NB `/messaging`)

| # | İş | Çıktı |
|---|-----|--------|
| 9.1 | Hub **Müşteri mesajları**: listeden **compose** (müşteri kartına gitmeden) | `MessagingPanel` embed hub |
| 9.2 | Yeni thread / müşteri seçici | Modal |
| 9.3 | Ek gönderimi hub’dan (Faz 3b tamamlandı — UI taşıma) | Aynı API |
| 9.4 | Deep link: `?customerId=` → thread seç | URL query (POS hash) |
| 9.5 | Opsiyonel: müşteriye SMS/e-posta özeti (Faz 3 notify genişlet) | Env |

**Kabul:** NB Mesajlar sekmesine benzer: listede thread, sağda yazışma, altta yaz.

---

## Faz 10 — Canlılık & nav (NB PM-1 + PM-6 lite)

| # | İş | Çıktı |
|---|-----|--------|
| 10.1 | `GET /api/posta/unread-counts` (contact okunmamış + IMAP unseen + thread) | Tek sayı |
| 10.2 | Üst menü **Posta** badge | `AppShell` |
| 10.3 | SSE `GET /api/posta/events` veya 15 sn polling | Liste yenileme |
| 10.4 | Ses/titreşim yok (v1); ops e-posta özeti açık | Env |

**Kabul:** Yeni iletişim formu gelince badge artar; hub açılınca güncellenir.

---

## Faz 11 — Kurumsal & admin (NB PM-3 + PM-10 lite)

| # | İş | Çıktı |
|---|-----|--------|
| 11.1 | Ayarlar → **Gönderenler**: From adı, ops, reply-to, imza HTML | S-A4 mini panel |
| 11.2 | Outbox + posta CSV export (tarih aralığı) | Admin indir |
| 11.3 | Messaging thread export ZIP (KVKK) | `GET /api/messaging/export` |
| 11.4 | Bildirim tercihleri: olay × e-posta (contact, mesaj, fatura) | JSON settings |
| 11.5 | `docs/EKOLOJIK-FAZ5-PROD-CHECKLIST.md` tam kapatma | Cron yedek, env audit |

**Kabul:** Operatör tek ekrandan “kim ne aldı, ne gitti” raporu.

---

## Faz 13 — NB webmail menü paritesi (mail + mesaj UI)

| # | İş | Çıktı |
|---|-----|--------|
| 13.1 | Hub sol menü: Tümü, Yıldızlı, Ertelenen, Spam, Çöp, Taslaklar, Takvim, Kişiler | `EkolojikPostaHubScreen.tsx` |
| 13.2 | `POST /api/posta/inbox/flags` (yıldız, spam, çöp, erteleme) | `server/postaInboxFlags.mjs` |
| 13.3 | Taslaklar: `GET/POST /api/posta/drafts`, `DELETE …/drafts/:id` | `server/postaComposeDrafts.mjs` |
| 13.4 | Görünüm: Posta / Sohbet / Tam | Hub üst sekmeler |
| 13.5 | İletişim formu UTF-8 mojibake düzeltme | `repairUtf8Mojibake` |

**Kabul:** NB ekran görüntüsündeki klasör listesi POS Posta’da görünür; yıldız/spam/çöp/erteleme kalıcı.

**Sonraki:** Tam parite yol haritası → **`docs/PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`** (Faz 14–22, eksik kalmayacak).

---

## Faz 12 — Entegrasyon kapısı (canlı “tam uyarlandı”)

| # | İş | Çıktı |
|---|-----|--------|
| 12.1 | `scripts/sunucu-ekolojik-posta-parite-dogrula.sh` | SMTP, hub API, export, SSE smoke |
| 12.2 | E2E smoke: contact → Gelen → yanıt → Gönderilen | `docs/EKOLOJIK-POSTA-E2E-SMOKE.md` |
| 12.3 | NB karşılaştırma checklist (manuel 30 dk) | `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md` |
| 12.4 | Müşteri eğitim: 1 sayfa “Posta sekmesi nasıl kullanılır” | `docs/EKOLOJIK-POSTA-KULLANIM.md` |

**Prod kapatma (Faz 12 sonrası):** `scripts/sunucu-ekolojik-posta-prod-kapat.sh` · `docs/EKOLOJIK-POSTA-PROD-KAPATMA.md`

---

## Önerilen uygulama sırası

```text
Faz 6–12 ✅  →  Faz 13 ✅ (menü)
                    │
                    ▼
        Faz 14–22 (tam parite — ayrı plan dosyası)
```

Detay: `PLAN-EKOLOJIK-POSTA-NB-FAZ14-22-TAM-PARITE.md`

**Paralel:** Faz 9 UI, Faz 6 altyapısı aynı sprintte farklı kişiler — ama **demo “tam NB gibi” için Faz 6 şart**.

---

## NB PM haritası → Ekolojik

| NB | Ekolojik karşılık |
|----|-------------------|
| PM-1 Nav badge | Faz 10 |
| PM-2 RTE şablon | Faz 8 |
| PM-3 S-A4 gönderen | Faz 11.1 |
| PM-4 PWA offline | Faz 21 lite |
| PM-5 Dovecot | **Faz 6/7** (IMAP kutu; full Dovecot opsiyonel) |
| PM-6 SSE | Faz 10 |
| PM-7 Ek 10 MB | ✅ 5 MB (artırılabilir) |
| PM-8 Bildirim matrisi | Faz 11.4 |
| PM-9 AI | Faz 20 (env) |
| PM-10 ESP analitik | Faz 11.2 + Faz 20 |

---

## Kod yolu (tahmini)

| Faz | Dosyalar |
|-----|----------|
| 6 | `scripts/sunucu-ekolojik-smtp-dogrula.sh`, `.env.example`, runbook |
| 7 | `server/mailboxImap.mjs`, `server/postaInbox.mjs`, `EkolojikPostaHubScreen.tsx` |
| 8 | `src/components/posta/PostaCompose.tsx`, `server/mailTemplates.mjs` |
| 9 | Hub içi `MessagingPanel`, `messagingService` |
| 10 | `server/postaEvents.mjs`, `AppShell` badge |
| 11 | export handlers, `NotificationPrefsPanel.tsx` |
| 12 | `scripts/sunucu-ekolojik-posta-parite-dogrula.sh` |

---

## Sizin şimdi yapmanız gereken (Faz 6)

1. `/var/www/market-pos/.env` → `EKOLOJIK_SMTP_HOST=mail.ekolojikmarket.com.tr` (**168.231.109.27 değil**, Postfix yoksa).  
2. VPS’te Postfix **veya** relay hesabı.  
3. `bash …/sunucu-market-pos-otomatik-deploy.sh` + `pm2 restart market-pos --update-env`.

Sonra kod sırası: **Faz 7 → 8 → 9 → 10 → 11 → 12**.

---

*Ana plan ile ilişki: `PLAN-EKOLOJIK-MAIL-MESAJ-BAGIMSIZ.md` (Faz 1–5 tamamlandı) · bu dosya **Faz 6–12 NB parite** uzantısıdır.*
