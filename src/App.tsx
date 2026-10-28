import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link } from 'react-router-dom';
import { LanguageProvider } from './context/LanguageContext';
import { UpdatesProvider } from './context/UpdatesContext';
import { RegionProvider } from './context/RegionContext';
import { useUpdates } from './context/UpdatesContext';
import { AlertBanner } from './components/AlertBanner';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { FloatingUpdatesDrawer } from './components/FloatingUpdatesDrawer';

// The 4 Core Pages
import { HomePage } from './pages/HomePage';
import { GlobalImpactSafetyPage } from './pages/GlobalImpactSafetyPage';
import { ProductsPage } from './pages/ProductsPage';
import { AboutSourcesPage } from './pages/AboutSourcesPage';
import { AdminPage } from './pages/AdminPage';
import { PublishedContent } from './components/PublishedContent';

// Scroll to top on route change
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const AppContent: React.FC = () => {
  const location = useLocation();
  const lastTrackedPath = useRef('');
  const { visiblePages, siteSettingsReady, siteSettingsError } = useUpdates();

  useEffect(() => {
    if (location.pathname === '/admin' || lastTrackedPath.current === location.pathname) return;
    if (!['/', '/global-impact-safety', '/products', '/about-sources'].includes(location.pathname)) return;
    if (!visiblePages.includes(location.pathname)) return;
    lastTrackedPath.current = location.pathname;
    void fetch('/api/analytics/page-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: location.pathname }),
    }).then((response) => {
      if (!response.ok) console.error(`Page view tracking failed (${response.status}).`);
    }).catch((error: unknown) => console.error('Page view tracking failed:', error));
  }, [location.pathname, visiblePages]);

  if (location.pathname === '/admin') {
    return <AdminPage />;
  }

  if (!siteSettingsReady) {
    return <main className="min-h-screen px-4 py-20 text-center text-slate-600">Loading website settings…</main>;
  }

  if (['/', '/global-impact-safety', '/products', '/about-sources'].includes(location.pathname) &&
      !visiblePages.includes(location.pathname)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-slate-900">This page is currently unavailable.</h1>
        <Link to="/" className="mt-4 inline-block font-semibold text-ocean-700 hover:underline">Return to the homepage</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800 overflow-x-hidden selection:bg-ocean-600 selection:text-white">
      <AlertBanner />
      <Navbar />
      <main className="flex-1">
        {siteSettingsError && (
          <p role="alert" className="mx-auto mt-4 max-w-7xl px-4 text-sm text-rose-700">
            Website settings could not be loaded. Only the homepage is available until settings can be verified.
          </p>
        )}
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/global-impact-safety" element={<GlobalImpactSafetyPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/about-sources" element={<AboutSourcesPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
        <PublishedContent />
      </main>
      <Footer />
      <FloatingUpdatesDrawer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <LanguageProvider>
      <UpdatesProvider>
        <RegionProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AppContent />
          </BrowserRouter>
        </RegionProvider>
      </UpdatesProvider>
    </LanguageProvider>
  );
};

export default App;
