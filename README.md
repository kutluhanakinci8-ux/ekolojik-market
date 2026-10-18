# Greenleaf POS

**Windows yerel mağaza programı** — satış, stok, kasa ve raporlar; veri **kurulum yapılan PC’de** tutulur.

Bu depo, [ekolojik-market](https://github.com/kutluhanakinci8-ux/ekolojik-market) bulut POS’undan **bağımsız** bir üründür. Sunucu tarafı geliştirme ve canlı ortam orada devam eder; **bu repoya ekolojik-market için zorunlu commit atılmaz**.

## Hızlı başlangıç (geliştirme)

```bash
npm install
cp .env.greenleaf.example .env
npm run greenleaf:dev
```

Tarayıcı: **http://127.0.0.1:5190/app**

Veri klasörü (varsayılan): `./data/` (git’e girmez).

## Windows

- Fiş: `public/install/windows/ekolojik-zywell-setup.ps1` (Zywell köprüsü)
- Detay: [docs/GREENLEAF-DESKTOP.md](docs/GREENLEAF-DESKTOP.md)

## Repo’yu GitHub’a bağlama

İlk kez: [docs/GITHUB-ILK-KURULUM.md](docs/GITHUB-ILK-KURULUM.md)

## Sürüm

`package.json` → `version` · derleme kimliği `dist/app-release.json`
