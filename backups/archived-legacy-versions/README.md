# Eski / yan ürünler (POS web sürümü değil)

Canlı POS **yalnızca** `main` build + `www.ekolojikmarket.com.tr/app`.

| Yol | Ne | Kullanım |
|-----|-----|----------|
| `extension/` | Chrome fatura köprüsü eklentisi | Opsiyonel; POS sürümünden bağımsız |
| `inpos-bridge/` | Mali yazıcı köprüsü (Windows) | USB mali cihaz; VPS’te çalışmaz |
| `scripts/lima-raw-print-bridge.mjs` | Termal fiş (kasa PC) | Mac/Win yerel; site sürümü değil |
| Eski `cursor/*` dalları | Geçmiş denemeler | Arşiv: `backups/archived-pr-branches-2026-10-12/` |

Bu bileşenler yedeklenir; **tek POS programı** sunucudaki `dist/` ile dağıtılır.
