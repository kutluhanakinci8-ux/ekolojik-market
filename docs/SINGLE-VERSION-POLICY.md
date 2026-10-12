# Tek program sürümü (Mac = Windows = web)

## Kural

1. **Tek uygulama:** Tüm kasalar `https://www.ekolojikmarket.com.tr/app` adresindeki **aynı** Vite/React build’ini kullanır. Mac veya Windows için **ayrı POS sürümü yok**.
2. **Sürüm numarası:** Yalnızca kök `package.json` → `version` (ör. `1.0.1`). Derleme kimliği: `vite.config.ts` → `buildId` + `dist/app-release.json`.
3. **Güncelleme:** VPS deploy (`npm run build` → `/var/www/market-pos/dist`). Tarayıcı `index.html` + `app-release.json` ile eski önbelleği bırakır (`useAppReleaseRefresh`, `index.html` build senkronu).
4. **Adres:** Yalnızca `www.ekolojikmarket.com.tr` (apex otomatik yönlendirilir). `www` olmayan adres ayrı `localStorage` oluşturur — kullanılmamalı.
5. **Mağaza verisi** (stok, fotoğraf, satış) **sunucuda**; **program kodu** GitHub + deploy. Karıştırılmaz.
6. **Fiş köprüsü** (`scripts/lima-raw-print-bridge.mjs`, Mac/Windows kurulum scriptleri) yazıcıya ham gönderim için **yerel yardımcı**dır; POS ekranının sürümü değildir.

## Doğrulama

- Ayarlar → Sistem Bilgisi → **Uygulama (canlı)** satırı (tüm cihazlarda aynı `version · buildId` olmalı).
- `npm test` içinde `scripts/single-version-smoke.mjs`.
- Deploy sonrası: `curl -s https://www.ekolojikmarket.com.tr/app-release.json`
