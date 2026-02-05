import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, CreditCard, Star, Loader2, ExternalLink } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

interface Subscription {
  level: number;
  levelName: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isSmile?: boolean;
}

interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  pdfUrl: string | null;
}

export function AccountPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
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
        // Map backend response to expected format
        if (data.level > 0) {
          // Determine status based on data
          let status = 'active';
          if (data.isCancelled) {
            status = 'canceled';
          } else if (data.subscriptionEnd && new Date(data.subscriptionEnd) < new Date()) {
            status = 'expired';
          }

          // Check if this is a Smile subscription (no Stripe subscription ID)
          const isSmile = !data.stripe?.subscriptionId && data.level > 0;

          setSubscription({
            level: data.level,
            levelName: data.levelName,
            status,
            currentPeriodEnd: data.subscriptionEnd,
            cancelAtPeriodEnd: data.isCancelled,
            isSmile,
          });
        } else {
          setSubscription(null);
        }
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

  const handleCancelSubscription = async () => {
    if (!confirm(t('account.confirmCancel'))) {
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
    return new Date(dateString).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getLevelName = (level: number) => {
    const names: Record<number, string> = {
      0: t('account.levelFree'),
      1: t('account.levelEssential'),
      2: t('account.levelStandard'),
      3: t('account.levelPremium'),
    };
    return names[level] || `${t('account.level')} ${level}`;
  };

  const getStatusLabel = (status: string) => {
    if (status === 'active') return t('account.statusActive');
    if (status === 'canceled') return t('account.statusCanceled');
    return status;
  };

  const getInvoiceStatusLabel = (status: string) => {
    if (status === 'paid') return t('account.invoicePaid');
    return status;
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Page Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="card"
          >
            <div className="flex flex-col items-center mb-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-teal flex items-center justify-center mb-4">
                <CreditCard className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
              </div>
              <h1 className="font-display text-2xl text-dark">
                {t('account.mySubscription')}
              </h1>
            </div>
          </motion.div>

          {/* Link to profile - after header card */}
          <Link
            to="/profile"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-teal-200 text-teal-700 hover:bg-teal-50 transition-colors font-medium"
          >
            <User className="w-5 h-5" />
            {t('account.myProfile')}
          </Link>

          {/* Subscription Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className="flex items-center gap-3 mb-6">
              <Star className="w-6 h-6 text-teal-600" />
              <h2 className="font-display text-xl text-dark">{t('account.subscriptionTitle')}</h2>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-teal-500" />
              </div>
            ) : subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-teal-50">
                  <div>
                    <p className="text-sm text-teal-600">{t('account.currentLevel')}</p>
                    <p className="text-xl font-bold text-teal-800">
                      {getLevelName(subscription.level)}
                    </p>
                    {subscription.isSmile && (
                      <p className="text-xs text-teal-600 mt-1">{t('account.smileOffer')}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    subscription.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : subscription.status === 'canceled'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {getStatusLabel(subscription.status)}
                  </span>
                </div>

                {subscription.currentPeriodEnd && (
                  <p className="text-sm text-gray-600">
                    {subscription.isSmile
                      ? t('account.accessUntil', { date: formatDate(subscription.currentPeriodEnd) })
                      : subscription.cancelAtPeriodEnd
                      ? t('account.endsOn', { date: formatDate(subscription.currentPeriodEnd) })
                      : t('account.renewsOn', { date: formatDate(subscription.currentPeriodEnd) })
                    }
                  </p>
                )}

                {/* Actions - only show for non-Smile subscriptions */}
                {!subscription.isSmile && (
                  <div className="flex gap-3 pt-4">
                    {subscription.cancelAtPeriodEnd ? (
                      <button
                        onClick={handleReactivateSubscription}
                        disabled={actionLoading}
                        className="flex-1 btn-primary flex items-center justify-center gap-2"
                      >
                        {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {t('account.reactivate')}
                      </button>
                    ) : (
                      <button
                        onClick={handleCancelSubscription}
                        disabled={actionLoading}
                        className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {t('account.cancelSubscription')}
                      </button>
                    )}
                    <button
                      onClick={handleOpenBillingPortal}
                      disabled={actionLoading}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      {t('account.billing')}
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-600 mb-4">{t('account.noSubscription')}</p>
                <button
                  onClick={() => navigate('/pricing')}
                  className="btn-primary"
                >
                  {t('account.discoverOffers')}
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
                <CreditCard className="w-6 h-6 text-teal-600" />
                <h2 className="font-display text-xl text-dark">{t('account.invoicesTitle')}</h2>
              </div>

              <div className="space-y-3">
                {invoices.slice(0, 5).map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                  >
                    <div>
                      <p className="font-medium text-dark">
                        {invoice.amount} {invoice.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDate(invoice.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {getInvoiceStatusLabel(invoice.status)}
                      </span>
                      {invoice.pdfUrl && (
                        <a
                          href={invoice.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-600 hover:text-teal-800"
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
            <p className="text-sm text-gray-500">
              {t('account.needHelp')}{' '}
              <Link to="/contact" className="text-teal-600 hover:underline">
                {t('account.contactUs')}
              </Link>
            </p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
