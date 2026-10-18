# GitHub — `greenleaf` repo ilk kurulum

Cursor bot hesabı sizin adınıza repo oluşturamaz; bir kez sizin tıklamanız gerekir.

## 1) GitHub’da repo oluştur

1. Sağ üst **+** → **New repository**
2. **Repository name:** `greenleaf`
3. **Owner:** `kutluhanakinci8-ux`
4. **Private** (önerilir)
5. **Add a README** işaretini **kapatın** (boş repo)
6. **Create repository**

## 2) Bu makineden ilk push

Greenleaf dosyaları hazırlandıysa:

```bash
cd /path/to/greenleaf
git init -b main
git add .
git commit -m "Initial Greenleaf POS — desktop fork baseline"
git remote add origin https://github.com/kutluhanakinci8-ux/greenleaf.git
git push -u origin main
```

## 3) Cursor’da açma

- **File → Open Folder** → klonlanan `greenleaf` klasörü
- veya Cloud Agent’ı **greenleaf** repo’suna bağlayın

## 4) Ekolojik-market ile karışmaması için

- Ayrı klasör, ayrı `git remote`
- VPS deploy scriptleri bu repoda **zorunlu değil**; kullanmayın
