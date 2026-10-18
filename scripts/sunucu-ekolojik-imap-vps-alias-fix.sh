#!/usr/bin/env bash
# Postfix inbound: virtual token → transport ekolojik-lda (vmail pipe; alias pipe nobody ile lda çalışmaz)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
DOMAIN=ekolojikmarket.com.tr
LOCAL_USER="info@${DOMAIN}"
TOKEN="ekolojik-inbound-info-ekolojikmarket-com-tr"
TOKEN_LOCAL="${TOKEN}@mail.lerta.com.tr"
INSTALL_PIPE="/usr/local/bin/ekolojik-postfix-deliver-info.sh"
SCRIPT_PIPE="${REPO_ROOT}/scripts/ekolojik-postfix-deliver-info.sh"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual"
TRANSPORT_FILE="/etc/postfix/ekolojik-inbound-transport"
ALIAS_FILE="/etc/postfix/ekolojik-inbound-aliases"
MASTER_CF="/etc/postfix/master.cf"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın"
  exit 1
fi

if [[ -f "${SCRIPT_PIPE}" ]]; then
  install -m 755 "${SCRIPT_PIPE}" "${INSTALL_PIPE}"
  echo "OK   ${INSTALL_PIPE} (yedek / debug)"
fi

if id vmail &>/dev/null && getent group dovecot &>/dev/null; then
  usermod -aG dovecot vmail 2>/dev/null || true
  echo "OK   vmail ∈ dovecot (lda stats-writer)"
fi

if ! grep -q '^ekolojik-lda ' "${MASTER_CF}"; then
  cat >> "${MASTER_CF}" <<'EOF'

ekolojik-lda unix  -       n       n       -       -       pipe
  flags=DRhu user=vmail:mail argv=/usr/lib/dovecot/deliver -d info@ekolojikmarket.com.tr -m INBOX -f ${sender}
EOF
  echo "OK   master.cf ekolojik-lda"
fi

echo "=== Ekolojik Postfix inbound (virtual + transport) ==="

echo "${LOCAL_USER} ${TOKEN}" > "${VIRTUAL_FILE}"
postmap "${VIRTUAL_FILE}"

echo "${TOKEN_LOCAL} ekolojik-lda:" > "${TRANSPORT_FILE}"
postmap "${TRANSPORT_FILE}"

echo "# Ekolojik teslim transport_maps ekolojik-lda ile (alias pipe kullanılmaz)" > "${ALIAS_FILE}"
postalias "${ALIAS_FILE}"

VA="$(postconf -h virtual_alias_maps)"
if [[ "${VA}" != *ekolojik-inbound-virtual* ]]; then
  postconf -e "virtual_alias_maps = ${VA}, hash:${VIRTUAL_FILE}"
fi

TM="$(postconf -h transport_maps)"
if [[ "${TM}" != *ekolojik-inbound-transport* ]]; then
  postconf -e "transport_maps = ${TM}, hash:${TRANSPORT_FILE}"
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

if [[ -f /etc/dovecot/conf.d/99-ekolojik-mail.conf ]]; then
  if ! grep -q 'userdb {' /etc/dovecot/conf.d/99-ekolojik-mail.conf; then
    cat >> /etc/dovecot/conf.d/99-ekolojik-mail.conf <<'EOF'
userdb {
  driver = static
  args = uid=vmail gid=mail home=/var/mail/vhosts/%d/%n
}
EOF
    systemctl reload dovecot
    echo "OK   Dovecot userdb (vmail)"
  fi
fi

systemctl reload postfix

echo "OK   ${LOCAL_USER} → ${TOKEN} → ekolojik-lda"
postmap -q "${LOCAL_USER}" "hash:${VIRTUAL_FILE}"
postmap -q "${TOKEN_LOCAL}" "hash:${TRANSPORT_FILE}"
echo "     virtual_alias_maps=$(postconf -h virtual_alias_maps)"
