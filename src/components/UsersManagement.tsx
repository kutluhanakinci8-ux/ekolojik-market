import { useMemo, useState } from 'react';
import { ALL_APP_PAGES, DEFAULT_CASHIER_TABS, USER_PERMISSION_TABS } from '../data/navigation';
import { isPosLiteProfile, POS_LITE_ADMIN_TABS, POS_LITE_CASHIER_TABS } from '../utils/tenantProductProfile';
import type { Store } from '../store/useStore';
import type { AppPage } from './AppShell';
import type { PosUser, UserRole } from '../types/user';
import { USER_ROLE_LABELS } from '../types/user';
import { AdminApprovalModal } from './AdminApprovalModal';

interface UsersManagementProps {
  store: Store;
}

interface UserFormState {
  displayName: string;
  username: string;
  password: string;
  pin: string;
  clearPin: boolean;
  role: UserRole;
  allowedTabs: AppPage[];
  isActive: boolean;
}

const EMPTY_FORM: UserFormState = {
  displayName: '',
  username: '',
  password: '',
  pin: '',
  clearPin: false,
  role: 'cashier',
  allowedTabs: [...DEFAULT_CASHIER_TABS],
  isActive: true,
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function UsersManagement({ store }: UsersManagementProps) {
  const posLite = isPosLiteProfile(store.settings);
  const defaultCashierTabs = posLite ? [...POS_LITE_CASHIER_TABS] : [...DEFAULT_CASHIER_TABS];
  const permissionTabs = useMemo(() => {
    if (!posLite) return USER_PERMISSION_TABS;
    const allowed = new Set(POS_LITE_CASHIER_TABS.concat(['dashboard', 'sales', 'stock', 'reports', 'transactions', 'settings']));
    return USER_PERMISSION_TABS.filter((item) => allowed.has(item.id));
  }, [posLite]);
  const adminTabsForProfile = posLite ? [...POS_LITE_ADMIN_TABS] : [...ALL_APP_PAGES];
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PosUser | null>(null);

  const sortedUsers = useMemo(
    () => [...store.users].sort((a, b) => a.displayName.localeCompare(b.displayName, 'tr')),
    [store.users],
  );

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, allowedTabs: defaultCashierTabs });
    setError(null);
  };

  const startEdit = (user: PosUser) => {
    setEditingId(user.id);
    setForm({
      displayName: user.displayName,
      username: user.username,
      password: '',
      pin: '',
      clearPin: false,
      role: user.role,
      allowedTabs: user.role === 'admin' ? adminTabsForProfile : [...user.allowedTabs],
      isActive: user.isActive,
    });
    setError(null);
    setMessage(null);
  };

  const toggleTab = (tab: AppPage) => {
    if (form.role === 'admin') return;
    setForm((prev) => ({
      ...prev,
      allowedTabs: prev.allowedTabs.includes(tab)
        ? prev.allowedTabs.filter((item) => item !== tab)
        : [...prev.allowedTabs, tab],
    }));
  };

  const handleRoleChange = (role: UserRole) => {
    setForm((prev) => ({
      ...prev,
      role,
      allowedTabs: role === 'admin' ? adminTabsForProfile : (prev.allowedTabs.length ? prev.allowedTabs : defaultCashierTabs),
    }));
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (editingId) {
        const result = await store.updateUser(editingId, {
          displayName: form.displayName,
          username: form.username,
          password: form.password || undefined,
          pin: form.pin || undefined,
          clearPin: form.clearPin,
          role: form.role,
          allowedTabs: form.role === 'admin' ? adminTabsForProfile : form.allowedTabs,
          isActive: form.isActive,
        });
        if (result) {
          setError(result);
          return;
        }
        setMessage('Kullanıcı güncellendi.');
      } else {
        const result = await store.addUser({
          displayName: form.displayName,
          username: form.username,
          password: form.password,
          pin: form.pin || undefined,
          role: form.role,
          allowedTabs: form.role === 'admin' ? adminTabsForProfile : form.allowedTabs,
          isActive: form.isActive,
        });
        if (result) {
          setError(result);
          return;
        }
        setMessage('Yeni kullanıcı oluşturuldu.');
      }
      resetForm();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = (user: PosUser) => {
    setDeleteTarget(user);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await store.removeUser(deleteTarget.id);
    setDeleteTarget(null);
    if (result) {
      setError(result);
      return;
    }
    if (editingId === deleteTarget.id) resetForm();
    setMessage('Kullanıcı silindi.');
  };

  const tabLabel = (tab: AppPage) => USER_PERMISSION_TABS.find((item) => item.id === tab)?.label ?? tab;

  return (
    <section className="settings-panel settings-panel--users">
      <AdminApprovalModal
        open={Boolean(deleteTarget)}
        title="Kullanıcı Silme Onayı"
        description={deleteTarget ? `${deleteTarget.displayName} kullanıcısını silmek için yönetici onayı gerekir.` : ''}
        reason="user_delete"
        store={store}
        onApproved={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="settings-panel-head">
        <div>
          <h2>Kullanıcı Yönetimi</h2>
          <p>Kasiyer hesapları, PIN ve sekme yetkileri</p>
        </div>
        <span className="settings-panel-count">{sortedUsers.length} kullanıcı</span>
      </div>

      {message && <p className="settings-flash">{message}</p>}
      {error && <p className="settings-flash settings-flash--error" role="alert">{error}</p>}

      <div className="users-layout users-layout--premium">
        <div className="users-form-card users-form-card--premium">
          <h3>{editingId ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
          <div className="settings-form-grid settings-form-grid--compact">
            <label className="settings-field">
              <span>Ad Soyad</span>
              <input
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
              />
            </label>
            <label className="settings-field">
              <span>Kullanıcı Adı</span>
              <input
                value={form.username}
                onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value.toLowerCase() }))}
                autoComplete="off"
              />
            </label>
            <label className="settings-field">
              <span>{editingId ? 'Yeni Şifre' : 'Şifre'}</span>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                autoComplete="new-password"
                placeholder={editingId ? 'Boş bırakılabilir' : ''}
              />
            </label>
            {form.role === 'cashier' && (
              <label className="settings-field">
                <span>{editingId ? 'Yeni PIN (6 hane)' : 'Kasiyer PIN'}</span>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => setForm((prev) => ({ ...prev, pin: e.target.value.replace(/\D/g, '').slice(0, 6), clearPin: false }))}
                  autoComplete="off"
                  placeholder="6 haneli"
                />
              </label>
            )}
            <label className="settings-field">
              <span>Rol</span>
              <select value={form.role} onChange={(e) => handleRoleChange(e.target.value as UserRole)}>
                <option value="cashier">Kasiyer</option>
                <option value="admin">Yönetici</option>
              </select>
            </label>
          </div>

          {form.role === 'cashier' && (
            <div className="users-tabs-picker users-tabs-picker--premium">
              <span className="users-tabs-label">Görünecek Sekmeler</span>
              <div className="users-tabs-pills">
                {permissionTabs.map((item) => {
                  const active = form.allowedTabs.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`users-tab-pill ${active ? 'is-active' : ''}`}
                      onClick={() => toggleTab(item.id)}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="users-toggles">
            {editingId && form.role === 'cashier' && (
              <label className="users-toggle-row">
                <input
                  type="checkbox"
                  checked={form.clearPin}
                  onChange={(e) => setForm((prev) => ({ ...prev, clearPin: e.target.checked, pin: '' }))}
                />
                <span>PIN&apos;i kaldır</span>
              </label>
            )}
            <label className="users-toggle-row">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>Aktif kullanıcı</span>
            </label>
          </div>

          <div className="users-form-actions">
            <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
              {busy ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kullanıcı Ekle'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-outline" onClick={resetForm}>
                İptal
              </button>
            )}
          </div>
        </div>

        <div className="users-list-card users-list-card--premium">
          <h3>Kayıtlı Kullanıcılar</h3>
          <div className="users-list users-list--premium">
            {sortedUsers.map((user) => (
              <article key={user.id} className={`users-list-item users-list-item--premium ${!user.isActive ? 'is-inactive' : ''}`}>
                <div className="users-list-main">
                  <span className={`users-avatar users-avatar--${user.role}`} aria-hidden>
                    {userInitials(user.displayName)}
                  </span>
                  <div className="users-list-body">
                    <div className="users-list-top">
                      <strong>{user.displayName}</strong>
                      <span className={`users-role-badge users-role-badge--${user.role}`}>
                        {USER_ROLE_LABELS[user.role]}
                      </span>
                    </div>
                    <span className="users-list-meta">@{user.username}</span>
                    {user.role === 'cashier' && (
                      <div className="users-list-tabs">
                        {user.allowedTabs.map((tab) => (
                          <span key={tab} className="users-list-tab-chip">{tabLabel(tab)}</span>
                        ))}
                      </div>
                    )}
                    {!user.isActive && <span className="users-inactive-label">Pasif</span>}
                  </div>
                </div>
                <div className="users-list-actions">
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => startEdit(user)}>
                    Düzenle
                  </button>
                  {user.id !== store.authSession?.userId && (
                    <button type="button" className="btn btn-sm btn-danger-soft" onClick={() => handleDelete(user)}>
                      Sil
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
