import type { PosUser } from '../types/user';
import type { LoginAuditEntry } from '../types/security';

export interface LoginUserChartRow {
  userKey: string;
  displayName: string;
  username: string;
  successCount: number;
  failedCount: number;
  share: number;
}

function buildLoginUserBuckets(
  logins: LoginAuditEntry[],
  knownUsers: PosUser[],
): LoginUserChartRow[] {
  const nameById = new Map(knownUsers.map((user) => [user.id, user]));
  const nameByUsername = new Map(knownUsers.map((user) => [user.username, user]));

  const buckets = new Map<string, {
    displayName: string;
    username: string;
    successCount: number;
    failedCount: number;
  }>();

  for (const row of logins) {
    const userKey = row.userId || row.username;
    let bucket = buckets.get(userKey);
    if (!bucket) {
      const fromId = row.userId ? nameById.get(row.userId) : undefined;
      const fromUsername = nameByUsername.get(row.username);
      const profile = fromId ?? fromUsername;
      bucket = {
        displayName: row.displayName ?? profile?.displayName ?? row.username,
        username: row.username,
        successCount: 0,
        failedCount: 0,
      };
      buckets.set(userKey, bucket);
    }
    if (row.success) bucket.successCount += 1;
    else bucket.failedCount += 1;
  }

  const totalSuccess = [...buckets.values()].reduce((sum, row) => sum + row.successCount, 0) || 1;

  return [...buckets.entries()].map(([userKey, row]) => ({
    userKey,
    displayName: row.displayName,
    username: row.username,
    successCount: row.successCount,
    failedCount: row.failedCount,
    share: row.successCount / totalSuccess,
  }));
}

export function buildLoginUserChart(
  logins: LoginAuditEntry[],
  knownUsers: PosUser[] = [],
): LoginUserChartRow[] {
  return buildLoginUserBuckets(logins, knownUsers)
    .filter((row) => row.successCount > 0)
    .sort((a, b) => b.successCount - a.successCount);
}

/** Başarısız giriş denemeleri — kullanıcı bazında, pay toplam hatalı girişe göre */
export function buildFailedLoginUserChart(
  logins: LoginAuditEntry[],
  knownUsers: PosUser[] = [],
): LoginUserChartRow[] {
  const rows = buildLoginUserBuckets(logins, knownUsers).filter((row) => row.failedCount > 0);
  const totalFailed = rows.reduce((sum, row) => sum + row.failedCount, 0) || 1;
  return rows
    .map((row) => ({
      ...row,
      share: row.failedCount / totalFailed,
    }))
    .sort((a, b) => b.failedCount - a.failedCount);
}
