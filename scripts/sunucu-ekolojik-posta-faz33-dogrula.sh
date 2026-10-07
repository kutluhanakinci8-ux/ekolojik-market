#!/usr/bin/env bash
# Faz 33 — okundu bilgisi + typing lite (NB sohbet #34)
set -euo pipefail

BASE="${EKOLOJIK_VERIFY_BASE_URL:-http://127.0.0.1:5180}"
ROOT="${EKOLOJIK_REPO_ROOT:-/var/www/ekolojik-market-pos}"

echo "=== Ekolojik Posta Faz 33 doğrulama ==="
test -f "${ROOT}/server/messaging/realtime.mjs" || exit 1

curl -fsS "${BASE}/api/messaging/capabilities" | node -e "
const d=JSON.parse(require('fs').readFileSync(0,'utf8'));
if(!d.ok||!d.readReceipts||!d.public) process.exit(1);
console.log('OK   messaging capabilities v', d.version);
"

cd "${ROOT}"
node --input-type=module -e "
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createMessagingThread, appendMessagingMessage, markMessagingMessagesRead, listMessagingMessages } from './server/messaging/store.mjs';
import { setMessagingTyping, getMessagingTyping } from './server/messaging/realtime.mjs';

const dir = await mkdtemp(join(tmpdir(), 'ek-msg-'));
const t = await createMessagingThread(dir, 'main', { customerId: 'c1', customerName: 'Test', initialMessage: 'merhaba', initialDirection: 'customer' });
if (!t.ok) process.exit(1);
const threadId = t.thread.id;
await appendMessagingMessage(dir, 'main', threadId, { bodyText: 'yanıt', direction: 'staff' });
const read = await markMessagingMessagesRead(dir, 'main', threadId, { reader: 'staff' });
if (!read.ok || read.updated < 1) process.exit(1);
const listed = await listMessagingMessages(dir, 'main', threadId, { limit: 10 });
const customerMsg = listed.messages?.find((m) => m.direction === 'customer');
if (!customerMsg?.readByStaffAt) process.exit(1);
setMessagingTyping('main', threadId, 'customer', true);
const typing = getMessagingTyping('main', threadId);
if (!typing.customer) process.exit(1);
console.log('OK   read receipt + typing engine');
"

echo "✓ Faz 33 doğrulama geçti"
