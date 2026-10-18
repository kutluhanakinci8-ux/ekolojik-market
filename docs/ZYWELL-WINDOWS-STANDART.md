# Zywell POS-80 — Windows standart yazıcı

## Kural

- **Marka/model:** Zywell 80 mm termal (POS-80 serisi) — program için standart fiş yazıcısı.
- **Windows kuyruk adı (sabit):** `Ekolojik POS-80 (Zywell)`
- **Fiş yolu:** Tarayıcı → `127.0.0.1:18765` (ham ESC/POS, diyalog yok)

## Kullanıcı ne yapar? (bir kez)

1. USB Zywell takılı, Windows’ta gerekirse üretici sürücüsü kurulu.
2. `https://www.ekolojikmarket.com.tr/app` → **Ayarlar → Fiş yazıcısı** → **Zywell otomatik kurulum (.ps1)** indir.
3. İndirilen `ekolojik-zywell-setup.ps1` → sağ tık → **PowerShell ile Çalıştır**.
4. Oturum açılışında görev zamanlayıcı fiş servisini başlatır.

Program açıldığında köprü kapalıysa üstte sarı kurulum bandı görünür.

## Teknik

- `scripts/install-windows-zywell-printer.ps1` — kuyruk oluşturma
- `scripts/install-windows-receipt-bridge.ps1` — repo geliştirici kurulumu
- `public/install/windows/` — canlı indirme paketi (`npm run windows:receipt-install:sync`)
- `npm run build` sync’i otomatik çalıştırır

## Sınırlar

Tarayıcı güvenlik nedeniyle yazıcı sürücüsünü **sessizce** kuramaz; kullanıcı kurulum betiğini **bir kez** onaylamalıdır. Sonrası otomatik.
