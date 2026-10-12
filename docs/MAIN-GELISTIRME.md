# Geliştirme — yalnızca `main` (tek program)

## Kullanıcı (kutluhan) için özet

1. **Program:** Herkes `https://www.ekolojikmarket.com.tr/app` — Mac = Windows, ayrı sürüm yok.
2. **Kod:** Tek hat **`main`**. Değişiklikler `main`’e girer → otomatik VPS deploy (GitHub Actions `deploy-vps.yml`).
3. **Mağaza verisi:** Sunucu (`/var/www/market-pos/data`), GitHub’da değil. Greenleaf: `kutluhan08`. Lima: `limaadmin` / `yonetici`.

## Akış

```
Değişiklik (Cursor Agent veya yerel)
  → PR veya doğrudan push → main
  → GitHub Actions: deploy-vps.yml (push main)
  → VPS: git pull main + npm run build + pm2 restart
  → Tüm kasalar: app-release.json ile aynı build
```

Cloud Agent dalları (`cursor/*-b923`) geçicidir; iş bitince **main’e merge**, dal kapatılır.

## Yapılmaz

- Canlıyı `cursor/...` dalından deploy etmek (yalnızca acil test; sonra main’e taşınır).
- `www` olmayan adres veya eski zip/repo kopyasından POS açmak.
- Açık PR’ları süresiz bırakmak — merge veya arşiv + kapat.

## İlgili dokümanlar

- `docs/SINGLE-VERSION-POLICY.md` — tek web sürümü
- `docs/DEPLOY-DATA-POLICY.md` — deploy veriye dokunmaz
- `backups/archived-pr-branches-2026-10-12/` — kapatılan eski PR yedekleri
