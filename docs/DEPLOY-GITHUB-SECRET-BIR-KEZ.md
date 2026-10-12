# VPS deploy — GitHub secret (bir kez)

`main` push sonrası otomatik deploy için **Actions secret** gerekir. Agent veya sohbet şifresi **kaydetmez**; siz bir kez GitHub’a girersiniz, sonra tekrar sorulmaz.

## Adımlar

1. GitHub → **kutluhanakinci8-ux/ekolojik-market** → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret**
   - İsim: `VPS_SSH_PASS` (veya tercihen `VPS_SSH_KEY` — özel anahtar, daha güvenli)
   - Değer: VPS `root` SSH şifreniz veya private key içeriği
3. İsteğe bağlı: `VPS_SSH_HOST` = `168.231.109.27` (varsayılan zaten bu)
4. **Actions** → **Ekolojik Market POS VPS Deploy** → başarısız bir run → **Re-run all jobs**

## Doğrulama

```bash
curl -s https://www.ekolojikmarket.com.tr/app-release.json
```

`buildId` tarih/saat, son `main` deploy ile uyumlu olmalı.

## Elle deploy (secret yokken acil)

```bash
BRANCH=main VPS_SSH_PASS='…' bash scripts/agent-deploy.sh
```

Şifreyi repoya veya dokümana yazmayın.

## Güvenlik

- Root şifresini sohbet/e-postada paylaşmayın; paylaşıldıysa **VPS’te şifreyi değiştirin**.
- Uzun vadede `VPS_SSH_KEY` (ed25519) kullanın, şifre ile girişi kapatın.
