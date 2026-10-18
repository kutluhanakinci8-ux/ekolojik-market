#!/usr/bin/env bash
# Yedek: manuel lda testi (prod teslim master.cf ekolojik-lda ile)
SENDER="${SENDER:-${POSTFIX_SENDER:-}}"
CMD=(/usr/lib/dovecot/deliver -d info@ekolojikmarket.com.tr -m INBOX)
if [[ -n "${SENDER}" ]]; then
  CMD+=(-f "${SENDER}")
fi
if [[ $(id -u) -eq 0 ]]; then
  exec su vmail -s /bin/sh -c "$(printf '%q ' "${CMD[@]}")"
fi
exec "${CMD[@]}"
