import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, I18nProvider } from '@/hooks';
import { LandingPage, LoginPage, CreatePage, GalleryPage, AccountPage, ProfilePage, WatchPage, ContactPage, TermsPage } from '@/pages';
import { initGA, trackPageView } from '@/lib/analytics';

function PageTracker() {
  const location = useLocation();
  useEffect(() => { trackPageView(location.pathname); }, [location.pathname]);
  return null;
}

function App() {
  useEffect(() => { initGA(); }, []);

  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <PageTracker />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/watch/:traceId" element={<WatchPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terms" element={<TermsPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  );
}

export default App;
