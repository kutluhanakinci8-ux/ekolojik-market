import { useEffect, useMemo, useState } from 'react';
import { ALL_APP_PAGES, DEFAULT_CASHIER_TABS, NAV_ITEMS } from '../data/navigation';
import type { Store } from '../store/useStore';
import type { AppPage } from './AppShell';
import type { PosUser, UserRole } from '../types/user';
import { USER_ROLE_LABELS } from '../types/user';
import { buildUserUsageOverview, formatDuration, type UserSessionSummary } from '../utils/userUsageStats';
import { AdminApprovalModal } from './AdminApprovalModal';
import { SwipeableUserActivityRow } from './SwipeableUserActivityRow';
import { UserLoginRecordModal } from './UserLoginRecordModal';

interface DashboardUserActivitySectionProps {
  store: Store;
  isPrimaryAdmin: boolean;
}

interface EditFormState {
  displayName: string;
  username: string;
  password: string;
  role: UserRole;
  isActive: boolean;
}

export function DashboardUserActivitySection({
  store,
  isPrimaryAdmin,
}: DashboardUserActivitySectionProps) {
  const [userMessage, setUserMessage] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<PosUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PosUser | null>(null);
  const [loginRecordUser, setLoginRecordUser] = useState<UserSessionSummary | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({
    displayName: '',
    username: '',
    password: '',
    role: 'cashier',
    isActive: true,
  });
  const [editBusy, setEditBusy] = useState(false);

  const usage = useMemo(
    () => buildUserUsageOverview(
      store.users,
      store.loginAuditLog,
      store.activityAuditLog,
      store.authSession?.sessionId,
    ),
    [store.users, store.loginAuditLog, store.activityAuditLog, store.authSession?.sessionId],
  );

  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.user-activity-swipe')) {
        setOpenRowId(null);
      }
    };
    document.addEventListener('click', closeOnOutside);
    return () => document.removeEventListener('click', closeOnOutside);
  }, []);

  const startEdit = (user: PosUser) => {
    setOpenRowId(null);
    setEditingUser(user);
    setEditForm({
      displayName: user.displayName,
      username: user.username,
      password: '',
      role: user.role,
      isActive: user.isActive,
    });
    setUserError(null);
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    setEditBusy(true);
    setUserError(null);
    setUserMessage(null);
    try {
      const result = await store.updateUser(editingUser.id, {
        displayName: editForm.displayName,
        username: editForm.username,
        password: editForm.password || undefined,
        role: editForm.role,
        allowedTabs: editForm.role === 'admin'
          ? ALL_APP_PAGES
          : (editingUser.allowedTabs.length ? editingUser.allowedTabs : DEFAULT_CASHIER_TABS),
        isActive: editForm.isActive,
      });
      if (result) {
        setUserError(result);
        return;
      }
      setUserMessage(`${editForm.displayName} güncellendi.`);
      setEditingUser(null);
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await store.removeUser(deleteTarget.id);
    setDeleteTarget(null);
    setOpenRowId(null);
    if (result) {
      setUserError(result);
      return;
    }
    setUserMessage(`${deleteTarget.displayName} silindi.`);
  };

  const toggleLock = (userId: string, displayName: string, isActive: boolean) => {
    setOpenRowId(null);
    setUserMessage(null);
    setUserError(null);
    const result = isActive ? store.lockUserAccess(userId) : store.unlockUserAccess(userId);
    if (result) {
      setUserError(result);
      return;
    }
    setUserMessage(isActive
      ? `${displayName} kullanıcısının giriş izni kilitlendi.`
      : `${displayName} kullanıcısının giriş izni yeniden açıldı.`);
  };

  const tabLabel = (tab: AppPage) => NAV_ITEMS.find((item) => item.id === tab)?.label ?? tab;

  return (
    <section className="dashboard-card dashboard-card--wide dashboard-user-usage-card">
      <AdminApprovalModal
        open={Boolean(deleteTarget)}
        title="Kullanıcı Silme Onayı"
        description={deleteTarget ? `${deleteTarget.displayName} kullanıcısını silmek için yönetici onayı gerekir.` : ''}
        reason="user_delete"
        store={store}
        onApproved={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {loginRecordUser && (
        <UserLoginRecordModal
          store={store}
          userId={loginRecordUser.userId}
          displayName={loginRecordUser.displayName}
          username={loginRecordUser.username}
          onClose={() => setLoginRecordUser(null)}
        />
      )}

      {editingUser && (
        <div className="user-activity-edit-backdrop" role="presentation" onClick={() => setEditingUser(null)}>
          <div
            className="user-activity-edit-modal"
            role="dialog"
            aria-labelledby="user-activity-edit-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="user-activity-edit-title">Kullanıcı Düzenle</h3>
            <p className="module-hint">@{editingUser.username}</p>

            <label className="settings-field">
              Ad Soyad
              <input
                value={editForm.displayName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </label>
            <label className="settings-field">
              Kullanıcı adı
              <input
                value={editForm.username}
                onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </label>
            <label className="settings-field">
              Yeni şifre (opsiyonel)
              <input
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Boş bırakılırsa değişmez"
              />
            </label>
            <label className="settings-field">
              Rol
              <select
                value={editForm.role}
                onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value as UserRole }))}
                disabled={editingUser.isPrimaryAdmin}
              >
                <option value="cashier">{USER_ROLE_LABELS.cashier}</option>
                <option value="admin">{USER_ROLE_LABELS.admin}</option>
              </select>
            </label>
            <label className="settings-field settings-field--checkbox">
              <input
                type="checkbox"
                checked={editForm.isActive}
                onChange={(e) => setEditForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                disabled={editingUser.isPrimaryAdmin}
              />
              Hesap aktif
            </label>

            {editForm.role === 'cashier' && (
              <p className="module-hint">
                Sekmeler: {DEFAULT_CASHIER_TABS.map(tabLabel).join(', ')} — detaylı yetki için Ayarlar → Kullanıcılar
              </p>
            )}

            <div className="user-activity-edit-actions">
              <button type="button" className="btn btn-outline" onClick={() => setEditingUser(null)}>
                İptal
              </button>
              <button type="button" className="btn btn-primary" onClick={saveEdit} disabled={editBusy}>
                {editBusy ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-card-header">
        <div>
          <h2>Kullanıcı Aktivitesi</h2>
          <span className="dashboard-card-subtitle">
            Hesap durumu ve oturum süreleri — satırı sola kaydırarak işlem menüsünü açın
          </span>
        </div>
      </div>

      <div className="dashboard-user-usage-summary">
        <div className="dashboard-user-usage-stat dashboard-user-usage-stat--active">
          <span>Aktif Hesap</span>
          <strong>{usage.activeAccountCount}</strong>
        </div>
        <div className="dashboard-user-usage-stat dashboard-user-usage-stat--passive">
          <span>Pasif / Kilitli</span>
          <strong>{usage.passiveAccountCount}</strong>
        </div>
        <div className="dashboard-user-usage-stat dashboard-user-usage-stat--online">
          <span>Şu An Oturumda</span>
          <strong>{usage.onlineCount}</strong>
        </div>
        <div className="dashboard-user-usage-stat">
          <span>Bugün Toplam Süre</span>
          <strong>{formatDuration(usage.todayTotalDurationMs)}</strong>
        </div>
        <div className="dashboard-user-usage-stat">
          <span>Toplam Kullanım</span>
          <strong>{formatDuration(usage.allTimeTotalDurationMs)}</strong>
        </div>
      </div>

      {userMessage && <p className="settings-flash">{userMessage}</p>}
      {userError && <p className="settings-flash settings-flash--error" role="alert">{userError}</p>}

      <div className="dashboard-user-usage-list-wrap">
        <div className="user-activity-list-head" aria-hidden>
          <span>Kullanıcı</span>
          <span>Hesap</span>
          <span>2FA</span>
          <span>Durum</span>
          <span>Oturum</span>
          <span>Bugün</span>
          <span>Toplam</span>
          <span>Son Giriş</span>
        </div>

        <div className="user-activity-list">
          {usage.users.map((user) => {
            const account = store.users.find((item) => item.id === user.userId);
            const isPrimary = Boolean(account?.isPrimaryAdmin);

            return (
              <SwipeableUserActivityRow
                key={user.userId}
                user={user}
                isPrimary={isPrimary}
                canManage={isPrimaryAdmin}
                isOpen={openRowId === user.userId}
                onOpen={() => setOpenRowId(user.userId)}
                onClose={() => setOpenRowId(null)}
                onEdit={() => account && startEdit(account)}
                onToggleLock={() => toggleLock(user.userId, user.displayName, user.isActive)}
                onDelete={() => account && setDeleteTarget(account)}
                onLoginRecord={() => {
                  setOpenRowId(null);
                  setLoginRecordUser(user);
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
