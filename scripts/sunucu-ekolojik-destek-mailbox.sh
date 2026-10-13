#!/usr/bin/env bash
# destek@ekolojikmarket.com.tr — Dovecot maildir + Postfix inbound + platform .env (EKOLOJIK_SUPPORT_*)
# Kullanım (VPS root):
#   bash scripts/sunucu-ekolojik-destek-mailbox.sh              # dry-run
#   bash scripts/sunucu-ekolojik-destek-mailbox.sh --apply      # kurulum
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
LOCAL_USER="destek@${DOMAIN}"
MAILDIR="/var/mail/vhosts/${DOMAIN}/destek/Maildir"
TOKEN="ekolojik-inbound-destek-ekolojikmarket-com-tr"
TOKEN_LOCAL="${TOKEN}@mail.lerta.com.tr"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual-destek"
TRANSPORT_FILE="/etc/postfix/ekolojik-inbound-transport-destek"
MASTER_CF="/etc/postfix/master.cf"
DOVECOT_PASS="/etc/dovecot/ekolojik-imap-passwd"

set_env_kv() {
  local key="$1"
  local val="$2"
  if grep -qE "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

upsert_dovecot_passwd_user() {
  local user="$1"
  local pass="$2"
  local hash
  hash="$(doveadm pw -s BLF-CRYPT -p "${pass}")"
  touch "${DOVECOT_PASS}"
  if grep -q "^${user}:" "${DOVECOT_PASS}" 2>/dev/null; then
    sed -i "/^${user}:/d" "${DOVECOT_PASS}"
  fi
  echo "${user}:${hash}" >> "${DOVECOT_PASS}"
}

configure_postfix_destek() {
  if ! grep -q '^ekolojik-lda-destek ' "${MASTER_CF}" 2>/dev/null; then
    cat >> "${MASTER_CF}" <<EOF

ekolojik-lda-destek unix  -       n       n       -       -       pipe
  flags=DRhu user=vmail:mail argv=/usr/lib/dovecot/deliver -d ${LOCAL_USER} -m INBOX -f \${sender}
EOF
    echo "OK   master.cf ekolojik-lda-destek"
  fi

  echo "${LOCAL_USER} ${TOKEN}" > "${VIRTUAL_FILE}"
  postmap "${VIRTUAL_FILE}"

  echo "${TOKEN_LOCAL} ekolojik-lda-destek:" > "${TRANSPORT_FILE}"
  postmap "${TRANSPORT_FILE}"

  local va tm
  va="$(postconf -h virtual_alias_maps)"
  if [[ "${va}" != *ekolojik-inbound-virtual-destek* ]]; then
    postconf -e "virtual_alias_maps = ${va}, hash:${VIRTUAL_FILE}"
  fi

  tm="$(postconf -h transport_maps)"
  if [[ "${tm}" != *ekolojik-inbound-transport-destek* ]]; then
    postconf -e "transport_maps = ${tm}, hash:${TRANSPORT_FILE}"
  fi

  systemctl reload postfix
  echo "OK   Postfix ${LOCAL_USER} → ${TOKEN} → ekolojik-lda-destek"
}

echo "=== Ekolojik Platform — destek@ posta kutusu ==="
echo "Runtime: ${INSTALL_DIR}"
echo "Kutu:    ${LOCAL_USER}"
echo "Maildir: ${MAILDIR}"
echo ""

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

ekolojik_load_env "${ENV_FILE}" || true
SUPPORT_PASS="${EKOLOJIK_SUPPORT_IMAP_PASS:-}"
if [[ -z "${SUPPORT_PASS}" ]]; then
  SUPPORT_PASS="$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)"
fi

if [[ "${APPLY}" -ne 1 ]]; then
  echo "Dry-run. Uygulamak için: --apply"
  echo "Şifre: EKOLOJIK_SUPPORT_IMAP_PASS veya otomatik üretilir (.env'e yazılır)"
  exit 0
fi

mkdir -p "${MAILDIR}/"{cur,new,tmp}
chown -R vmail:mail "/var/mail/vhosts/${DOMAIN}/destek"
chmod -R 750 "/var/mail/vhosts/${DOMAIN}/destek"

upsert_dovecot_passwd_user "${LOCAL_USER}" "${SUPPORT_PASS}"
chmod 640 "${DOVECOT_PASS}"
chown root:dovecot "${DOVECOT_PASS}" 2>/dev/null || chown root:root "${DOVECOT_PASS}"
systemctl reload dovecot
echo "OK   Dovecot passdb: ${LOCAL_USER}"

configure_postfix_destek

cp -a "${ENV_FILE}" "${ENV_FILE}.bak.support.$(date +%Y%m%d%H%M%S)"
set_env_kv EKOLOJIK_SUPPORT_INBOX "${LOCAL_USER}"
set_env_kv EKOLOJIK_SUPPORT_MAIL_FROM "${LOCAL_USER}"
set_env_kv EKOLOJIK_SUPPORT_MAIL_FROM_NAME "Ekolojik Destek"
set_env_kv EKOLOJIK_SUPPORT_IMAP_HOST 127.0.0.1
set_env_kv EKOLOJIK_SUPPORT_IMAP_PORT 143
set_env_kv EKOLOJIK_SUPPORT_IMAP_SECURE 0
set_env_kv EKOLOJIK_SUPPORT_IMAP_USER "${LOCAL_USER}"
set_env_kv EKOLOJIK_SUPPORT_IMAP_PASS "${SUPPORT_PASS}"
echo "OK   .env EKOLOJIK_SUPPORT_* güncellendi"

if command -v pm2 >/dev/null 2>&1; then
  pm2 delete market-pos 2>/dev/null || true
  (cd "${INSTALL_DIR}" && pm2 start ecosystem.config.cjs --update-env)
  pm2 save >/dev/null 2>&1 || true
fi

sleep 2
export EKOLOJIK_REPO_ROOT="${REPO_ROOT}"
if bash "${REPO_ROOT}/scripts/sunucu-ekolojik-support-imap-dogrula.sh" "${INSTALL_DIR}"; then
  echo ""
  echo "✓ Platform → Destek → Gelen kutusu → IMAP + outbox senkron"
else
  echo "UYARI: destek@ IMAP doğrulama başarısız"
  exit 2
fi
