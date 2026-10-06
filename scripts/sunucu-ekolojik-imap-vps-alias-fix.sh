#!/usr/bin/env bash
# Postfix virtual → doveadm pipe (Lerta alias_maps zinciri gerekmez)
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
PIPE='|/usr/local/bin/ekolojik-postfix-deliver-info.sh'
INSTALL_PIPE="/usr/local/bin/ekolojik-postfix-deliver-info.sh"
SCRIPT_PIPE="${REPO_ROOT}/scripts/ekolojik-postfix-deliver-info.sh"

if [[ -f "${SCRIPT_PIPE}" ]]; then
  install -m 755 "${SCRIPT_PIPE}" "${INSTALL_PIPE}"
  echo "OK   ${INSTALL_PIPE}"
fi

echo "=== Ekolojik Postfix inbound virtual fix ==="

echo "info@ekolojikmarket.com.tr ${PIPE}" > /etc/postfix/ekolojik-inbound-virtual
postmap /etc/postfix/ekolojik-inbound-virtual

VA="$(postconf -h virtual_alias_maps)"
if [[ "${VA}" != *ekolojik-inbound-virtual* ]]; then
  postconf -e "virtual_alias_maps = ${VA}, hash:/etc/postfix/ekolojik-inbound-virtual"
fi
systemctl reload postfix

echo "OK   info@ → doveadm deliver (virtual_alias_maps)"
postmap -q "info@ekolojikmarket.com.tr" hash:/etc/postfix/ekolojik-inbound-virtual
