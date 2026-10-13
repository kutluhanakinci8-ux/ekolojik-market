/** İstemciye giden mağaza snapshot — şifre hash'leri döndürülmez. */
export function sanitizeStoreSnapshotForClient(store) {
  if (!store || typeof store !== 'object') return store ?? {};
  if (!Array.isArray(store.users)) return { ...store };
  const users = store.users.map((user) => {
    if (!user || typeof user !== 'object') return user;
    const { passwordHash, pinHash, totpSecret, ...safe } = user;
    return safe;
  });
  return { ...store, users };
}

/** PUT ile gelen kullanıcı kayıtlarında boş bırakılan secret alanları diskteki değerle koru. */
export function mergeStoreUserSecrets(existing, incoming) {
  if (!incoming || typeof incoming !== 'object') return incoming;
  if (!Array.isArray(incoming.users) || !Array.isArray(existing?.users)) {
    return incoming;
  }
  const byId = new Map(existing.users.map((u) => [u.id, u]));
  const byUsername = new Map(
    existing.users.map((u) => [String(u.username ?? '').trim().toLowerCase(), u]),
  );
  const users = incoming.users.map((user) => {
    const prev = byId.get(user.id) ?? byUsername.get(String(user.username ?? '').trim().toLowerCase());
    if (!prev) return user;
    const next = { ...user };
    const keepSecret = (field) => {
      const incomingVal = next[field];
      const prevVal = prev[field];
      if ((!incomingVal || incomingVal === '') && prevVal) next[field] = prevVal;
    };
    keepSecret('passwordHash');
    keepSecret('pinHash');
    keepSecret('totpSecret');
    return next;
  });
  return { ...incoming, users };
}
