#!/usr/bin/env bash
# Postfix virtual → doveadm pipe (Lerta alias_maps zinciri gerekmez)
set -euo pipefail

PIPE='|/usr/lib/dovecot/deliver -d info@ekolojikmarket.com.tr -m'

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
