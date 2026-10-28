import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CMSContentEntry, LiveUpdateItem, Product } from '../types';
import { apiRequest, PublicContentResponse } from '../services/contentApi';

type ContentDraft = Omit<CMSContentEntry, 'id' | 'updatedAt'>;
export type AdminRole = 'admin' | 'editor' | 'viewer';

export interface AuthenticatedAdmin {
  username: string;
  role: AdminRole;
}

interface UpdatesContextType {
  updates: LiveUpdateItem[];
  publishedUpdates: LiveUpdateItem[];
  products: Product[];
  publishedContent: CMSContentEntry[];
  contentInitialized: boolean;
  contentError: string;
  refreshPublicContent: () => Promise<void>;
  visiblePages: string[];
  siteSettingsReady: boolean;
  siteSettingsError: string;
  refreshPublicSettings: () => Promise<void>;
  adminEntries: CMSContentEntry[];
  refreshAdminContent: () => Promise<CMSContentEntry[]>;
  createEntry: (entry: ContentDraft) => Promise<void>;
  updateEntry: (id: string, entry: ContentDraft) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  uploadImage: (file: File) => Promise<string>;
  isAdminAuthenticated: boolean;
  authenticatedAdmin: AuthenticatedAdmin | null;
  authReady: boolean;
  csrfToken: string;
  loginAdmin: (username: string, password: string) => Promise<void>;
  logoutAdmin: () => Promise<void>;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const UpdatesContext = createContext<UpdatesContextType | undefined>(undefined);

const toUpdate = (item: CMSContentEntry): LiveUpdateItem => ({
  id: item.id,
  titleEn: item.titleEn,
  titleTe: item.titleTe,
  titleEs: item.titleEs,
  descriptionEn: item.descriptionEn,
  descriptionTe: item.descriptionTe,
  descriptionEs: item.descriptionEs,
  date: item.date,
  imageUrl: item.imageUrl,
  category: (['alert', 'enso-report', 'monsoon', 'heatwave', 'advisory'].includes(item.category)
    ? item.category
    : 'advisory') as LiveUpdateItem['category'],
  sourceName: item.sourceName,
  sourceUrl: item.sourceUrl,
  isPublished: item.published,
  countries: item.availableCountries?.split(',').map((country) => country.trim()).filter(Boolean) || [],
  climateRisks: item.climateRisks?.split(',').map((risk) => risk.trim()).filter(Boolean) || [],
  scheduledAt: item.scheduledAt || '',
});

const toProduct = (item: CMSContentEntry): Product => ({
  id: item.id,
  name: item.titleEn,
  titleTe: item.titleTe,
  category: (['water-filtration', 'hydration', 'heat-protection', 'farming-garden', 'emergency-power'].includes(item.category)
    ? item.category
    : 'water-filtration') as Product['category'],
  description: item.descriptionEn,
  descriptionTe: item.descriptionTe,
  imageUrl: item.imageUrl,
  externalUrl: item.linkUrl || item.sourceUrl,
  badge: item.badge,
  recommendedFor: item.recommendedFor,
  price: item.price,
  offer: item.offer,
  offerTe: item.offerTe,
  offerEs: item.offerEs,
  offerExpiresAt: item.offerExpiresAt || '',
  recommendedForTe: item.recommendedForTe,
  titleEs: item.titleEs,
  descriptionEs: item.descriptionEs,
  recommendedForEs: item.recommendedForEs,
  availableCountries: item.availableCountries?.split(',').map((country) => country.trim()).filter(Boolean) || [],
  climateRisks: item.climateRisks?.split(',').map((risk) => risk.trim()).filter(Boolean) || [],
  currency: item.currency || '',
});

const seedPayload = () => ({ updates: [], products: [] });

export const UpdatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [publishedContent, setPublishedContent] = useState<CMSContentEntry[]>([]);
  const [contentInitialized, setContentInitialized] = useState(false);
  const [contentError, setContentError] = useState('');
  const [adminEntries, setAdminEntries] = useState<CMSContentEntry[]>([]);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [authenticatedAdmin, setAuthenticatedAdmin] = useState<AuthenticatedAdmin | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [csrfToken, setCsrfToken] = useState('');
  const [visiblePages, setVisiblePages] = useState<string[]>(['/']);
  const [siteSettingsReady, setSiteSettingsReady] = useState(false);
  const [siteSettingsError, setSiteSettingsError] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const refreshPublicContent = useCallback(async () => {
    try {
      const result = await apiRequest<PublicContentResponse>('/api/public/content');
      setPublishedContent(result.items);
      setContentInitialized(result.initialized);
      setContentError('');
    } catch (error) {
      setContentError(error instanceof Error ? error.message : 'Could not load published content.');
    }
  }, []);

  const refreshPublicSettings = useCallback(async () => {
    try {
      const settings = await apiRequest<{ visiblePages: string[] }>('/api/public/settings');
      setVisiblePages(settings.visiblePages);
      setSiteSettingsError('');
    } catch (error) {
      setVisiblePages(['/']);
      setSiteSettingsError(error instanceof Error ? error.message : 'Could not load website settings.');
    } finally {
      setSiteSettingsReady(true);
    }
  }, []);

