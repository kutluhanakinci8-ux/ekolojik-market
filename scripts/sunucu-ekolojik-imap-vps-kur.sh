#!/usr/bin/env bash
# Faz 7 — VPS'te info@ekolojikmarket.com.tr maildir + Dovecot (NB Lerta pipe'a dokunmaz)
#   bash .../sunucu-ekolojik-imap-vps-kur.sh          # dry-run
#   bash .../sunucu-ekolojik-imap-vps-kur.sh --apply
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${MARKET_POS_DIR:-/var/www/market-pos}"
ENV_FILE="${INSTALL_DIR}/.env"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/ekolojik-env-load.sh
source "${SCRIPT_DIR}/lib/ekolojik-env-load.sh"

DOMAIN=ekolojikmarket.com.tr
LOCAL_USER="info@${DOMAIN}"
MAILDIR="/var/mail/vhosts/${DOMAIN}/info/Maildir"
DOVECOT_PASS="/etc/dovecot/ekolojik-imap-passwd"
DOVECOT_SNIP="/etc/dovecot/conf.d/99-ekolojik-mail.conf"

set_env_kv() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

echo "=== Ekolojik Faz 7 — info@ IMAP (VPS) ==="
echo "Runtime: ${INSTALL_DIR}"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "HATA: ${ENV_FILE} yok"
  exit 1
fi

if ! command -v doveadm >/dev/null 2>&1; then
  echo "HATA: Dovecot yok — apt install dovecot-imapd"
  exit 1
fi

IMAP_PASS="${EKOLOJIK_IMAP_PASS:-}"
if [[ -z "${IMAP_PASS}" ]]; then
  IMAP_PASS="$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)"
fi

echo "Hedef kutu: ${LOCAL_USER}"
echo "Maildir:    ${MAILDIR}"
echo ""

if [[ "${APPLY}" -ne 1 ]]; then
  echo "Dry-run. Uygulamak için: --apply"
  echo "Şifre: env EKOLOJIK_IMAP_PASS veya otomatik üretilir (.env'e yazılır)"
  exit 0
fi

mkdir -p "${MAILDIR}/"{cur,new,tmp}
chown -R vmail:mail "/var/mail/vhosts/${DOMAIN}"
chmod -R 750 "/var/mail/vhosts/${DOMAIN}"

HASH="$(doveadm pw -s BLF-CRYPT -p "${IMAP_PASS}")"
echo "${LOCAL_USER}:${HASH}" > "${DOVECOT_PASS}"
chmod 640 "${DOVECOT_PASS}"
chown root:dovecot "${DOVECOT_PASS}" 2>/dev/null || chown root:root "${DOVECOT_PASS}"

cat > "${DOVECOT_SNIP}" <<'EOF'
# Ekolojik Market POS — info@ (Lerta passdb dosyası ayrı)
passdb {
  driver = passwd-file
  args = scheme=BLF-CRYPT username_format=%u /etc/dovecot/ekolojik-imap-passwd
}
userdb {
  driver = static
  args = uid=vmail gid=mail home=/var/mail/vhosts/%d/%n
}
EOF
systemctl reload dovecot

export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-vps-alias-fix.sh"

cp -a "${ENV_FILE}" "${ENV_FILE}.bak.imap.$(date +%Y%m%d%H%M%S)"
set_env_kv EKOLOJIK_IMAP_HOST 127.0.0.1
set_env_kv EKOLOJIK_IMAP_PORT 143
set_env_kv EKOLOJIK_IMAP_SECURE 0
set_env_kv EKOLOJIK_IMAP_USER "${LOCAL_USER}"
set_env_kv EKOLOJIK_IMAP_INBOX "${LOCAL_USER}"
set_env_kv EKOLOJIK_IMAP_PASS "${IMAP_PASS}"

echo "OK   .env IMAP anahtarları güncellendi"

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete market-pos 2>/dev/null || true
  (cd "${INSTALL_DIR}" && pm2 start ecosystem.config.cjs --update-env)
  pm2 save >/dev/null 2>&1 || true
fi

sleep 2
export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-imap-dogrula.sh" "${INSTALL_DIR}"; then
  echo ""
  echo "✓ Posta hub → Gelen → Senkronize et ile mailleri çekin"
else
  echo "UYARI: IMAP doğrulama başarısız — doveconf / postconf kontrol edin"
  exit 2
fi
