# U88 monorepo’dan taşıma

Ekolojik Market POS kodu eskiden `harikaotoservisinfo-spec/U88` içinde `market-pos/` altındaydı. Artık **yalnızca** `ekolojik-market-pos` reposunda geliştirilir.

## VPS

1. Yeni repo klonu (bir kez):

   ```bash
   git clone --branch main https://github.com/harikaotoservisinfo-spec/ekolojik-market-pos.git /var/www/ekolojik-market-pos
   ```

2. Deploy betiği artık U88’e ihtiyaç duymaz:

   ```bash
   bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
   ```

3. Çalışan uygulama dizini değişmedi: `/var/www/market-pos`, port `5180`, PM2 adı `market-pos`.

4. İsteğe bağlı: `/var/www/u88/market-pos` artık kullanılmıyorsa silmeyin önce yedek alın; U88 (Lerta) paneli `/var/www/u88` altında ayrı kalır.

## GitHub Actions

U88’deki `Market POS VPS Deploy` workflow’unu devre dışı bırakın veya `market-pos/**` push’larını durdurun. Deploy bu repodaki `.github/workflows/deploy.yml` üzerinden yapılır.

## Geliştirme branch’leri

Eski dallar (ör. `cursor/ekolojikmarket-landing-b21c`) U88’de kalabilir; yeni iş **bu repo** `main` veya `cursor/*` branch’lerinde yapılır.
