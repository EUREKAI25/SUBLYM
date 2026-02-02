import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TextsPage } from '@/pages/TextsPage';
import { PricingPage } from '@/pages/PricingPage';
import { UsersPage } from '@/pages/UsersPage';
import { TestimonialsPage } from '@/pages/TestimonialsPage';
import { SmileReactionsPage } from '@/pages/SmileReactionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FinancesPage } from '@/pages/FinancesPage';
import { InvitationsPage } from '@/pages/InvitationsPage';
import { GeneratePubPage } from '@/pages/GeneratePubPage';
import { SublymPage } from '@/pages/SublymPage';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<DashboardPage />} />
        <Route path="texts" element={<TextsPage />} />
        <Route path="pricing" element={<PricingPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="finances" element={<FinancesPage />} />
        <Route path="testimonials" element={<TestimonialsPage />} />
        <Route path="smile-reactions" element={<SmileReactionsPage />} />
        <Route path="invitations" element={<InvitationsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="generate-pub" element={<GeneratePubPage />} />
        <Route path="sublym" element={<SublymPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
