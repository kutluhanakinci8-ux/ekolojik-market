# NB Lerta Posta ↔ Ekolojik — POS ekran yürüyüşü (~30 dk)

Önkoşul: POS oturumu açık, `posta` sekmesi yetkili kullanıcı.

| # | NB | Ekolojik POS adımı |
|---|----|--------------------|
| 1 | Nav badge | Sol menü **Posta** — rozet = okunmamış toplam |
| 2 | 3 sütun hub | **Posta** ana ekran — Gelen / Yaz / Müşteri mesajları |
| 3 | Gelen okunabilir | **Gelen** → son smoke/iletişim satırı — gövde düz metin |
| 4 | Yaz + şablon | **Yaz** → şablon; Gelen’den **Yanıtla** → alıcı hints |
| 5 | Müşteri mesajları | Hub **Müşteri mesajları** → thread + staff yanıt |
| 6 | Gönderilen | **Ayarlar → E-posta** → outbox listesi, `sent` |
| 7 | SSE | Posta ekranında 15 sn bekle — rozet güncellenir |
| 8 | Gönderen ayarları | **Ayarlar → E-posta** — ad, ops, imza |
| 9 | Export | Outbox CSV + mesajlaşma ZIP indir |
| 10 | Bağımsız altyapı | **Ayarlar → Sistem** — Faz 5 ayrım yeşil |
| 11 | Klavye kısayolları | Hub: `j`/`k` liste, `c` yaz, `r` yanıt, `/` ara |
| 12 | Konuşma + ilet | Gelen → Konuşma modu → ilet / tümünü yanıtla |
| 13 | IMAP Junk | Spam klasörü + IMAP yenile |
| 14 | Toplu işlem | Gelen → seç → arşiv / spam |
| 15 | Depolama çubuğu | Üst çubuk % doluluk |
| 16 | Kurallar / analitik | **Ayarlar → E-posta** Faz 20 paneli |
| 17 | Offline salt okuma | Ağ kes → son gelen listesi (SW + localStorage) |
| 18 | Sohbet tam | **Sohbet** görünüm + `?customerId=` CRM |
| 19 | Güvenlik | Anonim `/api/posta/inbox` → 401; export CSV token ile |
| 20 | Widget | `/widget/messaging.js` + public messaging key (Ayarlar) |
| 21 | DNS / deliverability | Ayarlar → tenant DNS checklist |
| 22 | Engagement | Hub üst şerit (açılma/tıklama/bounce) |
| 23 | Omnichannel | WA rozeti + kanal ayarları |
| 24 | Bot / SLA | Thread durum + atama; SLA şeridi |
| 25 | Müşteri portal | `/portal/mesajlar` veya iletişim formu portal linki |

Otomatik (VPS):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh
```

Tek kapı (VPS):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-wave3-operator-kapi.sh /var/www/market-pos
```

Headless POS (Playwright — otomatik: #1–11, #13, #15–16, #18–19, #20–21, #24–25; WARN: #22–23; manuel: #12, #14, #17):

```bash
npm i -D playwright && npx playwright install chromium
MINT_JSON="$(node scripts/lib/mint-posta-qa-token.mjs /var/www/market-pos/data)"
EKOLOJIK_POS_QA_MINT_JSON="$MINT_JSON" node scripts/posta-nb-ui-visual-smoke.mjs http://127.0.0.1:5180
```

API-only:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh
```

Karşılaştırma tablosu: `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md`
