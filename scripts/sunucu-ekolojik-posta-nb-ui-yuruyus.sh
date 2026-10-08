#!/usr/bin/env bash
# NB checklist #1–10 — POS ekran yürüyüşü + API kapısı
set -euo pipefail

REPO_ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"
INSTALL_DIR="${1:-/var/www/market-pos}"
BASE="${POS_PUBLIC_URL:-http://168.231.109.27:5180}"

echo "=== Ekolojik Posta NB UI yürüyüşü (sıra 6) ==="
echo "POS: ${BASE}"
echo ""

cat <<'GUIDE'
# | POS'ta kontrol
1 | Sol menü «Posta» + okunmamış rozet (AppShell)
2 | Posta hub — 3 sütun (Gelen / Yaz / Müşteri mesajları)
3 | Gelen → smoke veya iletişim maili; gövde düz metin (JSON değil)
4 | Yaz → şablon seç; «Yanıtla» ile compose hints dolu
5 | Müşteri mesajları → thread listesi + yeni mesaj
6 | Ayarlar → E-posta → Gönderilen / outbox; sent satırı + CSV
7 | Posta ekranında ~15 sn bekleyin veya yenileyin (SSE /api/posta/events)
8 | Ayarlar → E-posta → gönderen adı, ops, imza kayıtlı
9 | Ayarlar → outbox CSV indir; mesajlaşma ZIP (panel veya API export)
10| Ayarlar → Sistem → Faz 5 ayrım kontrolü yeşil; bridge kapalı
19| Wave3: anon export 401; token ile CSV
20| Widget + public messaging (onboarding)
21| DNS checklist (deliverability)
22| Engagement şeridi (hub)
23| WA kanal rozeti + ayarlar
24| Thread durum/atama + SLA şeridi
25| /portal/mesajlar veya iletişim portal linki
GUIDE

echo ""
echo "--- API kapısı (otomatik) ---"
bash "${REPO_ROOT}/scripts/sunucu-ekolojik-posta-nb-checklist-dogrula.sh" "${INSTALL_DIR}"
