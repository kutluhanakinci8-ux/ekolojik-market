import type { LoginAuditEntry } from '../types/security';
import type { PosUser } from '../types/user';
import type { ActivityAuditEntry } from './activityAudit';

export interface UserSessionSummary {
  userId: string;
  username: string;
  displayName: string;
  isActive: boolean;
  totpEnabled: boolean;
  sessionCount: number;
  totalDurationMs: number;
  todayDurationMs: number;
  lastLoginAt?: string;
  isOnline: boolean;
}

export interface UserUsageOverview {
  activeAccountCount: number;
  passiveAccountCount: number;
  onlineCount: number;
  todayTotalDurationMs: number;
  allTimeTotalDurationMs: number;
  users: UserSessionSummary[];
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 dk';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} sa ${minutes} dk`;
  if (minutes > 0) return `${minutes} dk`;
  const seconds = Math.floor(ms / 1000);
  return `${seconds} sn`;
}

function getSessionDurationMs(
  login: LoginAuditEntry,
  activities: ActivityAuditEntry[],
  currentSessionId?: string,
  now = Date.now(),
): number {
  if (!login.sessionId) return 0;

  const sessionActivities = activities.filter((item) => item.sessionId === login.sessionId);
  const startMs = new Date(login.createdAt).getTime();
  const logout = sessionActivities.find((item) => item.action === 'logout');

  let endMs: number;
  if (logout) {
    endMs = new Date(logout.createdAt).getTime();
  } else if (login.sessionId === currentSessionId) {
    endMs = now;
  } else if (sessionActivities.length > 0) {
    endMs = sessionActivities.reduce(
      (max, item) => Math.max(max, new Date(item.createdAt).getTime()),
      startMs,
    );
  } else {
    endMs = startMs;
  }

  return Math.max(0, endMs - startMs);
}

export function buildUserUsageOverview(
  users: PosUser[],
  loginAuditLog: LoginAuditEntry[],
  activityAuditLog: ActivityAuditEntry[],
  currentSessionId?: string,
): UserUsageOverview {
  const now = Date.now();
  const todayStartMs = new Date().setHours(0, 0, 0, 0);

  const summaries = new Map<string, UserSessionSummary>(
    users.map((user) => [
      user.id,
      {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        isActive: user.isActive,
        totpEnabled: Boolean(user.totpEnabled),
        sessionCount: 0,
        totalDurationMs: 0,
        todayDurationMs: 0,
        lastLoginAt: undefined,
        isOnline: false,
      },
    ]),
  );

  let todayTotalDurationMs = 0;
  let allTimeTotalDurationMs = 0;

  const successfulLogins = loginAuditLog.filter((entry) => entry.success && entry.sessionId && entry.userId);

  for (const login of successfulLogins) {
    const summary = summaries.get(login.userId!);
    if (!summary) continue;

    const durationMs = getSessionDurationMs(login, activityAuditLog, currentSessionId, now);
    summary.sessionCount += 1;
    summary.totalDurationMs += durationMs;
    allTimeTotalDurationMs += durationMs;

    const loginMs = new Date(login.createdAt).getTime();
    if (loginMs >= todayStartMs) {
      summary.todayDurationMs += durationMs;
      todayTotalDurationMs += durationMs;
    }

    if (!summary.lastLoginAt || login.createdAt > summary.lastLoginAt) {
      summary.lastLoginAt = login.createdAt;
    }

    if (login.sessionId === currentSessionId) {
      summary.isOnline = true;
    }
  }

  const userList = Array.from(summaries.values()).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? '');
  });

  return {
    activeAccountCount: users.filter((user) => user.isActive).length,
    passiveAccountCount: users.filter((user) => !user.isActive).length,
    onlineCount: userList.filter((user) => user.isOnline).length,
    todayTotalDurationMs,
    allTimeTotalDurationMs,
    users: userList,
  };
}
