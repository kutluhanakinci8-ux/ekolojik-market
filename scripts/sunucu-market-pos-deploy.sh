#!/usr/bin/env bash
# Ekolojik Market POS — VPS güncelleme (bağımsız repo)
# Kullanım (root):
#   bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
#
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
BRANCH="${BRANCH:-main}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
APP_SRC="${REPO_ROOT}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
PORT="${PORT:-5180}"

echo "==> Ekolojik Market POS VPS güncelleme"
echo "    Repo   : ${REPO_ROOT}"
echo "    Branch : ${BRANCH}"
echo "    Hedef  : ${INSTALL_DIR}"

if [[ ! -d "${REPO_ROOT}/.git" ]]; then
  echo "HATA: ${REPO_ROOT}/.git bulunamadı."
  echo "Repo yoksa önce klonlayın:"
  echo "  git clone --branch ${BRANCH} https://github.com/kutluhanakinci8-ux/ekolojik-market.git ${REPO_ROOT}"
  echo "Veya paket kurulumu:"
  echo "  scp market-pos-kurulum.tar.gz root@SUNUCU:/root/"
  echo "  mkdir -p ${INSTALL_DIR} && tar xzf /root/market-pos-kurulum.tar.gz -C ${INSTALL_DIR}"
  echo "  bash ${INSTALL_DIR}/kur.sh"
  exit 1
fi

cd "${REPO_ROOT}"
echo "==> Git güncelleniyor (${GIT_REMOTE}/${BRANCH})..."
# npm build tsbuildinfo checkout'u bloklamasın (önce temizle)
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
git restore --staged --worktree tsconfig.tsbuildinfo 2>/dev/null || true
git fetch "${GIT_REMOTE}" "${BRANCH}"
if ! git checkout "${BRANCH}" 2>/dev/null; then
  git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
  git checkout -B "${BRANCH}" "${GIT_REMOTE}/${BRANCH}" || git reset --hard "${GIT_REMOTE}/${BRANCH}"
fi
git pull --ff-only "${GIT_REMOTE}" "${BRANCH}" || {
  echo "    pull ff-only başarısız — yerel build artığı temizleniyor..."
  git reset --hard "${GIT_REMOTE}/${BRANCH}"
}
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
echo "    Commit : $(git -C "${REPO_ROOT}" rev-parse --short HEAD) ($(git -C "${REPO_ROOT}" log -1 --format=%s))"

if [[ ! -f "${APP_SRC}/package.json" ]]; then
  echo "HATA: ${APP_SRC}/package.json bulunamadı — repo kökü doğru mu?"
  exit 1
fi

cd "${APP_SRC}"
echo "==> npm install..."
npm install
if [[ "${EKOLOJIK_SKIP_PLAYWRIGHT_INSTALL:-0}" != 1 ]]; then
  # NB görsel smoke (Playwright) repo kökünden çalışır; production INSTALL_DIR'de devDeps yok
  # shellcheck source=scripts/lib/ensure-playwright.sh
  source "${REPO_ROOT}/scripts/lib/ensure-playwright.sh"
  ensure_playwright "${REPO_ROOT}" || echo "    (Playwright kurulumu atlandı — görsel smoke WARN olabilir)"
fi
echo "==> Build..."
npm run build

echo "==> ${INSTALL_DIR} kuruluyor..."
mkdir -p "${INSTALL_DIR}/dist"
mkdir -p "${INSTALL_DIR}/data"
rm -rf "${INSTALL_DIR}/dist/"*
cp -a dist/. "${INSTALL_DIR}/dist/"
cp server.mjs ecosystem.config.cjs "${INSTALL_DIR}/"
mkdir -p "${INSTALL_DIR}/server"
rm -rf "${INSTALL_DIR}/server/"*
cp -a server/. "${INSTALL_DIR}/server/"
SERVER_MJS_COUNT="$(find "${INSTALL_DIR}/server" -maxdepth 1 -name '*.mjs' | wc -l | tr -d ' ')"
if [[ "${SERVER_MJS_COUNT}" -lt 1 ]]; then
  echo "HATA: server/*.mjs kopyalanamadı — sunucu başlamaz"
  exit 1
fi
for required in asatClient.mjs tenantAuth.mjs crmOutreach.mjs; do
  if [[ ! -f "${INSTALL_DIR}/server/${required}" ]]; then
    echo "HATA: server/${required} eksik — git güncel mi kontrol edin"
    exit 1
  fi
