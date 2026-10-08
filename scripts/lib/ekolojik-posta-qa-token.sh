#!/usr/bin/env bash
# Posta API smoke için Bearer token — Faz 38 (posta sekmesi yetkisi gerekir)
# Kullanım: source .../ekolojik-posta-qa-token.sh && ekolojik_resolve_posta_qa_token "$BASE_URL"
ekolojik_resolve_posta_qa_token() {
  local base_url="${1:?BASE_URL gerekli}"
  if [[ -n "${EKOLOJIK_POS_QA_TOKEN:-}" ]]; then
    if ekolojik_posta_token_works "${base_url}" "${EKOLOJIK_POS_QA_TOKEN}"; then
      printf '%s' "${EKOLOJIK_POS_QA_TOKEN}"
      return 0
    fi
    return 1
  fi

  local pair user pass token
  if [[ -n "${EKOLOJIK_POS_QA_USER:-}" && -n "${EKOLOJIK_POS_QA_PASSWORD:-}" ]]; then
    pair="${EKOLOJIK_POS_QA_USER}:${EKOLOJIK_POS_QA_PASSWORD}"
    user="${pair%%:*}"
    pass="${pair#*:}"
    token="$(ekolojik_fetch_pos_token "${base_url}" "${user}" "${pass}")" || true
    if [[ -n "${token}" ]] && ekolojik_posta_token_works "${base_url}" "${token}"; then
      EKOLOJIK_POS_QA_TOKEN_USER="${user}"
      printf '%s' "${token}"
      return 0
    fi
  fi

  for pair in "yonetici:yonetici123" "admin:admin123" "kasiyer:kasiyer123"; do
    user="${pair%%:*}"
    pass="${pair#*:}"
    token="$(ekolojik_fetch_pos_token "${base_url}" "${user}" "${pass}")" || continue
    if ekolojik_posta_token_works "${base_url}" "${token}"; then
      EKOLOJIK_POS_QA_TOKEN_USER="${user}"
      printf '%s' "${token}"
      return 0
    fi
  done

  if [[ "${EKOLOJIK_POS_QA_MINT:-1}" != "0" ]]; then
    local data_dir="${EKOLOJIK_QA_DATA_DIR:-}"
    local repo_root="${EKOLOJIK_REPO_ROOT:-}"
    if [[ -z "${data_dir}" && -n "${EKOLOJIK_VERIFY_ROOT:-}" ]]; then
      data_dir="${EKOLOJIK_VERIFY_ROOT}/data"
    fi
    if [[ -n "${data_dir}" && -d "${data_dir}" && -n "${repo_root}" ]]; then
      local mint_json
      mint_json="$(node "${repo_root}/scripts/lib/mint-posta-qa-token.mjs" "${data_dir}" 2>/dev/null)" || true
      if [[ -n "${mint_json}" ]]; then
        token="$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.token||'')}catch{}" "${mint_json}")"
        user="$(node -e "try{const j=JSON.parse(process.argv[1]);process.stdout.write(j.username||'mint')}catch{}" "${mint_json}")"
        if [[ -n "${token}" ]] && ekolojik_posta_token_works "${base_url}" "${token}"; then
          EKOLOJIK_POS_QA_TOKEN_USER="${user}"
          printf '%s' "${token}"
          return 0
        fi
      fi
    fi
  fi

  return 1
}

ekolojik_fetch_pos_token() {
  local base_url="$1" user="$2" pass="$3"
  curl -fsS -X POST "${base_url}/api/auth/pos-token" \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"${user}\",\"password\":\"${pass}\"}" 2>/dev/null \
    | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);if(j.ok&&j.token)process.stdout.write(j.token);}catch{}});"
}

ekolojik_posta_token_works() {
  local base_url="$1" token="$2"
  [[ -n "${token}" ]] || return 1
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer ${token}" \
    "${base_url}/api/posta/unread-counts" 2>/dev/null || echo 000)"
  [[ "${code}" == "200" ]]
}
