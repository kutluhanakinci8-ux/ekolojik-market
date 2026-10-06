#!/usr/bin/env bash
# Faz 6 — OpenDKIM (yalnızca @ekolojikmarket.com.tr imzalar; diğer domainler etkilenmez)
#   bash .../sunucu-ekolojik-opendkim-kur.sh           # dry-run + mevcut TXT
#   bash .../sunucu-ekolojik-opendkim-kur.sh --apply   # kurulum (root)
set -euo pipefail

DOMAIN="${EKOLOJIK_MAIL_DOMAIN:-ekolojikmarket.com.tr}"
SELECTOR="${EKOLOJIK_DKIM_SELECTOR:-ekolojik}"
APPLY=0
[[ "${1:-}" == "--apply" ]] && APPLY=1

KEY_DIR="/etc/opendkim/keys/${DOMAIN}"
PRIVATE_KEY="${KEY_DIR}/${SELECTOR}.private"
TXT_FILE="${KEY_DIR}/${SELECTOR}.txt"
SIGNING_TABLE="/etc/opendkim/signing.table"
KEY_TABLE="/etc/opendkim/key.table"
TRUSTED="/etc/opendkim/trusted.hosts"

echo "=== Ekolojik OpenDKIM (${DOMAIN}) ==="
echo "Selector: ${SELECTOR}"
echo ""

if [[ "$(id -u)" != "0" ]]; then
  echo "HATA: root gerekli"
  exit 1
fi

show_txt() {
  if [[ -f "${TXT_FILE}" ]]; then
    echo "DNS TXT (panelde ${SELECTOR}._domainkey.${DOMAIN}):"
    awk -F'"' '/TXT/ { for (i=2; i<NF; i+=2) printf "%s", $i; print "" }' "${TXT_FILE}" || cat "${TXT_FILE}"
    echo ""
  else
    echo "UYARI: ${TXT_FILE} yok — --apply ile anahtar üretin"
  fi
}

if [[ "${APPLY}" -ne 1 ]]; then
  show_txt
  echo "Kurulum için: bash $0 --apply"
  exit 0
fi

export DEBIAN_FRONTEND=noninteractive
apt-get install -y opendkim opendkim-tools >/dev/null

mkdir -p "${KEY_DIR}"
if [[ ! -f "${PRIVATE_KEY}" ]]; then
  opendkim-genkey -b 2048 -d "${DOMAIN}" -s "${SELECTOR}" -D "${KEY_DIR}"
  chown -R opendkim:opendkim /etc/opendkim/keys 2>/dev/null || chown -R opendkim:opendkim "${KEY_DIR}"
  chmod 600 "${PRIVATE_KEY}"
fi

cat >"${TRUSTED}" <<EOF
127.0.0.1
localhost
::1
EOF

grep -q "${DOMAIN}" "${SIGNING_TABLE}" 2>/dev/null || \
  echo "*@${DOMAIN} ${SELECTOR}._domainkey.${DOMAIN}" >> "${SIGNING_TABLE}"

grep -q "${SELECTOR}._domainkey.${DOMAIN}" "${KEY_TABLE}" 2>/dev/null || \
  echo "${SELECTOR}._domainkey.${DOMAIN} ${DOMAIN}:${SELECTOR}:${PRIVATE_KEY}" >> "${KEY_TABLE}"

cat >/etc/opendkim.conf <<EOF
Syslog                  yes
UMask                   002
Canonicalization        relaxed/simple
Mode                    sv
SubDomains              no
AutoRestart             yes
AutoRestartRate         10/1M
Background              yes
DNSTimeout              5
SignatureAlgorithm      rsa-sha256
KeyTable                refile:${KEY_TABLE}
SigningTable            refile:${SIGNING_TABLE}
ExternalIgnoreList      refile:${TRUSTED}
InternalHosts           refile:${TRUSTED}
Socket                  inet:8891@localhost
PidFile                 /run/opendkim/opendkim.pid
UserID                  opendkim
EOF

mkdir -p /run/opendkim
chown opendkim:opendkim /run/opendkim 2>/dev/null || true

for kv in \
  "milter_protocol=6" \
  "milter_default_action=accept" \
  "smtpd_milters=inet:localhost:8891" \
  "non_smtpd_milters=inet:localhost:8891"; do
  key="${kv%%=*}"
  val="${kv#*=}"
  postconf -e "${key}=${val}" 2>/dev/null || true
done

systemctl enable opendkim >/dev/null 2>&1 || true
systemctl restart opendkim
systemctl reload postfix 2>/dev/null || systemctl restart postfix

echo "OK   OpenDKIM aktif (8891 milter, yalnızca *@${DOMAIN})"
show_txt
echo "Doğrulama: EKOLOJIK_DKIM_SELECTOR=${SELECTOR} bash scripts/sunucu-ekolojik-dns-mail-dogrula.sh"
