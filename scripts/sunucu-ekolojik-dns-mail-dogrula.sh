#!/usr/bin/env bash
# Faz 5/6 — SPF / DMARC / DKIM TXT (dig; tam deliverability manuel test kalır)
set -euo pipefail

DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-ekolojikmarket.com.tr}"
STRICT="${EKOLOJIK_DNS_STRICT:-0}"
FAIL=0

warn() { echo "UYARI: $*"; }
ok() { echo "OK   $*"; }
bad() { echo "HATA: $*"; FAIL=1; }

if ! command -v dig >/dev/null 2>&1; then
  warn "dig yok — DNS doğrulama atlandı"
  exit 0
fi

echo "=== Ekolojik DNS mail (TXT) ==="
echo "Alan: ${DOMAIN}"
echo ""

txt_records() {
  dig +short TXT "$1" 2>/dev/null | tr -d '"' | tr '\n' ' '
}

SPF="$(txt_records "${DOMAIN}")"
if echo "${SPF}" | grep -qi 'v=spf1'; then
  ok "SPF TXT @${DOMAIN}"
  echo "     ${SPF}"
else
  if [[ "${STRICT}" == "1" ]]; then
    bad "SPF kaydı yok veya v=spf1 bulunamadı (@${DOMAIN})"
  else
    warn "SPF @${DOMAIN} — docs/EKOLOJIK-FAZ6-SMTP-RUNBOOK.md"
  fi
fi

DMARC="$(txt_records "_dmarc.${DOMAIN}")"
if echo "${DMARC}" | grep -qi 'v=DMARC1'; then
  ok "DMARC _dmarc.${DOMAIN}"
  echo "     ${DMARC}"
else
  if [[ "${STRICT}" == "1" ]]; then
    bad "DMARC kaydı yok (_dmarc.${DOMAIN})"
  else
    warn "DMARC _dmarc.${DOMAIN} yok"
  fi
fi

DKIM_FOUND=0
SELECTORS=(default mail dkim selector1 selector2 "${EKOLOJIK_DKIM_SELECTOR:-ekolojik}")
for sel in "${SELECTORS[@]}"; do
  D="$(txt_records "${sel}._domainkey.${DOMAIN}")"
  if echo "${D}" | grep -qi 'v=DKIM1'; then
    ok "DKIM ${sel}._domainkey.${DOMAIN}"
    DKIM_FOUND=1
    break
  fi
done
if [[ $DKIM_FOUND -eq 0 ]]; then
  if [[ "${STRICT}" == "1" ]]; then
    bad "DKIM TXT bulunamadı (default/mail/selector1 denendi)"
  else
    warn "DKIM selector denemeleri boş — panel/hosting DKIM adını kontrol edin"
  fi
fi

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo "✓ DNS mail TXT kapısı geçti (veya uyarı modu)"
  exit 0
fi
echo "HATA: DNS — EKOLOJIK_DNS_STRICT=0 ile uyarı modunda tekrar deneyin"
exit 1
