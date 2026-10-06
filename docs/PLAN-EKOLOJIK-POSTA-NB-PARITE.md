# Ekolojik Posta & Mesaj — NB (Lerta Posta) parite planı

**Referans:** Nakliye Borsası `LERTA_MAIL_MESSAGING_PARITY_100_ROADMAP.md` (PM-1…PM-10)  
**Kural:** Aynı **ürün hissi** (3 sütun, Yaz, Gelen, Mesajlar, Gönderilen) — **ayrı kod, ayrı veri, ayrı DNS**. NB API / `lerta-mail-*` **kullanılmaz**.

**Bugün (2026-10-06):** Faz 1–5 + Posta hub iskeleti. **Faz 6 (kod):** SMTP doğrulama script + health hint. **Faz 7–10 (kısmi):** birleşik inbox API, okunabilir gövde, klasörler, yanıt, hub mesaj yazma, nav badge.

---

## Parite hedefi (Ekolojik için gerçekçi)

| NB (Lerta Posta) | Ekolojik hedef (~SMB POS) | Kapsam dışı |
|------------------|---------------------------|-------------|
| Dovecot + tam webmail | Gmail/kurumsal **IMAP** + `info@` tek kutu | Kendi Dovecot (NB PM-5 kopyası) |
| JMAP / CalDAV | — | Takvim/CardDAV (Faz 4b opsiyonel) |
| SSE canlı sohbet | SSE veya 15 sn polling | WebSocket cluster |
| AI compose | — | LLM yanıt önerisi (v2) |
| ESP open/click | Outbox sent/failed + CSV export | Pixel tracking |

## Çalışma düzeni (her faz sonrası)

```bash
# 1) Faz branch’inde geliştirme biter bitmez:
bash scripts/ekolojik-posta-faz-kapat.sh "Faz N" cursor/posta-fazN-94bd

# 2) SSH yoksa VPS’te (root):
cd /var/www/ekolojik-market-pos && git pull origin main && bash scripts/sunucu-market-pos-otomatik-deploy.sh
```

Cloud Agent ortamında otomatik deploy için **`VPS_SSH_KEY`** veya **`VPS_SSH_KEY_B64`** secret tanımlayın (`scripts/agent-deploy.sh`).

---

## Durum özeti

| Bölüm | NB seviyesi | Ekolojik şimdi | Gap |
|-------|-------------|----------------|-----|
| Nav + 3 sütun | ✅ | ✅ iskelet | İçerik zayıf |
| Gelen kutusu | IMAP tam | İletişim JSON + bill IMAP | Birleşik **info@** IMAP + okunabilir gövde |
| Yaz | RTE + şablon | Basit form | Yanıt/ilet, şablon, müşteri From |
| Müşteri mesajları | `/messaging` tam | Hub’da salt okunur | Hub’dan **yaz** + ek |
| Gönderilen | Maildir sent | Outbox listesi | Detay + yeniden dene |
| SMTP / gönderen | S-A4 hub | `.env` + hata (587 refused) | **Postfix veya relay** + DNS |
| Badge / canlı | PM-1, PM-6 | Yok | Okunmamış sayacı + polling |
| Bildirim matrisi | PM-8 | Outbox özeti only | Basit tercihler (mail açık/kapalı) |

---

## Faz 6 — Altyapı bloker (NB önkoşul değil, Ekolojik zorunlu)

**Amaç:** `ECONNREFUSED :587` kalksın; giden/gelen aynı marka domain.

| # | İş | Çıktı | Sorumlu |
|---|-----|--------|---------|
| 6.1 | DNS: SPF, DKIM, DMARC `ekolojikmarket.com.tr` | Mail tester yeşil | Siz + VPS |
| 6.2 | **Seçenek A:** `mail.ekolojikmarket.com.tr` Postfix 587/465 + auth | `EKOLOJIK_SMTP_HOST=mail.…` | VPS |
| 6.3 | **Seçenek B:** Harici relay (SendGrid/Resend **Ekolojik hesap**) | Env + outbox aynı kalır | Siz |
| 6.4 | `.env` şablon + doğrulama script (`scripts/sunucu-ekolojik-smtp-dogrula.sh`) | Deploy sonrası otomatik test | Kod |
| 6.5 | `info@` / `bildirim@` ayrımı dokümante | From = bildirim, Reply-To = info | Doküman |

**Kabul:** Ayarlar → E-posta: SMTP **Hazır**; test maili gider.

---

## Faz 7 — Gelen kutusu paritesi (NB “Gelen” sütunu)

**Amaç:** Hub **Gelen** boş JSON değil; okunabilir mail/talep.

| # | İş | Çıktı |
|---|-----|--------|
| 7.1 | `info@` (veya tek kutu) **IMAP** — Posta hub “Gelen” ana kaynak | `billEmailClient` genişlet veya `server/mailboxImap.mjs` |
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

## Faz 12 — Entegrasyon kapısı (canlı “tam uyarlandı”)

| # | İş |
|---|-----|
| 12.1 | `scripts/sunucu-ekolojik-posta-parite-dogrula.sh` (SMTP, IMAP, hub API, badge) |
| 12.2 | E2E smoke: contact → Gelen → yanıt → Gönderilen |
| 12.3 | NB karşılaştırma checklist (manuel 30 dk) |
| 12.4 | Müşteri eğitim: 1 sayfa “Posta sekmesi nasıl kullanılır” |

---

## Önerilen uygulama sırası

```text
Faz 6 (SMTP/DNS)  ──bloker──►  Faz 7 (Gelen)  ──►  Faz 8 (Yaz/yanıt)
                                      │
                                      ▼
                              Faz 9 (Mesaj hub)
                                      │
                                      ▼
                              Faz 10 (badge/canlı)
                                      │
                                      ▼
                              Faz 11 (admin/export)
                                      │
                                      ▼
                              Faz 12 (doğrulama)
```

**Paralel:** Faz 9 UI, Faz 6 altyapısı aynı sprintte farklı kişiler — ama **demo “tam NB gibi” için Faz 6 şart**.

---

## NB PM haritası → Ekolojik

| NB | Ekolojik karşılık |
|----|-------------------|
| PM-1 Nav badge | Faz 10 |
| PM-2 RTE şablon | Faz 8 |
| PM-3 S-A4 gönderen | Faz 11.1 |
| PM-4 PWA offline | v2 (POS PWA yoksa ertele) |
| PM-5 Dovecot | **Faz 6/7** (IMAP kutu; full Dovecot opsiyonel) |
| PM-6 SSE | Faz 10 |
| PM-7 Ek 10 MB | ✅ 5 MB (artırılabilir) |
| PM-8 Bildirim matrisi | Faz 11.4 |
| PM-9 AI | v2 kapalı |
| PM-10 ESP analitik | Faz 11.2 lite |

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
