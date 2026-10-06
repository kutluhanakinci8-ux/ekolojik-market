#!/usr/bin/env bash
# Sıra 5 — DNS panel kayıtları + isteğe bağlı OpenDKIM + dig doğrulama
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-ekolojikmarket.com.tr}"
SELECTOR="${EKOLOJIK_DKIM_SELECTOR:-ekolojik}"
VPS_IP="${EKOLOJIK_VPS_PUBLIC_IP:-168.231.109.27}"

echo "=== Ekolojik DNS kabul (sıra 5) ==="
echo ""

echo "--- Registrar / DNS panel — kopyala-yapıştır ---"
echo "@ TXT     v=spf1 ip4:${VPS_IP} a mx ~all"
echo "_dmarc TXT  v=DMARC1; p=none; rua=mailto:info@${DOMAIN}"
echo ""

if [[ -f "/etc/opendkim/keys/${DOMAIN}/${SELECTOR}.txt" ]]; then
  echo "--- Mevcut DKIM (${SELECTOR}) ---"
  sed 's/^/  /' "/etc/opendkim/keys/${DOMAIN}/${SELECTOR}.txt"
  echo ""
elif [[ "$(id -u)" == "0" && "${EKOLOJIK_DKIM_APPLY:-0}" == "1" ]]; then
  echo "--- OpenDKIM kurulum (EKOLOJIK_DKIM_APPLY=1) ---"
  bash "${REPO_ROOT}/scripts/sunucu-ekolojik-opendkim-kur.sh" --apply
  echo ""
else
  echo "DKIM sunucu anahtarı yok — root: EKOLOJIK_DKIM_APPLY=1 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-opendkim-kur.sh --apply"
  echo "  veya hosting panel DKIM → selector adını EKOLOJIK_DKIM_SELECTOR ile doğrulayın"
  echo ""
fi

echo "--- dig doğrulama ---"
export EKOLOJIK_MAIL_DOMAIN="${DOMAIN}"
export EKOLOJIK_DKIM_SELECTOR="${SELECTOR}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh" || true

echo ""
echo "Strict (DNS yayılımı sonrası): EKOLOJIK_DNS_STRICT=1 bash ${REPO_ROOT}/scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