done
mkdir -p "${INSTALL_DIR}/scripts"
cp scripts/lima-raw-print-bridge.mjs "${INSTALL_DIR}/scripts/"
cp scripts/escposTurkish.mjs "${INSTALL_DIR}/scripts/"
cp scripts/win-raw-escpos.ps1 "${INSTALL_DIR}/scripts/" 2>/dev/null || true
cp scripts/sunucu-kur.sh "${INSTALL_DIR}/kur.sh"
cp scripts/ensure-greenleaf-credentials.mjs "${INSTALL_DIR}/scripts/"
cp scripts/ensure-platform-operator.mjs "${INSTALL_DIR}/scripts/"
chmod +x "${INSTALL_DIR}/kur.sh"
if [[ -f .env.example ]] && [[ ! -f "${INSTALL_DIR}/.env" ]]; then
  cp .env.example "${INSTALL_DIR}/.env"
  chmod 600 "${INSTALL_DIR}/.env"
  grep -q '^LERTA_PLATFORM_BRIDGE=' "${INSTALL_DIR}/.env" 2>/dev/null || echo 'LERTA_PLATFORM_BRIDGE=0' >> "${INSTALL_DIR}/.env"
  echo "    .env oluşturuldu — EKOLOJIK_* değerlerini düzenleyin"
fi
if [[ -d extension ]]; then
  mkdir -p "${INSTALL_DIR}/extension"
  cp -a extension/. "${INSTALL_DIR}/extension/"
fi

echo "==> Production bağımlılıkları (${INSTALL_DIR})..."
cp package.json package-lock.json "${INSTALL_DIR}/"
cd "${INSTALL_DIR}"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev --no-audit --no-fund
else
  npm install --omit=dev --no-audit --no-fund
fi
node -e "import('nodemailer').then(() => console.log('    nodemailer OK'))"
node -e "import('imapflow').then(() => console.log('    imapflow OK'))"

echo "==> Sunucu modül kontrolü..."
node --check "${INSTALL_DIR}/server.mjs"

export PORT

echo "==> Canlı data yedeği (deploy veri dokunmaz politikası)..."
bash "${REPO_ROOT}/scripts/backup-market-pos-data.sh" "${INSTALL_DIR}/data"

bash "${INSTALL_DIR}/kur.sh"

echo "==> Sabit perakende fiyat düzeltmeleri (store.json)..."
MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${APP_SRC}/scripts/apply-product-price-overrides.mjs" "${INSTALL_DIR}/data" || true

echo "==> Partner fiyatı = perakende / 2 (tüm ürünler)..."
MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${APP_SRC}/scripts/apply-partner-half-retail.mjs" "${INSTALL_DIR}/data" || true

echo "==> Fiş satışları ödeme düzeltmesi (kart→nakit, idempotent)..."
MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${APP_SRC}/scripts/fix-receipt-sales-payment-cash.mjs" "${INSTALL_DIR}/data" || true

echo "==> KLA128 tekli sanal stok (KLA128T, stok = paket × 10)..."
MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${APP_SRC}/scripts/sync-kla128-unit-virtual-stock.mjs" "${INSTALL_DIR}/data" || true

echo "==> Mağaza sahibi tam yetki (kutluhan*)..."
MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${APP_SRC}/scripts/ensure-owner-admin-on-server.mjs" || true

if [[ -f "${INSTALL_DIR}/.env" ]]; then
  while IFS= read -r line; do
    case "$line" in
      GREENLEAF_*=*)
        key="${line%%=*}"
        val="${line#*=}"
        export "${key}=${val}"
        ;;
    esac
  done < "${INSTALL_DIR}/.env"
fi
if [[ -n "${GREENLEAF_OWNER_PASSWORD:-}" ]]; then
  echo "==> Platform operatörü (kutluhan08) — vault _platform..."
  GREENLEAF_OWNER_PASSWORD="${GREENLEAF_OWNER_PASSWORD}" \
    GREENLEAF_OWNER_RECOVERY_EMAIL="${GREENLEAF_OWNER_RECOVERY_EMAIL:-}" \
    node "${INSTALL_DIR}/scripts/ensure-platform-operator.mjs" --data-dir "${INSTALL_DIR}/data" || true
  echo "==> Kimlik kasası Greenleaf demo kullanıcıları (yonetici/kasiyer)..."
  node "${INSTALL_DIR}/scripts/ensure-greenleaf-credentials.mjs" --data-dir "${INSTALL_DIR}/data" || true
