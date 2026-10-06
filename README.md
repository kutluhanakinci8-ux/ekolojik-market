# Ekolojik Market POS

Ekolojik ve doğal ürün mağazaları için satış, stok, raporlama ve günlük kasa yönetimi.

**Bağımsız ürün** — kaynak kod artık [U88](https://github.com/harikaotoservisinfo-spec/U88) (Lerta/KVKK paneli) reposundan ayrıldı.

| | |
|---|---|
| **GitHub** | `harikaotoservisinfo-spec/ekolojik-market-pos` |
| **VPS kaynak** | `/var/www/ekolojik-market-pos` |
| **VPS çalışma** | `/var/www/market-pos` (PM2, port **5180**) |

## VPS kurulum

Sunucuda root olarak:

```bash
git clone --branch main https://github.com/harikaotoservisinfo-spec/ekolojik-market-pos.git /var/www/ekolojik-market-pos
bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
```

Tek komut (repo + deploy):

```bash
curl -fsSL https://raw.githubusercontent.com/harikaotoservisinfo-spec/ekolojik-market-pos/main/scripts/deploy-vps.sh | bash
```

Private repo için clone URL’ine GitHub token ekleyin.

### Güncelleme

```bash
bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
```

### GitHub Actions

Push `main` veya `workflow_dispatch` → **Ekolojik Market POS VPS Deploy** (VPS SSH secret’ları U88 ile aynı org secret’ları kullanılabilir).

### Paket (SFTP)

```bash
bash scripts/paket-olustur.sh
scp release/market-pos-kurulum.tar.gz root@SUNUCU:/root/
# sunucuda:
mkdir -p /var/www/market-pos && tar xzf /root/market-pos-kurulum.tar.gz -C /var/www/market-pos
bash /var/www/market-pos/kur.sh
```

## Yerel geliştirme

```bash
npm install
npm run dev
```

http://localhost:5180

## U88’den taşıma

Eski yol: `U88` repo → `market-pos/` klasörü. Yeni yol: yalnızca bu repo. Detay: [docs/MIGRATION-FROM-U88.md](docs/MIGRATION-FROM-U88.md).
