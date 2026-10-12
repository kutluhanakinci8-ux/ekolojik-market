# Geliştirme — yalnızca `main` (tek program)

> **Bağlayıcı kurallar:** `docs/TEK-DAL-TEK-SURUM-KURALLARI.md`

## Kutluhan için özet

1. **Program:** Herkes `https://www.ekolojikmarket.com.tr/app` — Mac = Windows, ayrı sürüm yok.
2. **Kod:** Tek hat **`main`**. Değişiklik `main`’e girer → otomatik VPS deploy (`deploy-vps.yml`). Eski build kasıtlı tutulmaz.
3. **Veri:** Sunucu (`/var/www/market-pos/data`), **GitHub’da değil**. Greenleaf: `kutluhan08`. Lima: mağaza kodu `lima-market`.

## Kod vs veri (tek cümle)

- **GitHub `main`** = programın kaynağı → deploy → herkes aynı sürüm.
- **VPS `data/`** = mağaza stok/satış/fotoğraf → deploy bunu **ezmez**.

## Akış

```
Değişiklik → main (merge) → GitHub Actions → VPS build → app-release.json güncellenir
```

Geçici `cursor/*-b923` dalları kısa ömürlü; iş bitince **main’de birleşir**, açık dal/PR bırakılmaz.

## Yapılmaz

- Canlıyı sürekli `cursor/...` dalından çalıştırmak.
- VPS’te kalıcı kod düzenleyip GitHub’a taşımamak.
- `www` olmayan adres veya eski zip kopyasından POS.
- Açık PR’ları süresiz bekletmek.

## İlgili

- `docs/TEK-DAL-TEK-SURUM-KURALLARI.md`
- `docs/SINGLE-VERSION-POLICY.md`
- `docs/DEPLOY-DATA-POLICY.md`
