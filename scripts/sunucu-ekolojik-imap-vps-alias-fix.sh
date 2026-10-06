#!/usr/bin/env bash
# Postfix inbound: virtual → Lerta-style token → alias_maps pipe (doğrudan |pipe virtual'da myorigin hatası)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DOMAIN=ekolojikmarket.com.tr
LOCAL_USER="info@${DOMAIN}"
TOKEN="ekolojik-inbound-info-ekolojikmarket-com-tr"
PIPE='|/usr/local/bin/ekolojik-postfix-deliver-info.sh'
INSTALL_PIPE="/usr/local/bin/ekolojik-postfix-deliver-info.sh"
SCRIPT_PIPE="${REPO_ROOT}/scripts/ekolojik-postfix-deliver-info.sh"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual"
ALIAS_FILE="/etc/postfix/ekolojik-inbound-aliases"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın"
  exit 1
fi

if [[ -f "${SCRIPT_PIPE}" ]]; then
  install -m 755 "${SCRIPT_PIPE}" "${INSTALL_PIPE}"
  echo "OK   ${INSTALL_PIPE}"
fi

echo "=== Ekolojik Postfix inbound (virtual + alias pipe) ==="

echo "${LOCAL_USER} ${TOKEN}" > "${VIRTUAL_FILE}"
postmap "${VIRTUAL_FILE}"

cat > "${ALIAS_FILE}" <<EOF
${TOKEN}: ${PIPE}
EOF
postalias "${ALIAS_FILE}"

VA="$(postconf -h virtual_alias_maps)"
if [[ "${VA}" != *ekolojik-inbound-virtual* ]]; then
  postconf -e "virtual_alias_maps = ${VA}, hash:${VIRTUAL_FILE}"
fi

AM="$(postconf -h alias_maps)"
if [[ "${AM}" != *ekolojik-inbound-aliases* ]]; then
  postconf -e "alias_maps = ${AM}, hash:${ALIAS_FILE}"
fi

VD="$(postconf -h virtual_alias_domains)"
if [[ "${VD}" != *"${DOMAIN}"* ]]; then
  if [[ -z "${VD}" ]]; then
    postconf -e "virtual_alias_domains = ${DOMAIN}"
  else
    postconf -e "virtual_alias_domains = ${VD}, ${DOMAIN}"
  fi
fi

systemctl reload postfix

if [[ -f /etc/dovecot/conf.d/99-ekolojik-mail.conf ]]; then
  if ! grep -q 'userdb {' /etc/dovecot/conf.d/99-ekolojik-mail.conf; then
    cat >> /etc/dovecot/conf.d/99-ekolojik-mail.conf <<'EOF'
userdb {
  driver = static
  args = uid=vmail gid=mail home=/var/mail/vhosts/%d/%n
}
EOF
    systemctl reload dovecot
    echo "OK   Dovecot userdb (vmail) eklendi"
  fi
fi

echo "OK   ${LOCAL_USER} → ${TOKEN} → deliver pipe"
postmap -q "${LOCAL_USER}" "hash:${VIRTUAL_FILE}"
postmap -q "${TOKEN}" "hash:${ALIAS_FILE}"
