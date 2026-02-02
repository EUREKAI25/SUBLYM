import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, I18nProvider } from '@/hooks';
import { LandingPage, LoginPage, CreatePage, GalleryPage, AccountPage, WatchPage, ContactPage, TermsPage } from '@/pages';

function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/create" element={<CreatePage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/account" element={<AccountPage />} />
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
