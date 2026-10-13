/** Platform konsolu — kiracı cari, ödeme uyarıları, takvim (sunucu tarafı özet) */

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToKey(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

function getPaymentReminderAlerts(reminders, asOf = todayKey()) {
  const pending = (reminders ?? []).filter((item) => item?.status === 'pending');
  const tomorrow = addDaysToKey(asOf, 1);
  return {
    overdue: pending.filter((item) => item.dueDate < asOf),
    dueToday: pending.filter((item) => item.dueDate === asOf),
    dueTomorrow: pending.filter((item) => item.dueDate === tomorrow),
  };
}

export function summarizeReceivables(store) {
  const ledger = Array.isArray(store?.customerLedger) ? store.customerLedger : [];
  const customers = Array.isArray(store?.customers) ? store.customers : [];
  const byCustomer = new Map();
  for (const entry of ledger) {
    const id = entry?.customerId;
    if (!id) continue;
    byCustomer.set(id, (byCustomer.get(id) ?? 0) + (Number(entry.amount) || 0));
  }

  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let collections30dTry = 0;
  for (const entry of ledger) {
    const amount = Number(entry.amount) || 0;
    const t = Date.parse(entry?.createdAt ?? '');
    if (!Number.isFinite(t) || t < monthAgo) continue;
    if (entry.type === 'payment' || amount < 0) {
      collections30dTry += Math.abs(amount);
    }
  }

  let receivablesTotalTry = 0;
  let debtorsCount = 0;
  const topDebtors = [];
  for (const [customerId, balance] of byCustomer) {
    if (balance <= 0.005) continue;
    receivablesTotalTry += balance;
    debtorsCount += 1;
    const customer = customers.find((c) => c.id === customerId);
    topDebtors.push({
      customerId,
      name: String(customer?.name ?? customerId).trim() || customerId,
      balanceTry: Math.round(balance * 100) / 100,
    });
  }
  topDebtors.sort((a, b) => b.balanceTry - a.balanceTry);

  return {
    receivablesTotalTry: Math.round(receivablesTotalTry * 100) / 100,
    debtorsCount,
    collections30dTry: Math.round(collections30dTry * 100) / 100,
    topDebtors: topDebtors.slice(0, 8),
  };
}

export function summarizePaymentObligations(store, asOf = todayKey()) {
  const reminders = Array.isArray(store?.settings?.paymentReminders)
    ? store.settings.paymentReminders
    : [];
  const alerts = getPaymentReminderAlerts(reminders, asOf);
  const pending = reminders.filter((r) => r?.status === 'pending');
  const pendingAmountTry = pending.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const overdueAmountTry = alerts.overdue.reduce((s, r) => s + (Number(r.amount) || 0), 0);

  return {
    pendingPaymentCount: pending.length,
    pendingPaymentAmountTry: Math.round(pendingAmountTry * 100) / 100,
    overduePaymentCount: alerts.overdue.length,
    overduePaymentAmountTry: Math.round(overdueAmountTry * 100) / 100,
    dueTodayCount: alerts.dueToday.length,
    dueTomorrowCount: alerts.dueTomorrow.length,
  };
}

export function buildTenantPlatformAlerts(tenantId, businessName, store, asOf = todayKey()) {
  const alerts = [];
  const receivables = summarizeReceivables(store);
  const payments = summarizePaymentObligations(store, asOf);
  const threshold = Number(store?.settings?.lowStockThreshold) || 10;
  const products = Array.isArray(store?.products) ? store.products : [];
  const lowStock = products.filter((p) => (Number(p?.stock) || 0) <= threshold).length;

  if (payments.overduePaymentCount > 0) {
    alerts.push({
      severity: 'critical',
      kind: 'payment_overdue',
      tenantId,
      businessName,
      message: `${payments.overduePaymentCount} gecikmiş ödeme (₺${payments.overduePaymentAmountTry.toLocaleString('tr-TR')})`,
      count: payments.overduePaymentCount,
      amountTry: payments.overduePaymentAmountTry,
    });
  }
  if (payments.dueTodayCount > 0) {
    alerts.push({
      severity: 'warning',
      kind: 'payment_due_today',
      tenantId,
      businessName,
      message: `Bugün vadesi gelen ${payments.dueTodayCount} ödeme`,
      count: payments.dueTodayCount,
    });
  }
  if (receivables.receivablesTotalTry > 0) {
    alerts.push({
      severity: receivables.receivablesTotalTry >= 50_000 ? 'warning' : 'info',
      kind: 'receivables_open',
      tenantId,
      businessName,
      message: `Açık cari alacak: ₺${receivables.receivablesTotalTry.toLocaleString('tr-TR')} (${receivables.debtorsCount} müşteri)`,
      amountTry: receivables.receivablesTotalTry,
      count: receivables.debtorsCount,
    });
  }
  if (lowStock > 0) {
    alerts.push({
      severity: lowStock >= 5 ? 'warning' : 'info',
      kind: 'low_stock',
      tenantId,
      businessName,
      message: `${lowStock} ürün düşük stokta`,
      count: lowStock,
    });
  }
  const users = Array.isArray(store?.users) ? store.users : [];
  const missingEmail = users.filter(
    (u) => u.isActive !== false && !String(u.recoveryEmail ?? '').includes('@'),
  ).length;
  if (missingEmail > 0) {
    alerts.push({
      severity: 'warning',
      kind: 'security_recovery_email',
      tenantId,
      businessName,
      message: `${missingEmail} aktif kullanıcıda şifre sıfırlama e-postası eksik`,
      count: missingEmail,
    });
  }

  return alerts;
}

export function getRemindersForMonth(reminders, year, monthIndex) {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  return (reminders ?? [])
    .filter((item) => item?.dueDate?.startsWith(prefix))
    .sort((a, b) => {
      const dateCmp = a.dueDate.localeCompare(b.dueDate);
      if (dateCmp !== 0) return dateCmp;
      if (a.status === b.status) return String(a.title).localeCompare(String(b.title), 'tr');
      return a.status === 'pending' ? -1 : 1;
    });
}

export function buildMergedCalendarItems(storesByTenant, year, monthIndex) {
  const items = [];
  for (const [tenantId, meta] of storesByTenant) {
    const store = meta.store;
    const businessName = meta.businessName;
    const reminders = Array.isArray(store?.settings?.paymentReminders)
      ? store.settings.paymentReminders
      : [];
    for (const reminder of getRemindersForMonth(reminders, year, monthIndex)) {
      items.push({
        tenantId,
        businessName,
        id: reminder.id,
        title: reminder.title,
        amount: Number(reminder.amount) || 0,
        dueDate: reminder.dueDate,
        category: reminder.category,
        scope: reminder.scope,
        status: reminder.status,
      });
    }
  }
  items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.businessName.localeCompare(b.businessName, 'tr'));
  return items;
}

export { todayKey, getPaymentReminderAlerts };
