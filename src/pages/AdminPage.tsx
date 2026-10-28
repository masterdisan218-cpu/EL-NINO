import React, { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ChevronDown, Eye, EyeOff, ImagePlus, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { useUpdates } from '../context/UpdatesContext';
import type { AdminRole, AuthenticatedAdmin } from '../context/UpdatesContext';
import { CMSContentEntry, ContentKind } from '../types';
import { apiRequest } from '../services/contentApi';

type EntryDraft = Omit<CMSContentEntry, 'id' | 'updatedAt'>;

const emptyDraft = (): EntryDraft => ({
  kind: 'content',
  titleEn: '',
  titleTe: '',
  titleEs: '',
  descriptionEn: '',
  descriptionTe: '',
  descriptionEs: '',
  date: new Date().toISOString().slice(0, 10),
  imageUrl: '',
  category: '',
  sourceName: '',
  sourceUrl: '',
  linkUrl: '',
  price: '',
  offer: '',
  offerTe: '',
  offerEs: '',
  recommendedFor: '',
  recommendedForTe: '',
  recommendedForEs: '',
  badge: '',
  pagePath: '/',
  seoTitleEn: '',
  seoTitleTe: '',
  seoTitleEs: '',
  seoDescriptionEn: '',
  seoDescriptionTe: '',
  seoDescriptionEs: '',
  availableCountries: '',
  climateRisks: '',
  currency: '',
  offerExpiresAt: '',
  scheduledAt: '',
  published: false,
});

const labels: Record<ContentKind, string> = {
  update: 'Daily update',
  product: 'Product',
  page: 'Page settings',
  content: 'Text or link',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-ocean-500 focus:outline-none focus:ring-2 focus:ring-ocean-200';

interface AdminSummary {
  publishedProducts: number;
  publishedUpdates: number;
  drafts: number;
  visitorViews: number;
  recentActivity: Array<{ action: string; contentId: string; createdAt: string }>;
}

interface AdminMediaItem {
  imageUrl: string;
  updatedAt: string;
}

interface ManagedUser extends AuthenticatedAdmin {
  active: boolean;
  createdAt: string;
}

const configurablePages = [
  { path: '/global-impact-safety', label: 'Global Impact & Safety' },
  { path: '/products', label: 'Products' },
  { path: '/about-sources', label: 'About & Sources' },
];

const asLocalDateTime = (value: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const AdminPage: React.FC = () => {
  const {
    adminEntries,
    authenticatedAdmin,
    authReady,
    contentError,
    createEntry,
    deleteEntry,
    isAdminAuthenticated,
    loginAdmin,
    logoutAdmin,
    refreshAdminContent,
    refreshPublicSettings,
    updateEntry,
    uploadImage,
    csrfToken,
  } = useUpdates();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loginError, setLoginError] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [preview, setPreview] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<AdminMediaItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [newRole, setNewRole] = useState<Exclude<AdminRole, 'admin'>>('editor');
  const [visiblePages, setVisiblePages] = useState<string[]>(['/global-impact-safety', '/products', '/about-sources']);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const canEditContent = authenticatedAdmin?.role === 'admin' || authenticatedAdmin?.role === 'editor';
  const isAdministrator = authenticatedAdmin?.role === 'admin';

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    setLoadingEntries(true);
    void refreshAdminContent()
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not load saved content.'))
      .finally(() => setLoadingEntries(false));
  }, [isAdminAuthenticated, refreshAdminContent]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    void apiRequest<AdminSummary>('/api/admin/summary')
      .then(setSummary)
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not load dashboard metrics.'));
  }, [adminEntries, isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated) return;
    void apiRequest<AdminMediaItem[]>('/api/admin/media')
      .then(setMediaLibrary)
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not load the media library.'));
  }, [isAdminAuthenticated]);

  useEffect(() => {
    if (!isAdminAuthenticated || !isAdministrator) return;
    void apiRequest<ManagedUser[]>('/api/admin/users')
      .then(setUsers)
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not load accounts.'));
    void apiRequest<{ visiblePages: string[] }>('/api/admin/settings')
      .then((settings) => setVisiblePages(settings.visiblePages.filter((path) => path !== '/')))
      .catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not load website settings.'));
  }, [isAdminAuthenticated, isAdministrator]);

  const setField = <K extends keyof EntryDraft>(key: K, value: EntryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError('');
    try {
      await loginAdmin(username, password);
      setUsername('');
      setPassword('');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Administrator sign-in failed.');
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    setFormError('');
    try {
      const settings = await apiRequest<{ visiblePages: string[] }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ visiblePages }),
      }, csrfToken);
      setVisiblePages(settings.visiblePages.filter((path) => path !== '/'));
      await refreshPublicSettings();
      setSettingsSaved(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save website settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const createUser = async (event: FormEvent) => {
    event.preventDefault();
    setCreatingUser(true);
    setFormError('');
    try {
      const created = await apiRequest<ManagedUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      }, csrfToken);
      setUsers((current) => [...current, created].sort((a, b) => a.username.localeCompare(b.username)));
      setNewUsername('');
      setNewPassword('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create this account.');
    } finally {
      setCreatingUser(false);
    }
  };

  const updateUser = async (user: ManagedUser, changes: { role?: Exclude<AdminRole, 'admin'>; active?: boolean; password?: string }) => {
    setFormError('');
    try {
      const updated = await apiRequest<ManagedUser>(`/api/admin/users/${encodeURIComponent(user.username)}`, {
        method: 'PATCH',
        body: JSON.stringify(changes),
      }, csrfToken);
      setUsers((current) => current.map((item) => item.username === updated.username ? updated : item));
      return true;
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update this account.');
      return false;
    }
  };

  const startNew = () => {
    setEditingId('');
    setDraft(emptyDraft());
    setFormError('');
    setPreview(false);
  };

  const startEdit = (entry: CMSContentEntry) => {
    const { id, updatedAt, publishedAt, expiresAt, ...content } = entry;
    void updatedAt;
    void publishedAt;
    void expiresAt;
    setEditingId(id);
    setDraft(content);
    setFormError('');
    setPreview(false);
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      if (editingId) await updateEntry(editingId, draft);
      else await createEntry(draft);
      startNew();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not save this content.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: CMSContentEntry) => {
    if (!window.confirm(`Delete "${entry.titleEn || labels[entry.kind]}" permanently?`)) return;
    setFormError('');
    try {
      await deleteEntry(entry.id);
      if (editingId === entry.id) startNew();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not delete this content.');
    }
  };

  const togglePublished = async (entry: CMSContentEntry) => {
    const { id, updatedAt, publishedAt, expiresAt, ...content } = entry;
    void updatedAt;
    void publishedAt;
    void expiresAt;
    try {
      await updateEntry(id, { ...content, published: !entry.published });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not change publishing status.');
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setFormError('');
    try {
      const imageUrl = await uploadImage(file);
      setField('imageUrl', imageUrl);
      setMediaLibrary((current) => [{ imageUrl, updatedAt: new Date().toISOString() }, ...current]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not upload this image.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const filteredEntries = adminEntries.filter((entry) =>
    `${entry.titleEn} ${entry.descriptionEn} ${entry.kind}`.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!authReady) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-600">Checking administrator session…</div>;
  }

  if (!isAdminAuthenticated) {
    return (
      <main className="min-h-[70vh] bg-gradient-to-br from-red-50/80 via-orange-50/40 to-blue-50/80 px-4 py-14 sm:py-20">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ocean-700 hover:text-ocean-900">
            <ArrowLeft className="h-4 w-4" /> Back to website
          </Link>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ocean-100 text-ocean-700">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Private admin</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">Sign in to edit content, preview drafts, and publish updates to the website.</p>
          </div>
          {(loginError || contentError) && (
            <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {loginError || contentError}
            </p>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <label className="block text-sm font-semibold text-slate-700">
              Username
              <input autoComplete="username" required maxLength={48} value={username} onChange={(event) => setUsername(event.target.value)} className={`${inputClass} mt-1.5`} />
            </label>
            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={`${inputClass} mt-1.5`} />
            </label>
            <button className="w-full rounded-xl bg-ocean-600 px-4 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-ocean-700">Sign in securely</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/" className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ocean-700"><ArrowLeft className="h-4 w-4" /> View website</Link>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Seller content dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">Manage verified website content, review drafts, and publish updates.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="relative order-3 w-full sm:order-none sm:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search saved content" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search content..." className={`${inputClass} pl-9`} />
            </label>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ocean-100 text-xs font-bold uppercase text-ocean-800">{authenticatedAdmin?.username.slice(0, 2) || 'AD'}</span>
                <span className="hidden sm:inline">{authenticatedAdmin?.username}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </summary>
              <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
                <p className="font-semibold text-slate-800">{authenticatedAdmin?.username}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">Role: {authenticatedAdmin?.role}</p>
                <Link to="/" className="mt-3 block rounded-lg px-2 py-2 text-xs font-semibold text-ocean-700 hover:bg-slate-50">Return to public website</Link>
              </div>
            </details>
            <button onClick={() => void logoutAdmin().catch((error: unknown) => setFormError(error instanceof Error ? error.message : 'Could not sign out.'))} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        {(formError || contentError) && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {formError || contentError}
          </p>
        )}

        <section id="overview" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Dashboard overview">
          {[
            { label: 'Visitor views · 30 days', value: summary?.visitorViews ?? '—' },
            { label: 'Sales', value: 'Not connected' },
            { label: 'Published products', value: summary?.publishedProducts ?? '—' },
            { label: 'Published updates', value: summary?.publishedUpdates ?? '—' },
            { label: 'Private drafts', value: summary?.drafts ?? '—' },
          ].map((metric) => (
            <article key={metric.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{metric.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Recent activity">
          <h2 className="font-bold text-slate-900">Recent activity</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
            {(summary?.recentActivity || []).slice(0, 5).map((activity, index) => (
              <p key={`${activity.createdAt}-${index}`} className="min-w-[150px] text-xs text-slate-600">
                <span className="block font-semibold text-slate-800">{activity.action}</span>
                <time dateTime={activity.createdAt}>{new Date(activity.createdAt).toLocaleString()}</time>
              </p>
            ))}
            {summary?.recentActivity.length === 0 && <p className="text-sm text-slate-500">No recent changes.</p>}
          </div>
        </section>

        {isAdministrator && (
          <section id="workspace-settings" className="grid gap-6 xl:grid-cols-2" aria-label="Website settings and accounts">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">Page visibility</h2>
              <p className="mt-1 text-sm text-slate-600">The homepage remains available. Hidden pages are removed from navigation and their routes show an unavailable message.</p>
              <form onSubmit={saveSettings} className="mt-4 space-y-3">
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Home <span className="font-semibold text-emerald-700">Always visible</span></p>
                {configurablePages.map((page) => (
                  <label key={page.path} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                    <span>{page.label}</span>
                    <input
                      type="checkbox"
                      checked={visiblePages.includes(page.path)}
                      onChange={() => {
                        setSettingsSaved(false);
                        setVisiblePages((current) => current.includes(page.path)
                          ? current.filter((path) => path !== page.path)
                          : [...current, page.path]);
                      }}
                      className="h-4 w-4 rounded text-ocean-600"
                    />
                  </label>
                ))}
                <div className="flex items-center justify-end gap-3 pt-2">
                  {settingsSaved && <span role="status" className="text-sm text-emerald-700">Settings saved.</span>}
                  <button disabled={savingSettings} className="rounded-xl bg-ocean-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-ocean-700 disabled:opacity-60">
                    {savingSettings ? 'Saving…' : 'Save visibility'}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">Accounts & roles</h2>
              <p className="mt-1 text-sm text-slate-600">Administrators manage accounts and settings; administrators and editors can change content; viewers have read-only access. Visitors have no dashboard access.</p>
              <form onSubmit={createUser} className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-700">Username
                  <input required minLength={3} maxLength={48} pattern="[A-Za-z0-9._-]+" autoComplete="off" value={newUsername} onChange={(event) => setNewUsername(event.target.value)} className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-slate-700">Initial password (12+ characters)
                  <input required minLength={12} maxLength={256} type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={`${inputClass} mt-1.5`} />
                </label>
                <label className="text-sm font-semibold text-slate-700">Role
                  <select value={newRole} onChange={(event) => setNewRole(event.target.value as Exclude<AdminRole, 'admin'>)} className={`${inputClass} mt-1.5`}>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button disabled={creatingUser} className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">
                    {creatingUser ? 'Creating…' : 'Create account'}
                  </button>
                </div>
              </form>
              <ul className="mt-5 divide-y divide-slate-100">
                {users.map((user) => (
                  <li key={user.username} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">{user.username}</p>
                      <p className="text-xs capitalize text-slate-500">{user.role} · {user.active ? 'Active' : 'Disabled'}</p>
                    </div>
                    {user.role !== 'admin' && (
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Role for ${user.username}`}
                          value={user.role}
                          onChange={(event) => void updateUser(user, { role: event.target.value as Exclude<AdminRole, 'admin'> })}
                          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (user.active && !window.confirm(`Disable account "${user.username}"?`)) return;
                            void updateUser(user, { active: !user.active });
                          }}
                          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {user.active ? 'Disable' : 'Enable'}
                        </button>
                        <form
                          className="flex items-center gap-1"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            const password = resetPasswords[user.username] || '';
                            if (await updateUser(user, { password })) {
                              setResetPasswords((current) => ({ ...current, [user.username]: '' }));
                            }
                          }}
                        >
                          <input
                            type="password"
                            minLength={12}
                            maxLength={256}
                            required
                            autoComplete="new-password"
                            aria-label={`New password for ${user.username}`}
                            placeholder="New password"
                            value={resetPasswords[user.username] || ''}
                            onChange={(event) => setResetPasswords((current) => ({ ...current, [user.username]: event.target.value }))}
                            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                          />
                          <button className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Reset</button>
                        </form>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-6">
            <p className="px-3 pb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Workspace</p>
            <a href="#overview" className="mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Overview</a>
            <a href="#content-editor" className="mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Products & offers</a>
            <a href="#content-editor" className="mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Daily updates</a>
            <a href="#content-editor" className="mb-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Website content & SEO</a>
            <a href="#saved-content" className="block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Saved content</a>
            {isAdministrator && <a href="#workspace-settings" className="mt-1 block rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Settings & accounts</a>}
            <p className="mt-4 border-t border-slate-100 px-3 pt-4 text-xs leading-relaxed text-slate-500">Sales reporting is unavailable until a commerce system is connected. Only publish product markets and availability you have verified.</p>
          </aside>
          <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section id="content-editor" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            {canEditContent ? (
              <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit content' : 'Create content'}</h2>
                <p className="text-xs text-slate-500">Write in English, Telugu, and Spanish. Unpublished drafts stay private.</p>
              </div>
              <button type="button" onClick={() => setPreview(!preview)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                {preview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{preview ? 'Edit fields' : 'Preview'}
              </button>
            </div>

            {preview ? (
              <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                {draft.imageUrl && <img src={draft.imageUrl} alt="" className="max-h-64 w-full object-cover" />}
                <div className="space-y-3 p-5">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${draft.published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{draft.published ? 'Published' : 'Draft preview'}</span>
                  <h3 className="pt-2 text-xl font-bold text-slate-900">{draft.titleEn || 'Your English title'}</h3>
                  {draft.titleTe && <h4 className="text-lg font-semibold text-slate-700">{draft.titleTe}</h4>}
                  {draft.titleEs && <h4 className="text-lg font-semibold text-slate-700">{draft.titleEs}</h4>}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{draft.descriptionEn || 'Your English text will appear here.'}</p>
                  {draft.descriptionTe && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{draft.descriptionTe}</p>}
                  {draft.descriptionEs && <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{draft.descriptionEs}</p>}
                  {(draft.price || draft.offer || draft.offerTe || draft.offerEs) && <p className="font-semibold text-teal-800">{[draft.price, draft.offer, draft.offerTe, draft.offerEs].filter(Boolean).join(' · ')}</p>}
                  {draft.linkUrl && <a className="text-sm font-semibold text-ocean-700 underline" href={draft.linkUrl} target="_blank" rel="noreferrer">External link</a>}
                </div>
              </article>
            ) : (
              <form onSubmit={handleSave} className="space-y-5">
                {(draft.kind === 'product' || draft.kind === 'update') && (
                  <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">{draft.kind === 'product' ? 'Verified sales countries' : 'Applicable countries'}
                      <input maxLength={1000} value={draft.availableCountries} onChange={(event) => setField('availableCountries', event.target.value.toUpperCase())} placeholder="IN, AU or * for global" className={`${inputClass} mt-1.5`} />
                      <span className="mt-1 block text-xs font-normal text-slate-500">Use ISO two-letter country codes. Products require confirmed availability and shipping eligibility before publishing.</span>
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">Relevant risk tags
                      <input maxLength={500} value={draft.climateRisks} onChange={(event) => setField('climateRisks', event.target.value.toLowerCase())} placeholder="heatwave, drought, flood" className={`${inputClass} mt-1.5`} />
                      <span className="mt-1 block text-xs font-normal text-slate-500">Match these tags against verified regional update tags to prioritize listings.</span>
                    </label>
                    {draft.kind === 'product' && (
                      <>
                        <label className="block text-sm font-semibold text-slate-700">Price currency (ISO 4217)
                          <input maxLength={3} value={draft.currency} onChange={(event) => setField('currency', event.target.value.toUpperCase())} placeholder="INR" className={`${inputClass} mt-1.5`} />
                        </label>
                        <label className="block text-sm font-semibold text-slate-700">Offer expiry (optional)
                          <input type="datetime-local" value={asLocalDateTime(draft.offerExpiresAt)} onChange={(event) => setField('offerExpiresAt', event.target.value ? new Date(event.target.value).toISOString() : '')} className={`${inputClass} mt-1.5`} />
                        </label>
                      </>
                    )}
                    {draft.kind === 'update' && (
                      <label className="block text-sm font-semibold text-slate-700">Publish at (optional)
                        <input type="datetime-local" value={asLocalDateTime(draft.scheduledAt)} onChange={(event) => setField('scheduledAt', event.target.value ? new Date(event.target.value).toISOString() : '')} className={`${inputClass} mt-1.5`} />
                        <span className="mt-1 block text-xs font-normal text-slate-500">Scheduled items remain private until their publish time.</span>
                      </label>
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Content type
                    <select value={draft.kind} onChange={(event) => setField('kind', event.target.value as ContentKind)} className={`${inputClass} mt-1.5`}>
                      {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Page path
                    <select value={draft.pagePath} onChange={(event) => setField('pagePath', event.target.value)} className={`${inputClass} mt-1.5`}>
                      <option value="/">Home page</option>
                      <option value="/global-impact-safety">Global impact & safety</option>
                      <option value="/products">Products</option>
                      <option value="/about-sources">About & sources</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">Title (English)
                    <input maxLength={180} value={draft.titleEn} onChange={(event) => setField('titleEn', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Title (Telugu)
                    <input maxLength={180} value={draft.titleTe} onChange={(event) => setField('titleTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Title (Spanish)
                    <input maxLength={180} value={draft.titleEs} onChange={(event) => setField('titleEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">Text (English)
                    <textarea rows={4} maxLength={5000} value={draft.descriptionEn} onChange={(event) => setField('descriptionEn', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Text (Telugu)
                    <textarea rows={4} maxLength={5000} value={draft.descriptionTe} onChange={(event) => setField('descriptionTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Text (Spanish)
                    <textarea rows={4} maxLength={5000} value={draft.descriptionEs} onChange={(event) => setField('descriptionEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">Image URL
                    <input maxLength={2048} type="url" value={draft.imageUrl.startsWith('/uploads/') ? '' : draft.imageUrl} onChange={(event) => setField('imageUrl', event.target.value)} placeholder="https://…" className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Upload image (JPEG, PNG or WebP; max 5 MB)
                    <span className="mt-1.5 flex items-center gap-2">
                      <input aria-label="Upload an image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void handleImageUpload(event)} className={`${inputClass} min-w-0`} />
                      {uploadingImage ? <LoaderCircle className="h-5 w-5 animate-spin text-ocean-600" /> : <ImagePlus className="h-5 w-5 shrink-0 text-ocean-600" />}
                    </span>
                  </label>
                </div>
                {mediaLibrary.length > 0 && (
                  <label className="block text-sm font-semibold text-slate-700">Choose an uploaded image
                    <select value={mediaLibrary.some((image) => image.imageUrl === draft.imageUrl) ? draft.imageUrl : ''} onChange={(event) => setField('imageUrl', event.target.value)} className={`${inputClass} mt-1.5`}>
                      <option value="">Select from media library...</option>
                      {mediaLibrary.map((image) => <option key={image.imageUrl} value={image.imageUrl}>{image.imageUrl} · {new Date(image.updatedAt).toLocaleDateString()}</option>)}
                    </select>
                  </label>
                )}

                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">Category / tag
                    <input maxLength={80} value={draft.category} onChange={(event) => setField('category', event.target.value)} placeholder="e.g. heatwave" className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Date / release timing
                    <input maxLength={120} value={draft.date} onChange={(event) => setField('date', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Badge / offer
                    <input maxLength={100} value={draft.badge} onChange={(event) => setField('badge', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-semibold text-slate-700">External link / product URL
                    <input maxLength={2048} type="url" value={draft.linkUrl} onChange={(event) => setField('linkUrl', event.target.value)} placeholder="https://…" className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Price
                    <input maxLength={80} value={draft.price} onChange={(event) => setField('price', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">Price offer
                    <input maxLength={300} value={draft.offer} onChange={(event) => setField('offer', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Price offer (Telugu)
                    <input maxLength={300} value={draft.offerTe} onChange={(event) => setField('offerTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Price offer (Spanish)
                    <input maxLength={300} value={draft.offerEs} onChange={(event) => setField('offerEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="block text-sm font-semibold text-slate-700">Recommended for (English)
                    <input maxLength={300} value={draft.recommendedFor} onChange={(event) => setField('recommendedFor', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Recommended for (Telugu)
                    <input maxLength={300} value={draft.recommendedForTe} onChange={(event) => setField('recommendedForTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Recommended for (Spanish)
                    <input maxLength={300} value={draft.recommendedForEs} onChange={(event) => setField('recommendedForEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                  </label>
                </div>
                {draft.kind === 'update' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">Official source name
                      <input maxLength={160} value={draft.sourceName} onChange={(event) => setField('sourceName', event.target.value)} className={`${inputClass} mt-1.5`} />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">Official source link
                      <input maxLength={2048} type="url" value={draft.sourceUrl} onChange={(event) => setField('sourceUrl', event.target.value)} placeholder="https://…" className={`${inputClass} mt-1.5`} />
                    </label>
                  </div>
                )}
                {draft.kind === 'content' && draft.category === 'regional-guidance' && (
                  <div className="grid gap-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-700">Official source name
                      <input maxLength={160} value={draft.sourceName} onChange={(event) => setField('sourceName', event.target.value)} className={`${inputClass} mt-1.5`} />
                    </label>
                    <label className="block text-sm font-semibold text-slate-700">Official source link
                      <input maxLength={2048} type="url" value={draft.sourceUrl} onChange={(event) => setField('sourceUrl', event.target.value)} placeholder="https://…" className={`${inputClass} mt-1.5`} />
                    </label>
                    <p className="text-xs leading-relaxed text-teal-900 sm:col-span-2">Set the category to regional-guidance, select the homepage path, add the relevant country codes, and include only source-checked preparedness advice.</p>
                  </div>
                )}

                {(draft.kind === 'page' || draft.kind === 'content') && (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-bold text-slate-800">Search engine settings</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <label className="block text-sm font-semibold text-slate-700">SEO title (English)
                        <input maxLength={180} value={draft.seoTitleEn} onChange={(event) => setField('seoTitleEn', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">SEO title (Telugu)
                        <input maxLength={180} value={draft.seoTitleTe} onChange={(event) => setField('seoTitleTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">SEO title (Spanish)
                        <input maxLength={180} value={draft.seoTitleEs} onChange={(event) => setField('seoTitleEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">Meta description (English)
                        <textarea rows={2} maxLength={320} value={draft.seoDescriptionEn} onChange={(event) => setField('seoDescriptionEn', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">Meta description (Telugu)
                        <textarea rows={2} maxLength={320} value={draft.seoDescriptionTe} onChange={(event) => setField('seoDescriptionTe', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">Meta description (Spanish)
                        <textarea rows={2} maxLength={320} value={draft.seoDescriptionEs} onChange={(event) => setField('seoDescriptionEs', event.target.value)} className={`${inputClass} mt-1.5`} />
                      </label>
                    </div>
                  </div>
                )}

                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={draft.published} onChange={(event) => setField('published', event.target.checked)} className="h-4 w-4 rounded text-ocean-600" />
                  Publish immediately (unchecked saves a private draft)
                </label>

                <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-4">
                  {editingId && <button type="button" onClick={startNew} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel edit</button>}
                  <button disabled={saving || uploadingImage} className="inline-flex items-center gap-2 rounded-xl bg-ocean-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-ocean-700 disabled:opacity-60">
                    {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {editingId ? 'Save changes' : 'Save content'}
                  </button>
                </div>
              </form>
            )}
              </>
            ) : (
              <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">This account has read-only access. Ask an administrator for an editor role to change website content.</p>
            )}
          </section>

          <section id="saved-content" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div><h2 className="text-lg font-bold text-slate-900">Saved content</h2><p className="text-xs text-slate-500">{adminEntries.length} items · drafts are private</p></div>
              {canEditContent && <button onClick={startNew} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"><Plus className="h-4 w-4" /> New</button>}
            </div>
            {loadingEntries ? <p className="py-8 text-center text-sm text-slate-500">Loading content…</p> : filteredEntries.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">{searchQuery ? 'No matching content.' : 'No content found.'}</p> : (
              <ul className="space-y-3">
                {filteredEntries.map((entry) => {
                  const expiredUpdate = entry.kind === 'update' && entry.published && entry.expiresAt
                    && Date.parse(entry.expiresAt) <= Date.now();
                  const scheduledUpdate = entry.published && entry.scheduledAt && Date.parse(entry.scheduledAt) > Date.now();
                  return (
                  <li key={entry.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ocean-700">{labels[entry.kind]}</span>
                        <h3 className="truncate text-sm font-bold text-slate-900">{entry.titleEn || 'Untitled content'}</h3>
                        <p className="mt-1 text-xs text-slate-500">{expiredUpdate ? 'Expired · hidden from public' : scheduledUpdate ? `Scheduled · ${new Date(entry.scheduledAt).toLocaleString()}` : entry.published ? 'Published' : 'Private draft'} · {entry.pagePath}</p>
                      </div>
                      {canEditContent && <div className="flex shrink-0 gap-1">
                        <button aria-label={entry.published ? 'Unpublish' : 'Publish'} title={entry.published ? 'Unpublish' : 'Publish'} onClick={() => void togglePublished(entry)} className={`rounded-lg px-2 py-1 text-xs font-bold ${entry.published ? expiredUpdate ? 'bg-slate-100 text-slate-700' : scheduledUpdate ? 'bg-sky-50 text-sky-800' : 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{entry.published ? expiredUpdate ? 'Expired' : scheduledUpdate ? 'Scheduled' : 'Live' : 'Draft'}</button>
                        <button aria-label="Edit content" title="Edit" onClick={() => startEdit(entry)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
                        <button aria-label="Delete content" title="Delete" onClick={() => void handleDelete(entry)} className="rounded-lg p-1.5 text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                      </div>}
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
          </div>
        </div>
      </div>
    </main>
  );
};
