import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, Mail, LogOut, Calendar, CreditCard, Star, Loader2, ExternalLink } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n, LocaleSwitcher } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

interface Subscription {
  level: number;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  pdfUrl: string | null;
}

const levelNames: Record<number, string> = {
  0: 'Gratuit',
  1: 'Essentiel',
  2: 'Standard',
  3: 'Premium',
};

export function AccountPage() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchAccountData();
  }, [user, navigate]);

  const fetchAccountData = async () => {
    try {
      setLoading(true);

      // Fetch subscription
      const subRes = await fetchWithAuth(API_ENDPOINTS.subscription);
      if (subRes.ok) {
        const data = await subRes.json();
        setSubscription(data.subscription);
      }

      // Fetch invoices
      const invRes = await fetchWithAuth(API_ENDPOINTS.invoices);
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.error('Error fetching account data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler votre abonnement ? Il restera actif jusqu\'à la fin de la période en cours.')) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await fetchWithAuth(API_ENDPOINTS.cancelSubscription, {
        method: 'POST',
      });

      if (response.ok) {
        fetchAccountData();
      }
    } catch (err) {
      console.error('Error cancelling subscription:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    try {
      setActionLoading(true);
      const response = await fetchWithAuth(API_ENDPOINTS.reactivateSubscription, {
        method: 'POST',
      });

      if (response.ok) {
        fetchAccountData();
      }
    } catch (err) {
      console.error('Error reactivating subscription:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenBillingPortal = async () => {
    try {
      setActionLoading(true);
      const response = await fetchWithAuth(API_ENDPOINTS.billingPortal, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.url) {
          window.open(data.url, '_blank');
        }
      }
    } catch (err) {
      console.error('Error opening billing portal:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            {/* Avatar */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-romantic flex items-center justify-center mb-4">
                <User className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
              <h1 className="font-display text-2xl text-charcoal-900">
                Mon compte
              </h1>
            </div>

            {/* Info */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-charcoal-50">
                <Mail className="w-5 h-5 text-wine-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-charcoal-500">Email</p>
                  <p className="text-charcoal-800 font-medium truncate">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-charcoal-50">
                <Calendar className="w-5 h-5 text-wine-600 flex-shrink-0" />
                <div>
                  <p className="text-sm text-charcoal-500">Membre depuis</p>
                  <p className="text-charcoal-800 font-medium">
                    {user.created_at ? formatDate(user.created_at) : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Language selector */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-charcoal-50">
                <span className="text-charcoal-700">Langue / Language</span>
                <LocaleSwitcher />
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors font-medium"
            >
              <LogOut className="w-5 h-5" />
              Se déconnecter
            </button>
          </motion.div>

          {/* Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-wine-600" />
              <h2 className="font-display text-xl text-charcoal-900">Mon abonnement</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-wine-500" />
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-wine-50">
                  <div>
                    <p className="text-sm text-wine-600">Niveau actuel</p>
                    <p className="text-xl font-bold text-wine-800">
                      {levelNames[subscription.level] || `Niveau ${subscription.level}`}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    subscription.status === 'active' 
                      ? 'bg-green-100 text-green-700'
                      : subscription.status === 'canceled'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {subscription.status === 'active' ? 'Actif' : 
                     subscription.status === 'canceled' ? 'Annulé' : subscription.status}
                  </span>
                </div>

                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-charcoal-600">
                    {subscription.cancelAtPeriodEnd 
                      ? `Se termine le ${formatDate(subscription.currentPeriodEnd)}`
                      : `Prochain renouvellement : ${formatDate(subscription.currentPeriodEnd)}`
                    }
                  </p>
                )}

                <div className="flex gap-3 pt-4">
                  {subscription.cancelAtPeriodEnd ? (
                    <button
                      onClick={handleReactivateSubscription}
                      disabled={actionLoading}
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Réactiver
                    </button>
                  ) : (
                    <button
                      onClick={handleCancelSubscription}
                      disabled={actionLoading}
                      className="flex-1 px-4 py-2 rounded-xl border-2 border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50 transition-colors"
                    >
                      Annuler l'abonnement
                    </button>
                  )}
                  <button
                    onClick={handleOpenBillingPortal}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-charcoal-200 text-charcoal-600 hover:bg-charcoal-50 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Facturation
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-charcoal-600 mb-4">Vous n'avez pas d'abonnement actif</p>
                <button
                  onClick={() => navigate('/create')}
                  className="btn-primary"
                >
                  Découvrir nos offres
                </button>
              </div>
            )}
          </motion.div>

          {/* Invoices Card */}
          {invoices.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card"
            >
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="w-6 h-6 text-wine-600" />
                <h2 className="font-display text-xl text-charcoal-900">Mes factures</h2>
              </div>

              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => (
                  <div 
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-charcoal-50"
                  >
                    <div>
                      <p className="font-medium text-charcoal-800">
                        {invoice.amount} {invoice.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-charcoal-500">
                        {formatDate(invoice.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'paid' 
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {invoice.status === 'paid' ? 'Payée' : invoice.status}
                      </span>
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-wine-600 hover:text-wine-800"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Help */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center"
          >
            <p className="text-sm text-charcoal-500">
              Besoin d'aide ?{' '}
              <Link to="/contact" className="text-wine-600 hover:underline">
                Contactez-nous
              </Link>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
