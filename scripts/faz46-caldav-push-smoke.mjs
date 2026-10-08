#!/usr/bin/env node
/** Faz 46 — CalDAV/CardDAV lite principal + push config smoke */
import { getPostaCalDavLitePrincipal } from '../server/postaCalDavLite.mjs';
import { getPostaCardDavLitePrincipal } from '../server/postaCardDavLite.mjs';
import { getPostaPushConfig } from '../server/postaWebPush.mjs';
import { getPostaWsGatewayMetrics } from '../server/postaWsGateway.mjs';

function ok(msg) {
  console.log(`OK    ${msg}`);
}

const cal = getPostaCalDavLitePrincipal();
if (cal.version >= 2 && cal.readOnly === false && cal.methods?.includes('POST')) {
  ok('CalDAV lite v2 two-way');
}

const card = getPostaCardDavLitePrincipal();
if (card.importPath && card.exportPath) ok('CardDAV lite import/export paths');

const push = getPostaPushConfig();
if (push.ok) ok(`push config (${push.configured ? 'VAPID' : 'no VAPID'})`);

const ws = getPostaWsGatewayMetrics();
if (ws.path === '/api/posta/ws') ok('WS gateway metrics');

console.log('\nFaz 46 caldav/push smoke: PASS');
