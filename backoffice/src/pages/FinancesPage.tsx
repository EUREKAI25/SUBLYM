import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, AlertCircle, CheckCircle, Filter, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface FinancesSummary {
  today: { revenue: number; count: number };
  thisWeek: { revenue: number; count: number };
  thisMonth: { revenue: number; count: number };
  subscriptions: {
    byLevel: Record<number, number>;
  };
}

interface Payment {
  id: number;
  stripePaymentId: string;
  userId: number;
  email: string;
  amount: number;
  currency: string;
  status: string;
  productType: string;
  productLevel: number | null;
  period: string | null;
  createdAt: string;
  refundedAt: string | null;
}

const levelNames: Record<number, string> = {
  0: 'Gratuit',
  1: 'Essentiel',
  2: 'Standard',
  3: 'Premium',
};

export function FinancesPage() {
  const { token } = useAuth();
  const [summary, setSummary] = useState<FinancesSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchData();
  }, [token, statusFilter, page]);

  async function fetchData() {
    if (!token) return;

    try {
      setLoading(true);

      // Fetch summary
      const summaryRes = await fetch(`${API_URL}/admin/finances/summary`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setSummary(summaryData);
      }

      // Fetch payments
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: '20',
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const paymentsRes = await fetch(`${API_URL}/admin/finances/payments?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
        setTotalPages(paymentsData.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching finances:', err);
    } finally {
      setLoading(false);
    }
  }

  const getPeriodData = () => {
    if (!summary) return { current: 0, label: 'Ce mois' };
    
    switch (period) {
      case 'day':
        return { current: summary.today.revenue, count: summary.today.count, label: "Aujourd'hui" };
      case 'week':
        return { current: summary.thisWeek.revenue, count: summary.thisWeek.count, label: 'Cette semaine' };
      case 'month':
        return { current: summary.thisMonth.revenue, count: summary.thisMonth.count, label: 'Ce mois' };
    }
  };

  const periodData = getPeriodData();

  // Calculate subscriptions total
  const totalSubscriptions = summary?.subscriptions.byLevel 
    ? Object.values(summary.subscriptions.byLevel).reduce((a, b) => a + b, 0)
    : 0;

  if (loading && !summary) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
        <p className="text-gray-600 mt-1">Suivi du chiffre d'affaires et des paiements</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-2">
        {[
          { key: 'day', label: 'Jour' },
          { key: 'week', label: 'Semaine' },
          { key: 'month', label: 'Mois' },
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key as 'day' | 'week' | 'month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Current period */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">{periodData.label}</span>
            <DollarSign className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{periodData.current?.toLocaleString() || 0} €</p>
          <p className="text-sm text-gray-500 mt-1">{periodData.count || 0} paiement(s)</p>
        </div>

        {/* Today */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Aujourd'hui</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary?.today.revenue?.toLocaleString() || 0} €</p>
          <p className="text-sm text-gray-500 mt-1">{summary?.today.count || 0} paiement(s)</p>
        </div>

        {/* This week */}
        <div className="card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Cette semaine</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{summary?.thisWeek.revenue?.toLocaleString() || 0} €</p>
          <p className="text-sm text-gray-500 mt-1">{summary?.thisWeek.count || 0} paiement(s)</p>
        </div>

        {/* Subscriptions */}
        <div className="card bg-primary-50 border-primary-200">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-primary-500" />
            <span className="text-sm text-primary-700">Abonnés actifs</span>
          </div>
          <p className="text-3xl font-bold text-primary-700">{totalSubscriptions}</p>
          <div className="text-sm text-primary-600 mt-1 space-x-2">
            {summary?.subscriptions.byLevel && Object.entries(summary.subscriptions.byLevel).map(([level, count]) => (
              <span key={level}>L{level}: {count}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Summary by period */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Récapitulatif</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Aujourd'hui</p>
            <p className="text-xl font-bold text-gray-900">{summary?.today.revenue || 0} €</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Cette semaine</p>
            <p className="text-xl font-bold text-gray-900">{summary?.thisWeek.revenue?.toLocaleString() || 0} €</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">Ce mois</p>
            <p className="text-xl font-bold text-gray-900">{summary?.thisMonth.revenue?.toLocaleString() || 0} €</p>
          </div>
        </div>
      </div>

      {/* Payments list */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Derniers paiements</h2>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'succeeded' | 'failed');
                setPage(1);
              }}
              className="input w-40"
            >
              <option value="all">Tous</option>
              <option value="succeeded">Réussis</option>
              <option value="failed">Échoués</option>
            </select>
          </div>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucun paiement trouvé
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Email</th>
                  <th className="table-header">Type</th>
                  <th className="table-header">Niveau</th>
                  <th className="table-header">Montant</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className={`hover:bg-gray-50 ${payment.status === 'failed' ? 'bg-red-50' : ''}`}>
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{payment.email}</p>
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        payment.productType === 'subscription'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {payment.productType === 'subscription' ? 'Abo' : 'One-shot'}
                        {payment.period && ` (${payment.period})`}
                      </span>
                    </td>
                    <td className="table-cell">
                      {payment.productLevel !== null && (
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          payment.productLevel === 3
                            ? 'bg-purple-100 text-purple-700'
                            : payment.productLevel === 2
                            ? 'bg-indigo-100 text-indigo-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {levelNames[payment.productLevel] || `Niveau ${payment.productLevel}`}
                        </span>
                      )}
                    </td>
                    <td className="table-cell font-medium">{payment.amount} {payment.currency}</td>
                    <td className="table-cell text-gray-600">
                      {new Date(payment.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                        payment.status === 'succeeded'
                          ? 'bg-green-100 text-green-700'
                          : payment.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {payment.status === 'succeeded' ? (
                          <><CheckCircle className="w-3 h-3" /> Réussi</>
                        ) : payment.status === 'failed' ? (
                          <><AlertCircle className="w-3 h-3" /> Échoué</>
                        ) : (
                          payment.status
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary"
            >
              Précédent
            </button>
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary"
            >
              Suivant
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
