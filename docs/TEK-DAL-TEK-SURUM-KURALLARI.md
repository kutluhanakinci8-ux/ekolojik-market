# Tek dal · tek sürüm · tek canlı — işletme kuralları

Bu belge **ekolojik-market** için bağlayıcı geliştirme ve yayın kuralıdır. Kod yazmaya veya agent çalıştırmaya başlamadan önce bu akış geçerlidir.

## 1. Altın kural

| Ne | Nerede | Kim görür |
|----|--------|-----------|
| **Program kodu** (POS, sunucu `server.mjs`, UI) | **GitHub → `main`** | Tüm kullanıcılar aynı web build |
| **Mağaza verisi** (stok, satış, fotoğraf, kullanıcılar) | **VPS disk** (`/var/www/market-pos/data`) | Mağaza / tenant bazlı; GitHub’da **canlı veri yok** |

**Canlıda “eski program sürümü” kasıtlı olarak tutulmaz.** Tek adres, tek build: `https://www.ekolojikmarket.com.tr/app`.

## 2. Tek dal: `main`

1. Üretim hattı yalnızca **`main`** dalıdır.
2. Yapılan her değişiklik **aynı gün** `main`’e girer (merge veya doğrudan push).
3. **`main`’e giren her commit** → GitHub Actions **`deploy-vps.yml`** → VPS’te `git pull` + `npm run build` + servis yenileme.
4. Açık PR / uzun ömürlü `cursor/*` dalı **bırakılmaz**: merge veya arşiv + kapat; canlıyı sürekli feature dalından çalıştırmayız.
5. Geçici dallar (`cursor/<iş>-b923`) yalnızca kısa PR için; iş bitince **silinir / merge edilir**, kod yalnızca `main`’de kalır.

```
Geliştirme (Agent / yerel)
    → commit
    → merge / push → main
    → GitHub Actions deploy
    → www.../app (yeni buildId)
    → tüm cihazlar (önbellek temizliği ile) aynı sürüm
```

## 3. “Yeni versiyon” ne demek?

| Kavram | Kaynak | Ne zaman değişir |
|--------|--------|------------------|
| **Sürüm numarası** | `package.json` → `version` (ör. `1.0.1`) | Anlamlı yayınlarda (özellik / düzeltme paketi) manuel artırılır |
| **Build kimliği** | `dist/app-release.json` → `buildId` | **Her** `main` deploy’unda otomatik (tarih/saat) |
| **Kullanıcıya görünen** | Ayarlar → Sistem → **Uygulama (canlı)** | `version · buildId` — tüm kasalarda aynı olmalı |

`main`’e merge = “bu artık tek doğru program”; önceki build kasıtlı desteklenmez (tarayıcı `app-release.json` ile yeniler).

## 4. Değişiklik sunucuda mı, GitHub’da mı?

### Program (kod)

| Yapılır | Yapılmaz |
|---------|----------|
| Kodu GitHub’da değiştir → `main` → otomatik deploy | VPS’te `nano server.mjs` / `dist` elle düzenleme (kalıcı çözüm değil) |
| Acil sunucu düzeltmesi yapıldıysa **aynı gün** `main`’e commit | Sadece sunucuda kalan “gizli” patch |

**Kaynak doğruluk:** GitHub `main`. VPS, `main`’in derlenmiş kopyasıdır.

### Veri (stok, satış, ayarlar)

| Yapılır | Yapılmaz |
|---------|----------|
| POS / API ile sunucu `data/` güncelleme | Canlı `store.json`’u repoya commit |
| Deploy öncesi `data-backups/*.tar.gz` | Deploy’un `data/` üzerine yazması (`DEPLOY-DATA-POLICY.md`) |

Detay: `docs/DEPLOY-DATA-POLICY.md`, `docs/TENANT-AUTO-SAVE-POLICY.md`.

## 5. Tek sürüm — tüm kullanıcılar

1. **Tek URL:** `https://www.ekolojikmarket.com.tr/app` (Mac = Windows = tarayıcı).
2. **`www` zorunlu** — apex veya `www` olmayan adres ayrı `localStorage` açar; kullanılmaz.
3. **Mac/Windows ayrı POS paketi yok**; yazıcı köprüsü yerel yardımcıdır, sürüm değildir (`SINGLE-VERSION-POLICY.md`).
4. **Çok kiracı:** Greenleaf `main` tenant; Lima `lima-market` — aynı program, farklı sunucu veri dosyası.

## 6. PR ve agent iş akışı

1. Değişiklik yap → test (`npm test`) → push.
2. PR açıldıysa **draft’ta bekletilmez**; hazır olunca merge → `main`.
3. Merge sonrası deploy’u doğrula:  
   `curl -s https://www.ekolojikmarket.com.tr/app-release.json`
4. Eski feature dalı: merge sonrası silinebilir (opsiyonel `git push origin --delete cursor/...`).

## 7. Kontrol listesi (her yayın)

- [ ] Değişiklik **`main`**’de
- [ ] GitHub Actions deploy **yeşil**
- [ ] `app-release.json` buildId güncel
- [ ] Ayarlar’da canlı sürüm satırı tüm cihazlarda uyumlu
- [ ] Mağaza verisi deploy ile **silinmedi** (yedek politikası)

## 8. İlgili belgeler

- `docs/SINGLE-VERSION-POLICY.md` — tek web uygulaması
- `docs/MAIN-GELISTIRME.md` — kısa özet (kutluhan)
- `docs/DEPLOY-DATA-POLICY.md` — deploy veriye dokunmaz
- `docs/MULTI-TENANT-AUDIT-2026-10-12.md` — kiracı güvenliği

**Son güncelleme:** 2026-10-12
