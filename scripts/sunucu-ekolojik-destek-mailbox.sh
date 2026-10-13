#!/usr/bin/env bash
# destek@ekolojikmarket.com.tr — ayrı Dovecot/Postfix teslimi (info@ modeline benzer)
# Kullanım (VPS root): EKOLOJIK_REPO_ROOT=/var/www/ekolojik-market-pos bash scripts/sunucu-ekolojik-destek-mailbox.sh
set -euo pipefail

DOMAIN=ekolojikmarket.com.tr
LOCAL_USER="destek@${DOMAIN}"
TOKEN="ekolojik-inbound-destek-ekolojikmarket-com-tr"
TOKEN_LOCAL="${TOKEN}@mail.lerta.com.tr"
VIRTUAL_FILE="/etc/postfix/ekolojik-inbound-virtual-destek"
TRANSPORT_FILE="/etc/postfix/ekolojik-inbound-transport-destek"
MASTER_CF="/etc/postfix/master.cf"

if [[ $EUID -ne 0 ]]; then
  echo "HATA: root olarak çalıştırın"
  exit 1
fi

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

VA="$(postconf -h virtual_alias_maps)"
if [[ "${VA}" != *ekolojik-inbound-virtual-destek* ]]; then
  postconf -e "virtual_alias_maps = ${VA}, hash:${VIRTUAL_FILE}"
fi

TM="$(postconf -h transport_maps)"
if [[ "${TM}" != *ekolojik-inbound-transport-destek* ]]; then
  postconf -e "transport_maps = ${TM}, hash:${TRANSPORT_FILE}"
fi

systemctl reload postfix

echo "OK   ${LOCAL_USER} ayrı kutu (Dovecot kullanıcısı oluşturmayı unutmayın)"
echo "Env örneği:"
echo "  EKOLOJIK_SUPPORT_INBOX=${LOCAL_USER}"
echo "  EKOLOJIK_SUPPORT_IMAP_USER=${LOCAL_USER}"
echo "  EKOLOJIK_SUPPORT_MAIL_FROM=${LOCAL_USER}"
echo "  EKOLOJIK_SUPPORT_IMAP_PASS=<dovecot şifre>"
