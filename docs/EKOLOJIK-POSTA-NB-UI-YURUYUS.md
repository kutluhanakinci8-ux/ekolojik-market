# NB Lerta Posta ↔ Ekolojik — POS ekran yürüyüşü (~15 dk)

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

Otomatik (VPS):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-ui-yuruyus.sh
```

API-only:

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh
```

Karşılaştırma tablosu: `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md`
