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

## GitHub kimlik doğrulama (private repo)

GitHub artık şifre ile HTTPS clone kabul etmez. **Personal Access Token (PAT)** gerekir.

1. GitHub → Settings → Developer settings → Personal access tokens
2. Repo erişimi olan token oluşturun (`repo` scope)
3. Sunucuda (token’ı kimseye göstermeyin):

```bash
# Önce boş repo oluşturun: github.com → New → ekolojik-market-pos

export GITHUB_TOKEN='ghp_xxxxxxxx'   # kendi tokenınız

git clone --branch cursor/ekolojikmarket-standalone-94bd \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/harikaotoservisinfo-spec/U88.git" \
  /tmp/ekolojik-export

cd /tmp/ekolojik-export
bash scripts/mirror-to-new-github-repo.sh harikaotoservisinfo-spec/ekolojik-market-pos
```

**SSH** kullanıyorsanız (`~/.ssh` anahtarı GitHub’da kayıtlı):

```bash
git clone --branch cursor/ekolojikmarket-standalone-94bd \
  git@github.com:harikaotoservisinfo-spec/U88.git /tmp/ekolojik-export
```

Klon sırasında `Username for 'https://github.com':` çıkarsa: **Ctrl+C**, yukarıdaki token’lı URL veya SSH kullanın.

### VPS — sadece uygulama çalıştırma (mirror şart değil)

Bağımsız repo hazırsa:

```bash
export GITHUB_TOKEN='ghp_...'
git clone --branch main \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/harikaotoservisinfo-spec/ekolojik-market-pos.git" \
  /var/www/ekolojik-market-pos
bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
```

Mirror yapmadan geçici olarak U88 branch’inden de deploy edebilirsiniz (repo hâlâ U88 adıyla klonlanır, içerik standalone branch’tir):

```bash
git clone --branch cursor/ekolojikmarket-standalone-94bd \
  "https://x-access-token:${GITHUB_TOKEN}@github.com/harikaotoservisinfo-spec/U88.git" \
  /var/www/ekolojik-market-pos
bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
```
