#!/usr/bin/env bash
# Faz 32 — NB PM-6 SSE canlılık + mesaj gecikme metrik
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 32 doğrulama ==="
test -f "${ROOT}/server/postaLive.mjs" || exit 1

curl -fsS "${BASE}/api/posta/live/capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.events?.includes('ping') || !d.events?.includes('inbox')) process.exit(1);
console.log('OK   live capabilities v', d.version);
"

curl -fsS "${BASE}/api/posta/live/metrics?days=7" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok || !d.sse || d.deliveryLatency == null) process.exit(1);
console.log('OK   live metrics samples', d.deliveryLatency.sampleCount);
"

SSE_SAMPLE="$(timeout 6 curl -fsS -N "${BASE}/api/posta/events" 2>/dev/null | head -n 12 || true)"
echo "$SSE_SAMPLE" | grep -q '^retry:' || { echo "SSE retry satırı yok"; exit 1; }
echo "$SSE_SAMPLE" | grep -qE '^event: (unread|ping)' || { echo "SSE unread/ping yok"; exit 1; }
echo "OK   SSE stream retry + events"

cd "${ROOT}"
node --input-type=module -e "
import { recordPostaDeliveryLatency, getPostaLiveMetrics } from './server/postaLive.mjs';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const dir = await mkdtemp(join(tmpdir(), 'ek-live-'));
const past = new Date(Date.now() - 5000).toISOString();
const r = await recordPostaDeliveryLatency(dir, { channel: 'test', messageAt: past, sourceId: 't1' });
if (!r.ok || r.delayMs < 4000) process.exit(1);
const m = await getPostaLiveMetrics(dir, { days: 1 });
if (!m.ok || m.deliveryLatency.sampleCount < 1) process.exit(1);
console.log('OK   latency record p50', m.deliveryLatency.p50Ms);
"

echo "✓ Faz 32 doğrulama geçti"
