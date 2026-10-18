#!/usr/bin/env bash
# OpenDKIM *.txt → tek satır DNS TXT (panel kopyala-yapıştır)
ekolojik_opendkim_txt_oneline() {
  local txt_file="${1:?OpenDKIM .txt dosyası gerekli}"
  if [[ ! -f "${txt_file}" ]]; then
    return 1
  fi
  awk '
    BEGIN { v="" }
    /"/ {
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^"/ || v != "") {
          gsub(/^"|"$/, "", $i)
          v = v $i
        }
      }
    }
    END { print v }
  ' "${txt_file}" | tr -d ' \t' | sed -E 's/\);.*$//' | sed 's/;;.*//'
}
