#!/usr/bin/env bash
# Postfix alias pipe — vmail olarak lda (auth-master / stats-writer izinleri)
SENDER="${SENDER:-${POSTFIX_SENDER:-}}"
ARGS=(-d info@ekolojikmarket.com.tr -m INBOX)
if [[ -n "${SENDER}" ]]; then
  ARGS+=(-f "${SENDER}")
fi
exec runuser -u vmail -- /usr/lib/dovecot/deliver "${ARGS[@]}"
