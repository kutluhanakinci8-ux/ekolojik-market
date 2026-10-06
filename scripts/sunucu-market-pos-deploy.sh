#!/usr/bin/env bash
# Ekolojik Market POS — VPS güncelleme (bağımsız repo)
# Kullanım (root):
#   bash /var/www/ekolojik-market-pos/scripts/sunucu-market-pos-deploy.sh
#
set -euo pipefail

REPO_ROOT="${REPO_ROOT:-/var/www/ekolojik-market-pos}"
BRANCH="${BRANCH:-main}"
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
  echo "  git clone --branch ${BRANCH} https://github.com/harikaotoservisinfo-spec/ekolojik-market-pos.git ${REPO_ROOT}"
  echo "Veya paket kurulumu:"
  echo "  scp market-pos-kurulum.tar.gz root@SUNUCU:/root/"
  echo "  mkdir -p ${INSTALL_DIR} && tar xzf /root/market-pos-kurulum.tar.gz -C ${INSTALL_DIR}"
  echo "  bash ${INSTALL_DIR}/kur.sh"
  exit 1
fi

cd "${REPO_ROOT}"
echo "==> Git güncelleniyor..."
git fetch origin "${BRANCH}"
git checkout "${BRANCH}" 2>/dev/null || git checkout -B "${BRANCH}" "origin/${BRANCH}"
# npm build tsbuildinfo dosyası pull'u bloklamasın
git checkout -- tsconfig.tsbuildinfo 2>/dev/null || true
git pull --ff-only origin "${BRANCH}" || {
  echo "    pull ff-only başarısız — yerel build artığı temizleniyor..."
  git reset --hard "origin/${BRANCH}"
}
echo "    Commit : $(git -C "${REPO_ROOT}" rev-parse --short HEAD) ($(git -C "${REPO_ROOT}" log -1 --format=%s))"

if [[ ! -f "${APP_SRC}/package.json" ]]; then
  echo "HATA: ${APP_SRC}/package.json bulunamadı — repo kökü doğru mu?"
  exit 1
fi

cd "${APP_SRC}"
echo "==> npm install..."
npm install
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
cp scripts/sunucu-kur.sh "${INSTALL_DIR}/kur.sh"
chmod +x "${INSTALL_DIR}/kur.sh"
if [[ -d extension ]]; then
  mkdir -p "${INSTALL_DIR}/extension"
  cp -a extension/. "${INSTALL_DIR}/extension/"
fi

echo "==> Sunucu modül kontrolü..."
node --check "${INSTALL_DIR}/server.mjs"

export PORT
bash "${INSTALL_DIR}/kur.sh"

echo "==> Sunucu verisi: irsaliye stokları..."
node "${APP_SRC}/scripts/apply-irsaliye-stock.mjs" "${INSTALL_DIR}/data" || echo "    (veri migrasyonu atlandı — data/ henüz yok olabilir)"

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

echo ""
echo "Not: Mali yazıcı köprüsü (inpos-bridge) VPS'te çalışmaz."
echo "     Kasa bilgisayarında (Windows): ${APP_SRC}/inpos-bridge"
echo "     cd inpos-bridge && npm install && npm start"
