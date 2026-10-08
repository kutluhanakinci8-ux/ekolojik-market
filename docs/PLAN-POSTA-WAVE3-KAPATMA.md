# Wave 3 kapatma — main merge & prod

**Kapsam:** Faz 38–52 (PR zinciri `#23` … `#33`). **Hedef:** tek merge → `main` → VPS deploy → QA.

## 1. PR zinciri (sırayla review / merge)

Önerilen sıra (her biri bir öncekinin üstüne):

1. `#23` — Faz 38–42 (güvenlik, outbox, widget, kayıt, token)
2. `#24`–`#29` — Faz 43–48
3. `#30` — Faz 49 bot/SLA
4. `#31` — Faz 50 portal
5. `#32` — Faz 51 CI
6. `#33` — Faz 52 kapanış dokümanları

**Alternatif (tek PR):** `cursor/posta-wave3-merge-main-f967` → `main` (Faz 52 dalının tamamını içerir).

## 2. Yerel kapı (merge öncesi)

```bash
npm test
npm run build
bash scripts/sunucu-ekolojik-posta-wave3-kapat.sh /var/www/market-pos
```

Sunucu ayaktayken:

```bash
node scripts/pre-release-qa.mjs http://127.0.0.1:5180
```

## 3. main merge & push

```bash
bash scripts/ekolojik-posta-faz-kapat.sh "Wave 3 (Faz 38–52)" cursor/posta-wave3-merge-main-f967
```

Veya manuel:

```bash
git checkout main && git pull origin main
git merge --no-ff cursor/posta-wave3-merge-main-f967 -m "Merge Wave 3 — Posta & Mesaj %100"
git push origin main
```

## 4. VPS deploy

```bash
source /cursor/stores/self/ekolojik-vps-deploy.env   # veya VPS_SSH_KEY
BRANCH=main bash scripts/agent-deploy.sh
node scripts/pre-release-qa.mjs http://<VPS_HOST>:5180
bash scripts/sunucu-ekolojik-posta-tam-kabul.sh /var/www/market-pos
```

## 5. Kapanış kontrol listesi

- [x] `main` merge (#23–#33 + #34) — 2026-10-08
- [x] VPS deploy `main` + `pre-release-qa` 0 FAIL
- [x] `sunucu-ekolojik-posta-parite-dogrula.sh` — VPS mint / QA token (#35, 2026-10-08)
- [x] `docs/EKOLOJIK-POSTA-NB-KARSILASTIRMA-CHECKLIST.md` — tüm ✓
- [x] `docs/RAKIP-SKOR-KARTI.md` — %100
- [ ] GitHub Actions CI yeşil (`ci.yml`)
- [ ] Operatör UI yürüyüşü: `docs/EKOLOJIK-POSTA-NB-UI-YURUYUS.md` (~30 dk)

Posta smoke token: `scripts/lib/ekolojik-posta-qa-token.sh` — demo kullanıcılar, `EKOLOJIK_POS_QA_USER`/`PASSWORD`, `EKOLOJIK_POS_QA_TOKEN`, veya VPS’te `store.json` mint (`mint-posta-qa-token.mjs`).

*Wave 3 plan: `docs/PLAN-POSTA-MESAJ-100-PARITE.md` — tamamlandı.*
