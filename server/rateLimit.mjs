const buckets = new Map();

export function checkRateLimit(key, { limit = 120, windowMs = 60_000 } = {}) {
  const now = Date.now();
  let row = buckets.get(key);
  if (!row || now >= row.resetAt) {
    row = { count: 0, resetAt: now + windowMs };
    buckets.set(key, row);
  }
  row.count += 1;
  if (row.count > limit) {
    return { ok: false, retryAfterMs: row.resetAt - now };
  }
  return { ok: true, remaining: limit - row.count };
}
