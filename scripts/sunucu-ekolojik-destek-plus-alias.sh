#!/usr/bin/env bash
# destek+case123@ekolojikmarket.com.tr → destek@ (aynı Maildir)
#   bash scripts/sunucu-ekolojik-destek-plus-alias.sh
#   bash scripts/sunucu-ekolojik-destek-plus-alias.sh --apply
set -euo pipefail

APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

DOMAIN=ekolojikmarket.com.tr
LOCAL_USER="destek@${DOMAIN}"
REGEXP_FILE="/etc/postfix/ekolojik-destek-plus-regexp"

echo "==> destek+case*@${DOMAIN} → ${LOCAL_USER}"
echo "    regexp: ${REGEXP_FILE}"

if [[ "${APPLY}" -eq 0 ]]; then
  echo "Dry-run. Uygulamak için: $0 --apply"
  exit 0
fi

cat > "${REGEXP_FILE}" <<EOF
/^destek\\+[^@]+@${DOMAIN//./\\.}$/ ${LOCAL_USER}
EOF
postmap "${REGEXP_FILE}"

VA="$(postconf -h virtual_alias_maps)"
if [[ "${VA}" != *ekolojik-destek-plus-regexp* ]]; then
  postconf -e "virtual_alias_maps = ${VA}, regexp:${REGEXP_FILE}"
fi

systemctl reload postfix
postmap -q "destek+case99@${DOMAIN}" "regexp:${REGEXP_FILE}" && echo "OK   postmap test destek+case99"
echo "OK   Postfix plus-alias aktif"
