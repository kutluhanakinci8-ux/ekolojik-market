#!/usr/bin/env bash
# Postfix alias düzeltmesi (myorigin=mail.lerta.com.tr ortamında pipe teslimi)
set -euo pipefail

TOKEN="ekolojik-inbound-info-ekolojikmarket-com-tr"
PIPE='|/usr/lib/dovecot/deliver -d info@ekolojikmarket.com.tr -m'
MYORIGIN="$(postconf -h myorigin)"

echo "=== Ekolojik Postfix inbound alias fix ==="
echo "myorigin: ${MYORIGIN}"

echo "info@ekolojikmarket.com.tr ${TOKEN}" > /etc/postfix/ekolojik-inbound-virtual
{
  echo "${TOKEN}: ${PIPE}"
  echo "${TOKEN}@${MYORIGIN}: ${PIPE}"
} > /etc/postfix/ekolojik-inbound-aliases

postmap /etc/postfix/ekolojik-inbound-virtual
postmap /etc/postfix/ekolojik-inbound-aliases
systemctl reload postfix

echo "OK   virtual + alias güncellendi"
postmap -q "info@ekolojikmarket.com.tr" hash:/etc/postfix/ekolojik-inbound-virtual
postmap -q "${TOKEN}@${MYORIGIN}" hash:/etc/postfix/ekolojik-inbound-aliases