else
  echo "==> Platform operatörü atlandı (.env içinde GREENLEAF_OWNER_PASSWORD tanımlayın)"
fi

if [[ "${EKOLOJIK_DEPLOY_DATA_MIGRATIONS:-0}" == "1" ]]; then
  echo "==> Veri migrasyonları (EKOLOJIK_DEPLOY_DATA_MIGRATIONS=1)..."
  node "${APP_SRC}/scripts/apply-irsaliye-stock.mjs" "${INSTALL_DIR}/data" || echo "    (irsaliye atlandı)"
  node "${APP_SRC}/scripts/migrate-posta-onboarding.mjs" "${INSTALL_DIR}/data" || echo "    (posta onboarding atlandı)"
else
  echo "==> Veri migrasyonları atlandı (canlı data korunur). Zorunluysa: EKOLOJIK_DEPLOY_DATA_MIGRATIONS=1"
fi

echo "==> Build doğrulama..."
VERIFY_TMP="$(mktemp)"
trap 'rm -f "${VERIFY_TMP}" "${VERIFY_TMP}.js"' EXIT

CURL_OK=0
for attempt in $(seq 1 20); do
  if curl -fsS --connect-timeout 2 "http://127.0.0.1:${PORT}/" -o "${VERIFY_TMP}" 2>/dev/null; then
    CURL_OK=1
    break
  fi
  if [[ "${attempt}" -eq 1 ]]; then
    echo "    Port ${PORT} henüz hazır değil, bekleniyor..."
  fi
  sleep 1
done
if [[ "${CURL_OK}" -ne 1 ]]; then
  echo "HATA: http://127.0.0.1:${PORT}/ yanıt vermiyor (20 sn sonra)"
  if command -v pm2 >/dev/null 2>&1; then
    pm2 status market-pos 2>/dev/null || true
    echo "---- pm2 logs market-pos (son 40 satır) ----"
    pm2 logs market-pos --nostream --lines 40 2>/dev/null || true
  fi
  exit 1
fi
JS_FILE=$(grep -oE 'assets/index-[^"]+\.js' "${VERIFY_TMP}" | head -1)
if [[ -z "${JS_FILE}" ]]; then
  echo "HATA: index.html içinde JS bundle bulunamadı"
  exit 1
fi

curl -fsS "http://127.0.0.1:${PORT}/${JS_FILE}" -o "${VERIFY_TMP}.js"
if grep -q 'Kayıt öncesi borç' "${VERIFY_TMP}.js"; then
  echo "HATA: Eski fiş önizleme metinleri yüklü — git pull ve npm run build sonrası tekrar deploy edin."
  echo "      Beklenen branch: ${BRANCH}"
  exit 1
fi
if grep -q 'voucher-recent-item--premium' "${VERIFY_TMP}.js"; then
  echo "✓ Fiş girişi UI güncel (${JS_FILE})"
elif grep -q 'Ön Muhasebe' "${VERIFY_TMP}.js" && grep -q 'sale-return' "${VERIFY_TMP}.js"; then
  echo "✓ Güncel build aktif (${JS_FILE}) — Muhasebe modülü dahil"
elif grep -q 'sale-return' "${VERIFY_TMP}.js"; then
  echo "✓ Build aktif (${JS_FILE})"
else
  echo "HATA: Eski build yüklü görünüyor."
  echo "      pm2 restart market-pos"
  echo "      tarayıcıda Ctrl+Shift+R (önbellek temizle)"
  exit 1
fi

if curl -fsS "http://127.0.0.1:${PORT}/app-release.json" 2>/dev/null | tee "${VERIFY_TMP}.release" | grep -q buildId; then
  echo "✓ Tek web sürümü (Mac=Windows): $(tr -d '\n' < "${VERIFY_TMP}.release")"
else
  echo "UYARI: app-release.json okunamadı — istemci sürüm senkronu çalışmayabilir"
fi

