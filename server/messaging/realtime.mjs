const TYPING_TTL_MS = 8000;

/** @type {Map<string, { staff?: number; customer?: number }>} */
const typingByKey = new Map();

function typingKey(tenantId, threadId) {
  return `${tenantId || 'main'}:${threadId}`;
}

export function getMessagingRealtimeCapabilities() {
  return {
    ok: true,
    version: 1,
    typingTtlMs: TYPING_TTL_MS,
    readReceipts: true,
    parties: ['staff', 'customer'],
  };
}

export function setMessagingTyping(tenantId, threadId, party, active) {
  const key = typingKey(tenantId, threadId);
  const row = typingByKey.get(key) ?? {};
  const side = party === 'customer' ? 'customer' : 'staff';
  if (active) {
    row[side] = Date.now() + TYPING_TTL_MS;
  } else {
    delete row[side];
  }
  if (!row.staff && !row.customer) typingByKey.delete(key);
  else typingByKey.set(key, row);
  return getMessagingTyping(tenantId, threadId);
}

export function getMessagingTyping(tenantId, threadId) {
  const key = typingKey(tenantId, threadId);
  const row = typingByKey.get(key);
  const now = Date.now();
  if (!row) {
    return { ok: true, staff: false, customer: false, expiresAt: null };
  }
  const staff = Boolean(row.staff && row.staff > now);
  const customer = Boolean(row.customer && row.customer > now);
  if (!staff && !customer) typingByKey.delete(key);
  return {
    ok: true,
    staff,
    customer,
    expiresAt: new Date(now + TYPING_TTL_MS).toISOString(),
  };
}
