# Greenleaf — masaüstü mimari

## Amaç

| | Ekolojik Market (bulut) | Greenleaf (bu repo) |
|---|-------------------------|---------------------|
| Çalışma | VPS + tarayıcı | Windows PC + yerel servis |
| Veri | Sunucu `data/` | `MARKET_POS_DATA_DIR` (ör. `./data`) |
| Güncelleme | VPS deploy | Ayrı desktop updater (planlanıyor) |

## Çalıştırma

1. `npm run greenleaf:dev` — build + `server.mjs` (port **5190**).
2. Veri: `data/store.json` oluşur.
3. İlk giriş: kayıt veya seed (geliştirme).

## Port

5190 seçildi; bulut kurulumlarında 5180 kullanılmaya devam eder — çakışma olmaz.

## Uzaktan güncelleme (yol haritası)

1. Siz `latest.json` + imzalı `Greenleaf-Setup-x64.exe` yayınlarsınız.
2. Kurulum yalnızca `Program Files\Greenleaf\` günceller; `ProgramData\Greenleaf\data\` dokunulmaz.

## Upstream

İşlev taşımak için ekolojik-market’ten **manuel** cherry-pick / kopya; otomatik senkron yok.