echo "==> Lima ham fiş köprüsü (sessiz termal, pm2 ecosystem)..."
if command -v pm2 >/dev/null 2>&1; then
  cp -f "${REPO_ROOT}/ecosystem.config.cjs" "${INSTALL_DIR}/ecosystem.config.cjs"
  (cd "${INSTALL_DIR}" && POS80_QUEUE_NAME="${POS80_QUEUE_NAME:-Printer_POS_80C}" pm2 start ecosystem.config.cjs --only lima-receipt-bridge --update-env) \
    || echo "    UYARI: lima-receipt-bridge başlatılamadı"
  pm2 save 2>/dev/null || true
else
  echo "    pm2 yok — köprü market-pos ile otomatik başlar (RECEIPT_BRIDGE_AUTOSTART)"
fi

echo "Not: Mali yazıcı köprüsü (inpos-bridge) VPS'te çalışmaz."
echo "     Kasa USB yazıcı (Windows): ${REPO_ROOT}/scripts/start-lima-receipt-bridge.bat"

if [[ "${EKOLOJIK_SKIP_POST_DEPLOY_VERIFY:-0}" != "1" ]]; then
  echo ""
  echo "==> Posta prod doğrulama (uyarı modu)..."
  export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
  export EKOLOJIK_VERIFY_BASE_URL="http://127.0.0.1:${PORT}"
  if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-prod-kapat.sh" "${INSTALL_DIR}"; then
    echo "✓ Posta prod kapatma doğrulaması geçti"
  else
    echo "UYARI: Posta prod doğrulama eksik — Faz 6 SMTP/DNS ve docs/EKOLOJIK-POSTA-PROD-KAPATMA.md"
    if [[ "${EKOLOJIK_POST_DEPLOY_VERIFY_STRICT:-0}" == "1" ]]; then
      exit 1
    fi
  fi
  if [[ "$(id -u)" == "0" ]]; then
    bash "${REPO_ROOT}/scripts/sunucu-ekolojik-outbox-failed-cron-kur.sh" || true
    bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-inbox-sync-cron-kur.sh" || true
    bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-sla-apology-cron-kur.sh" || true
    if [[ "${EKOLOJIK_AUTO_DESTEK_MAILBOX:-0}" == "1" ]] && [[ -x "${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh" ]]; then
      if ! bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-smtp-recipient-dogrula.sh" "${INSTALL_DIR}" 2>/dev/null; then
        echo "==> destek@ Postfix kutusu otomatik kurulum (--apply)..."
        bash "${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh" --apply || \
          echo "UYARI: destek-mailbox --apply başarısız"
      fi
    fi
    if [[ -x "${REPO_ROOT}/scripts/sunucu-ekolojik-support-imap-dogrula.sh" ]]; then
      bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-imap-dogrula.sh" "${INSTALL_DIR}" || \
        echo "UYARI: destek@ IMAP — bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
    fi
    bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-smtp-recipient-dogrula.sh" "${INSTALL_DIR}" || \
      echo "UYARI: destek@ SMTP alıcı — bash ${REPO_ROOT}/scripts/sunucu-ekolojik-destek-mailbox.sh --apply"
    if [[ "${EKOLOJIK_ENABLE_CONTACT_AUTOREPLY:-0}" == "1" ]] && [[ -f "${INSTALL_DIR}/.env" ]]; then
      if ! grep -q '^EKOLOJIK_CONTACT_AUTOREPLY=' "${INSTALL_DIR}/.env" 2>/dev/null; then
        echo 'EKOLOJIK_CONTACT_AUTOREPLY=1' >> "${INSTALL_DIR}/.env"
        echo "    EKOLOJIK_CONTACT_AUTOREPLY=1 eklendi (.env)"
      fi
    fi
  fi
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-smtp-ops-recipient-dogrula.sh" "${INSTALL_DIR}" || \
    echo "UYARI: ops SMTP alıcı — bash ${REPO_ROOT}/scripts/sunucu-ekolojik-imap-vps-alias-fix.sh"
  if [[ "${EKOLOJIK_POST_DEPLOY_OUTBOX_PROCESS:-0}" == "1" ]] && [[ -d "${INSTALL_DIR}/data" ]]; then
    echo "==> Outbox işleme (post-deploy)..."
    MARKET_POS_DATA_DIR="${INSTALL_DIR}/data" node "${REPO_ROOT}/scripts/ops-outbox-health.mjs" --process || true
  fi
fi
