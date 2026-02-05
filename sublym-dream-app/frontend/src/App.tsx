import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/store';

// Pages
import HomePage from './pages/HomePage';
import AccessCodePage from './pages/AccessCodePage';
import CreatePinPage from './pages/CreatePinPage';
import VerifyPinPage from './pages/VerifyPinPage';
import LockScreenPage from './pages/LockScreenPage';
import DreamDefinePage from './pages/DreamDefinePage';
import DreamViewerPage from './pages/DreamViewerPage';
import DreamsLibraryPage from './pages/DreamsLibraryPage';
import SettingsPage from './pages/SettingsPage';
import InstallPromptPage from './pages/InstallPromptPage';

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLocked } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/access" replace />;
  }

  if (isLocked) {
    return <Navigate to="/lock" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-system-carbon-400 via-system-carbon-300 to-system-carbon-400">
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/access" element={<AccessCodePage />} />
        <Route path="/create-pin" element={<CreatePinPage />} />
        <Route path="/verify-pin" element={<VerifyPinPage />} />
        <Route path="/lock" element={<LockScreenPage />} />
        <Route path="/install" element={<InstallPromptPage />} />

        {/* Protected routes */}
        <Route
          path="/dream/define"
          element={
            <ProtectedRoute>
              <DreamDefinePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dream/:id"
          element={
            <ProtectedRoute>
              <DreamViewerPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dreams"
          element={
            <ProtectedRoute>
              <DreamsLibraryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
