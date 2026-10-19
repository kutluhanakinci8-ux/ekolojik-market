# Greenleaf — Mac’te GitHub’a push

## Kimlik (Username / Password istemcisi)

GitHub **hesap şifrenizi** yazmayın.

| Alan | Ne yazılır |
|------|------------|
| **Username** | `kutluhanakinci8-ux` |
| **Password** | Fine-grained **PAT** (`github_pat_...` veya `ghp_...`) — repo **greenleaf** için **Contents: Read and write** |

Tek seferlik (terminalde PAT’i siz yapıştırın, sohbete yazmayın):

```bash
export GH_TOKEN='github_pat_BURAYA'
git remote set-url origin "https://kutluhanakinci8-ux:${GH_TOKEN}@github.com/kutluhanakinci8-ux/greenleaf.git"
```

## “No tracking information” hatası

```bash
cd ~/greenleaf
git fetch origin
git branch -M main
git push -u origin main
```

`git pull` tek başına yeterli değil; önce `git fetch`, sonra `git push -u origin main`.

## Temizlenmiş kod henüz Mac’te yoksa (sadece eski `efabfac` görüyorsanız)

Bu repodaki bundle dosyasını indirin:

`delivery/greenleaf-standalone.bundle` (ekolojik-market dalından)

Mac’te:

```bash
cd ~/greenleaf
# Bundle’ı indirin (ekolojik-market → delivery/greenleaf-standalone.bundle)
BUNDLE="$HOME/Downloads/greenleaf-standalone.bundle"
git pull "$BUNDLE" main
git push -u origin main
```

Bundle içindeki commit: `6ce7bd1` (marka temizliği + Lima dosya adları).

Doğrulama:

```bash
git log -1 --oneline
# 6ce7bd1 chore: remove Lima/legacy tenant naming...
rg -i 'ekolojik|kutluhan' || echo 'temiz'
```