  const refreshAdminContent = useCallback(async () => {
    const entries = await apiRequest<CMSContentEntry[]>('/api/admin/content');
    setAdminEntries(entries);
    return entries;
  }, []);

  useEffect(() => {
    void refreshPublicContent();
    void refreshPublicSettings();
    const refreshInterval = window.setInterval(() => {
      void refreshPublicContent();
      void refreshPublicSettings();
    }, 30_000);
    window.addEventListener('focus', refreshPublicContent);
    window.addEventListener('focus', refreshPublicSettings);
    void apiRequest<{ authenticated: boolean; user: AuthenticatedAdmin | null; csrfToken: string }>('/api/auth/session')
      .then((session) => {
        setCsrfToken(session.csrfToken);
        setIsAdminAuthenticated(session.authenticated);
        setAuthenticatedAdmin(session.user);
        setAuthReady(true);
        if (session.authenticated) {
          void refreshAdminContent().catch((error: unknown) => {
            setContentError(error instanceof Error ? error.message : 'Could not load administrator content.');
          });
        }
      })
      .catch((error: unknown) => {
        setAuthReady(true);
        setContentError(error instanceof Error ? error.message : 'Could not check the administrator session.');
      });
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshPublicContent);
      window.removeEventListener('focus', refreshPublicSettings);
    };
  }, [refreshAdminContent, refreshPublicContent, refreshPublicSettings]);

  const loginAdmin = async (username: string, password: string) => {
    if (!csrfToken) throw new Error('The login session is not ready. Refresh the page and try again.');
    const session = await apiRequest<{ authenticated: boolean; user: AuthenticatedAdmin; csrfToken: string }>(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) },
      csrfToken,
    );
    setCsrfToken(session.csrfToken);
    const entries = await refreshAdminContent();
    if (!contentInitialized && entries.length === 0) {
      await apiRequest('/api/admin/content/seed', {
        method: 'POST',
        body: JSON.stringify(seedPayload()),
      }, session.csrfToken);
      await Promise.all([refreshAdminContent(), refreshPublicContent()]);
    }
    setIsAdminAuthenticated(session.authenticated);
    setAuthenticatedAdmin(session.user);
  };

  const logoutAdmin = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }, csrfToken);
    setIsAdminAuthenticated(false);
    setAuthenticatedAdmin(null);
    setAdminEntries([]);
    const session = await apiRequest<{ authenticated: boolean; user: AuthenticatedAdmin | null; csrfToken: string }>('/api/auth/session');
    setCsrfToken(session.csrfToken);
  };

  const createEntry = async (entry: ContentDraft) => {
    await apiRequest<CMSContentEntry>('/api/admin/content', {
      method: 'POST',
      body: JSON.stringify(entry),
    }, csrfToken);
    await Promise.all([refreshAdminContent(), refreshPublicContent()]);
  };

  const updateEntry = async (id: string, entry: ContentDraft) => {
    await apiRequest<CMSContentEntry>(`/api/admin/content/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(entry),
    }, csrfToken);
    await Promise.all([refreshAdminContent(), refreshPublicContent()]);
  };

  const deleteEntry = async (id: string) => {
    await apiRequest<void>(`/api/admin/content/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }, csrfToken);
    await Promise.all([refreshAdminContent(), refreshPublicContent()]);
  };

  const uploadImage = async (file: File) => {
    const body = new FormData();
    body.append('image', file);
    const result = await apiRequest<{ imageUrl: string }>('/api/admin/uploads', { method: 'POST', body }, csrfToken);
    return result.imageUrl;
  };

  const updates = useMemo(() => {
    return publishedContent.filter((item) => item.kind === 'update').map(toUpdate);
  }, [publishedContent]);

  const products = useMemo(() => {
    return publishedContent.filter((item) => item.kind === 'product').map(toProduct);
  }, [publishedContent]);

  const publishedUpdates = useMemo(() => updates.filter((item) => item.isPublished), [updates]);

  return (
    <UpdatesContext.Provider value={{
      updates,
      publishedUpdates,
      products,
      publishedContent,
      contentInitialized,
      contentError,
      refreshPublicContent,
      visiblePages,
      siteSettingsReady,
      siteSettingsError,
      refreshPublicSettings,
      adminEntries,
      refreshAdminContent,
      createEntry,
      updateEntry,
      deleteEntry,
      uploadImage,
      isAdminAuthenticated,
      authenticatedAdmin,
      authReady,
      csrfToken,
      loginAdmin,
      logoutAdmin,
      isDrawerOpen,
      openDrawer: () => setIsDrawerOpen(true),
      closeDrawer: () => setIsDrawerOpen(false),
    }}>
      {children}
    </UpdatesContext.Provider>
  );
};

export const useUpdates = (): UpdatesContextType => {
  const context = useContext(UpdatesContext);
  if (!context) throw new Error('useUpdates must be used within an UpdatesProvider');
  return context;
};
