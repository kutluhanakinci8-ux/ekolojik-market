# Kırılma testi giderim planı (Faz 38+ sonrası)

**Amaç:** Kırılma raporundaki dört sarı/kırmızı alanı kapatmak — önce **neden geçmedi**, sonra **kod / ops** ayrımı.

| # | Bulgu | Neden geçmedi? | Tür |
|---|--------|----------------|-----|
| 1 | Wave 3 operatör — Playwright atlandı | VPS’te `playwright` paketi veya Chromium binary yok; `ensure-playwright` sessiz kalabiliyor | **Kod + deploy** |
| 2 | DNS mail uyarı | SPF/DMARC/DKIM TXT kayıtları domain panelinde tanımlı değil — uygulama kodu DNS yazamaz | **Ops** (+ kod: öneri scripti) |
| 3 | Faz 15–34 / NB-gap / Faz 22 | Shell scriptleri anonim `curl`; Faz 38’den sonra `/api/posta/*` → **401** (doğru) | **Kod** (script auth) |
| 4 | npm audit high | `nodemailer@6.9` CVE’ler; `@iamtraction/google-translate` → `undici`/`busboy` (yalnızca çeviri scripti) | **Kod** (sürüm / devDeps) |

---

## Faz 1 — Playwright (operatör kapısı UI)

**Hedef:** `sunucu-ekolojik-posta-wave3-operator-kapi.sh` görsel smoke **WARN olmadan** geçsin.

| Adım | İş |
|------|-----|
| 1.1 | `ensure-playwright.sh`: `PLAYWRIGHT_BROWSERS_PATH` repo altında; `npm install playwright`; `install chromium` + root ise `install-deps` |
| 1.2 | Kurulum sonrası import doğrulama; başarısızsa açık `HATA` (WARN gizlenmesin) |
| 1.3 | Deploy: `sunucu-market-pos-deploy.sh` zaten ensure çağırıyor — log doğrulama |

**Kabul:** VPS’te `posta-nb-ui-visual-smoke.mjs` tam koşar.

---

## Faz 2 — Doğrulama scriptleri (Faz 38 Bearer)

**Hedef:** `sunucu-ekolojik-posta-faz*-dogrula.sh`, `nb-gap`, `imap-klasor`, `faz22-e2e` token ile 200.

| Adım | İş |
|------|-----|
| 2.1 | `scripts/lib/ekolojik-posta-smoke-auth.sh` — `ekolojik_posta_smoke_auth_init`, `posta_curl`, SSE URL helper |
| 2.2 | Tüm faz doğrulama scriptlerinde anonim `curl` → `posta_curl` |
| 2.3 | `faz22-dogrula.sh`: `EKOLOJIK_VERIFY_ROOT` = runtime `data` (mint token) |
| 2.4 | `faz21`: hub’da `posta-hub-hotkeys-hint` UI veya CSS bundle grep |

**Kabul:** `bash scripts/sunucu-ekolojik-posta-faz22-dogrula.sh /var/www/market-pos` FAIL=0 (parite hariç tekrarlar sadeleştirilebilir).

---

## Faz 3 — DNS teslimat (ops + yardımcı kod)

**Hedef:** `sunucu-ekolojik-dns-mail-dogrula.sh` strict=1’de geçebilir (panelde kayıt açıldıktan sonra).

| Adım | İş | Sahip |
|------|-----|--------|
| 3.1 | `scripts/sunucu-ekolojik-dns-txt-onerileri.sh` — önerilen SPF/DMARC/DKIM satırları (VPS IP, From domain) | Kod |
| 3.2 | İsimtescil / Cloudflare’de TXT ekleme | Ops |
| 3.3 | `EKOLOJIK_DNS_STRICT=1` haftalık cron (isteğe bağlı) | Ops |

**Not:** Bu faz **kod merge ile yeşil olmaz**; TXT yayılımı sonrası doğrulanır.

---

## Faz 4 — Bağımlılık güvenliği

| Adım | İş |
|------|-----|
| 4.1 | `nodemailer` → `^7.0.0` veya `^10.0.0` (API uyumluluk testi: SMTP send + outbox processor) |
| 4.2 | `@iamtraction/google-translate` yalnızca `devDependencies`; prod `npm ci --omit=dev` audit yüzeyini küçült |
| 4.3 | `npm audit --omit=dev` CI notu (translate scripti dev ortamında) |

**Kabul:** `npm test` + `test:ci` + VPS pre-release QA yeşil.

---

## Uygulama sırası (bu repo)

1. **Faz 2** (script auth) — yanlış kırmızı alarmı hemen kaldırır  
2. **Faz 1** (Playwright) — operatör kapısı tam  
3. **Faz 4** (npm) — güvenlik  
4. **Faz 3** (DNS TXT) — operatör + öneri scripti; panel işi sizde  

## Uygulama durumu (2026-10-09)

| Faz | main merge | VPS deploy | Kabul |
|-----|------------|------------|--------|
| 1 Playwright | `ba0b773` + `0957f7f` (1b cwd) | ✓ | Görsel smoke geçti |
| 2 Script auth | `82369fc` + `b0474bd` (2b faz21) | ✓ | nb-gap, faz15/21, imap-klasor OK |
| 3 DNS öneri | `53dc4f2` | ✓ | `dns-txt-onerileri.sh`; strict DNS **panel** bekliyor |
| 4 npm | `2f6c8e7` | ✓ | `nodemailer@10.0.16` (prod) |

*Son güncelleme: kırılma değerlendirme 2026-10-09.*
