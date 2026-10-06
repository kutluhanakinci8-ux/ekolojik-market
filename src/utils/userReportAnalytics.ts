import type { ReportPeriod } from './analytics';
import type { LoginAuditEntry } from '../types/security';
import type { PosUser, UserRole } from '../types/user';
import type { ActivityAuditEntry } from './activityAudit';
import { filterAuditByPeriod } from './auditPeriodFilter';
import { buildLoginUserChart } from './securityLoginAnalytics';
import {
  buildUserUsageOverview,
  formatDuration,
  type UserSessionSummary,
  type UserUsageOverview,
} from './userUsageStats';

export interface UserPeriodMetrics {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  totpEnabled: boolean;
  isOnline: boolean;
  lastLoginAt?: string;
  periodLoginCount: number;
  periodDurationMs: number;
  periodActivityCount: number;
  totalDurationMs: number;
  sessionCount: number;
}

export interface UserReportChartRow {
  userKey: string;
  label: string;
  sublabel: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface UserReportDashboard {
  periodOverview: UserUsageOverview;
  users: UserPeriodMetrics[];
  periodLoginTotal: number;
  periodActivityTotal: number;
  periodDurationTotalMs: number;
  durationChart: UserReportChartRow[];
  loginChart: ReturnType<typeof buildLoginUserChart>;
  activityChart: UserReportChartRow[];
  roleChart: Array<{ role: UserRole; label: string; count: number; share: number }>;
  totpChart: Array<{ id: 'enabled' | 'disabled'; label: string; count: number; share: number }>;
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

function toChartRows(
  rows: Array<{ userKey: string; label: string; sublabel: string; value: number; displayValue: string }>,
): UserReportChartRow[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      ...row,
      share: row.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Yönetici',
  cashier: 'Kasiyer',
};

export function buildUserReportDashboard(
  users: PosUser[],
  loginAuditLog: LoginAuditEntry[],
  activityAuditLog: ActivityAuditEntry[],
  period: ReportPeriod,
  currentSessionId?: string,
): UserReportDashboard {
  const periodLogins = filterAuditByPeriod(loginAuditLog, period);
  const periodActivities = filterAuditByPeriod(activityAuditLog, period);
  const periodOverview = buildUserUsageOverview(
    users,
    periodLogins,
    periodActivities,
    currentSessionId,
  );

  const baseById = new Map(periodOverview.users.map((row) => [row.userId, row]));
  const activityCountByUser = new Map<string, number>();

  for (const entry of periodActivities) {
    const key = entry.userId || entry.username;
    activityCountByUser.set(key, (activityCountByUser.get(key) ?? 0) + 1);
  }

  const periodMetrics = new Map<string, { loginCount: number; durationMs: number }>();
  const successfulPeriodLogins = periodLogins.filter((row) => row.success && row.sessionId);

  for (const login of successfulPeriodLogins) {
    const userKey = login.userId || login.username;
    const bucket = periodMetrics.get(userKey) ?? { loginCount: 0, durationMs: 0 };
    bucket.loginCount += 1;
    bucket.durationMs += getSessionDurationMs(login, activityAuditLog, currentSessionId);
    periodMetrics.set(userKey, bucket);
  }

  const usersReport: UserPeriodMetrics[] = users.map((user) => {
    const base = baseById.get(user.id);
    const periodBucket = periodMetrics.get(user.id) ?? periodMetrics.get(user.username);
    const activityKey = activityCountByUser.get(user.id) ?? activityCountByUser.get(user.username) ?? 0;
    return {
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      totpEnabled: Boolean(user.totpEnabled),
      isOnline: base?.isOnline ?? false,
      lastLoginAt: base?.lastLoginAt,
      periodLoginCount: periodBucket?.loginCount ?? 0,
      periodDurationMs: periodBucket?.durationMs ?? 0,
      periodActivityCount: activityKey,
      totalDurationMs: base?.totalDurationMs ?? 0,
      sessionCount: base?.sessionCount ?? 0,
    };
  }).sort((a, b) => {
    if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
    return b.periodDurationMs - a.periodDurationMs;
  });

  const periodLoginTotal = successfulPeriodLogins.length;
  const periodActivityTotal = periodActivities.length;
  const periodDurationTotalMs = usersReport.reduce((sum, row) => sum + row.periodDurationMs, 0);

  const durationChart = toChartRows(
    usersReport.map((row) => ({
      userKey: row.userId,
      label: row.displayName,
      sublabel: `@${row.username}`,
      value: row.periodDurationMs,
      displayValue: formatDuration(row.periodDurationMs),
    })),
  );

  const activityChart = toChartRows(
    usersReport.map((row) => ({
      userKey: row.userId,
      label: row.displayName,
      sublabel: `@${row.username}`,
      value: row.periodActivityCount,
      displayValue: String(row.periodActivityCount),
    })),
  );

  const loginChart = buildLoginUserChart(periodLogins, users);

  const activeUsers = users.filter((user) => user.isActive);
  const roleTotals: Record<UserRole, number> = { admin: 0, cashier: 0 };
  for (const user of activeUsers) roleTotals[user.role] += 1;
  const roleSum = roleTotals.admin + roleTotals.cashier || 1;
  const roleChart = (['admin', 'cashier'] as UserRole[])
    .map((role) => ({
      role,
      label: ROLE_LABELS[role],
      count: roleTotals[role],
      share: roleTotals[role] / roleSum,
    }))
    .filter((row) => row.count > 0);

  const totpEnabled = activeUsers.filter((user) => user.totpEnabled).length;
  const totpDisabled = activeUsers.length - totpEnabled;
  const totpSum = activeUsers.length || 1;
  const totpChart = [
    { id: 'enabled' as const, label: '2FA açık', count: totpEnabled, share: totpEnabled / totpSum },
    { id: 'disabled' as const, label: '2FA kapalı', count: totpDisabled, share: totpDisabled / totpSum },
  ].filter((row) => row.count > 0);

  return {
    periodOverview,
    users: usersReport,
    periodLoginTotal,
    periodActivityTotal,
    periodDurationTotalMs,
    durationChart,
    loginChart,
    activityChart,
    roleChart,
    totpChart,
  };
}

export type { UserSessionSummary };
