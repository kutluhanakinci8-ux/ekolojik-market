# Posta sekmesi — operatör kılavuzu (Ekolojik Market POS)

NB **Lerta Posta** ile aynı **düzen** (klasörler, Yaz, Sohbet, Tam görünüm); veri ve sunucu **Ekolojik’e özeldir** (`EKOLOJIK_*`, `LERTA_PLATFORM_BRIDGE=0`).

## Günlük kullanım

1. Üst menü **Posta** — rozet: okunmamış gelen + fatura + müşteri mesajları.
2. Sol sütun: **Tümü**, **Gelen**, **Yıldızlı**, **Ertelenen**, **Fatura**, **Spam**, **Arşiv**, **Çöp**, **Taslaklar**, **Gönderilen**, **Müşteri mesajları**, **Kişiler**, **Takvim**.
3. Orta: liste (Mesaj / Konuşma modu, arama, filtre çipleri).
4. Sağ: okuma, yanıtla, ilet, tümünü yanıtla, takvime ekle.

### Klavye (Faz 21)

| Tuş | İşlem |
|-----|--------|
| `j` / `k` | Listedeki önceki / sonraki öğe |
| `c` | Yaz (yeni e-posta) |
| `r` | Seçili gelene yanıtla |
| `/` | Arama kutusuna odaklan |

### Gelen ve IMAP

- **Tam webmail / Dovecot JMAP yok** — okuma ve klasörler POS **Posta hub** ve salt okunur **JMAP lite** köprüsü (`GET /api/posta/jmap-lite/*`) üzerinden; gönderim hub **Yaz** ve outbox ile yapılır.
- **IMAP yenile**: yapılandırılmışsa kutuyu senkronize eder (Gelen, Gönderilen, Spam, Çöp, Taslaklar).
- Mesaj detayında **Sunucu klasörü** (inbox / sent / junk / trash / drafts), IMAP bayraklarıyla uyumlu gösterilir.
- **Konuşma** modu: aynı konuya ait yanıtlar tek zincirde.
- **Toplu işlem**: satır seç → okundu / arşiv / spam / çöp; **Tümünü okundu işaretle**.
- **Depolama çubuğu**: ek + inbox JSON kullanım yüzdesi.

### Fatura klasörü

- Fatura kaynak eşleşmesi ve **kurallar** (Ayarlar → E-posta): konu veya gönderende “fatura”, “e-fatura” vb. → otomatik **Fatura** klasörü.

### Yaz

- Cc/Bcc, ek (10 MB toplam), imza, şablonlar, taslak otosave.
- **AI öneri** (isteğe bağlı): sunucuda `EKOLOJIK_POSTA_AI=1` (+ isteğe bağlı harici API URL).

### Müşteri mesajları (Sohbet)

- **Sohbet** / **Tam** görünüm; thread arşiv, sabitle, sessize al, thread içi arama.
- CRM’den `?customerId=` ile aynı thread açılır.

### Gönderilen

- Outbox + IMAP Sent birleşik liste; hatalı kayıt **Tekrar dene**.

### Çevrimdışı (lite)

- Ağ kesilirse son **Gelen** listesi salt okunur gösterilir (service worker + yerel önbellek).

### Takvim ve kişiler (CalDAV / CardDAV lite)

- Hub **Takvim**: etkinlik ekleme/düzenleme; harici uygulama için **ICS abonelik** (`Ayarlar → E-posta` veya takvim paneli).
- **CalDAV lite** (`GET /api/posta/caldav-lite/*`): REST ile etkinlik listesi / yazma / silme (tam CalDAV sunucu değil).
- **CardDAV lite**: `export.vcf` dışa aktarma, `POST /api/posta/contacts/import` ile vCard/CSV içe aktarma.

### PWA push

- **Ayarlar → E-posta**: “Test bildirimi gönder” ve abonelik (VAPID gerekli).
- **iOS**: Safari → Ana Ekrana Ekle → uygulamayı ana ekrandan açın → bildirim izni (iOS 16.4+).

## Ayarlar → E-posta

- SMTP testi, kuyruk işleme, gönderen / Reply-To / ops / imza / bildirim matrisi.
- **Outbox analitik** (son 14 gün gönderim / hata oranı).
- **Posta kuralları** düzenleme.
- Rapor: Outbox CSV, iletişim CSV, mesajlaşma ZIP (KVKK).

## İsteğe bağlı sunucu bayrakları

| Değişken | Açıklama |
|----------|----------|
| `EKOLOJIK_MAIL_TRACK=1` | Giden HTML’de açılma pikseli (varsayılan kapalı) |
| `EKOLOJIK_POSTA_AI=1` | Compose AI öneri |
| `EKOLOJIK_IMAP_WRITE=1` | Spam/çöp bayraklarında IMAP MOVE |
| JMAP lite smoke | `npm run test:jmap-lite` (opsiyonel `EKOLOJIK_VERIFY_BASE_URL`) |

## VPS doğrulama (tek komut)

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos
```

Tam kabul (önerilen, E2E atlanmış):

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
```

DNS panel kayıtları yayınlandıktan sonra:

```bash
EKOLOJIK_DNS_STRICT=1 bash /var/www/ekolojik-market-pos/scripts/sunucu-ekolojik-dns-mail-dogrula.sh
```

## İşletme posta kutusu (önemli)

- **Kayıt / ayarlardaki e-posta** işletmenin **iletişim ve bildirim** adresidir; kişisel Gmail/Outlook hesabınız değildir.
- **Posta → Gelen** kutusu, sunucuda yapılandırılmış **ortak işletme hesabıdır** (ör. `info@ekolojikmarket.com.tr` veya hosting IMAP kullanıcısı). Yetkili personel aynı kutuyu POS üzerinden görür.
- Müşteri **Sohbet** (Müşteri mesajları), e-posta kutusundan bağımsızdır; web sitesi widget’ı isteğe bağlıdır (`/api/public/messaging/v1`).

Kayıt sonrası kurulum: [EKOLOJIK-POSTA-ONBOARDING-OPERATOR.md](./EKOLOJIK-POSTA-ONBOARDING-OPERATOR.md) (adımlar + VPS checklist). Mimari plan: [PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md](./PLAN-EKOLOJIK-POSTA-KAYIT-ONBOARDING.md).

Prod kapatma: `bash scripts/sunucu-ekolojik-posta-prod-kapat.sh`  
Haftalık otomatik: `bash scripts/sunucu-ekolojik-posta-parite-cron-kur.sh` (root, bir kez)  
Parite özeti: `docs/EKOLOJIK-POSTA-PARITE-TAMAMLANDI.md`  
Manuel yürüyüş: `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md`  
E2E senaryolar: `docs/EKOLOJIK-POSTA-E2E-SMOKE.md`
