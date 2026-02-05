import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Filter,
  Loader2,
  BarChart3,
  CreditCard,
  Cpu,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// --- Types ---

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

interface CostsPeriod {
  cost: number;
  generations: number;
}

interface CostsData {
  today: CostsPeriod;
  thisWeek: CostsPeriod;
  thisMonth: CostsPeriod;
  thisYear: CostsPeriod;
  providerBreakdown?: Record<string, { totalCost: number; count: number }>;
}

interface OverviewPeriod {
  month: number;
  year: number;
}

interface MonthlyRow {
  month: string;
  revenue: number;
  costs: number;
  margin: number;
  generationCount: number;
  paymentCount: number;
}

interface ForecastRow {
  month: string;
  revenue: number;
  costs: number;
  margin: number;
}

interface OverviewData {
  revenue: OverviewPeriod;
  costs: OverviewPeriod;
  margin: OverviewPeriod;
  monthly: MonthlyRow[];
  forecast: ForecastRow[];
}

type TabKey = 'overview' | 'payments' | 'costs';

const levelNames: Record<number, string> = {
  0: 'Gratuit',
  1: 'Essentiel',
  2: 'Standard',
  3: 'Premium',
};

// --- Helpers ---

function formatEuro(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' \u20AC';
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return sign + value.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %';
}

function marginColor(value: number): string {
  if (value > 0) return 'text-green-600';
  if (value < 0) return 'text-red-600';
  return 'text-gray-600';
}

function marginBg(value: number): string {
  if (value > 0) return 'bg-green-50 border-green-200';
  if (value < 0) return 'bg-red-50 border-red-200';
  return 'bg-gray-50 border-gray-200';
}

function computeMarginPercent(revenue: number, costs: number): number {
  if (revenue === 0) return costs === 0 ? 0 : -100;
  return ((revenue - costs) / revenue) * 100;
}

function formatMonthLabel(monthStr: string): string {
  // monthStr expected as "2026-01" or similar
  try {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
  } catch {
    return monthStr;
  }
}

// --- Component ---

export function FinancesPage() {
  const { fetchWithAuth } = useAuth();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Existing data
  const [summary, setSummary] = useState<FinancesSummary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'succeeded' | 'failed'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // New data
  const [costsData, setCostsData] = useState<CostsData | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingCosts, setLoadingCosts] = useState(true);
  const [loadingOverview, setLoadingOverview] = useState(true);

  // Period selector for existing revenue cards
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');

  // --- Data fetching ---

  const fetchSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const res = await fetchWithAuth(`${API_URL}/admin/finances/summary`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error('Error fetching finances summary:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, [fetchWithAuth]);

  const fetchPayments = useCallback(async () => {
    try {
      setLoadingPayments(true);
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: '20',
      });
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const res = await fetchWithAuth(`${API_URL}/admin/finances/payments?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPayments(data.payments || []);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [fetchWithAuth, statusFilter, page]);

  const fetchCosts = useCallback(async () => {
    try {
      setLoadingCosts(true);
      const res = await fetchWithAuth(`${API_URL}/admin/finances/costs`);
      if (res.ok) {
        const data = await res.json();
        setCostsData(data);
      }
    } catch (err) {
      console.error('Error fetching costs:', err);
    } finally {
      setLoadingCosts(false);
    }
  }, [fetchWithAuth]);

  const fetchOverview = useCallback(async () => {
    try {
      setLoadingOverview(true);
      const res = await fetchWithAuth(`${API_URL}/admin/finances/overview`);
      if (res.ok) {
        const data = await res.json();
        setOverview(data);
      }
    } catch (err) {
      console.error('Error fetching overview:', err);
    } finally {
      setLoadingOverview(false);
    }
  }, [fetchWithAuth]);

  // Initial load: fetch all data
  useEffect(() => {
    fetchSummary();
    fetchCosts();
    fetchOverview();
  }, [fetchSummary, fetchCosts, fetchOverview]);

  // Payments depend on filter/page
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // --- Derived values ---

  const getPeriodData = () => {
    if (!summary) return { current: 0, count: 0, label: 'Ce mois' };
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

  const totalSubscriptions = summary?.subscriptions.byLevel
    ? Object.values(summary.subscriptions.byLevel).reduce((a, b) => a + b, 0)
    : 0;

  // Costs derived
  const costPerGenToday = costsData && costsData.today.generations > 0
    ? costsData.today.cost / costsData.today.generations
    : 0;
  const costPerGenMonth = costsData && costsData.thisMonth.generations > 0
    ? costsData.thisMonth.cost / costsData.thisMonth.generations
    : 0;

  // Overview derived
  const monthlyMarginPercent = overview
    ? computeMarginPercent(overview.revenue.month, overview.costs.month)
    : 0;
  const yearlyMarginPercent = overview
    ? computeMarginPercent(overview.revenue.year, overview.costs.year)
    : 0;

  // Monthly totals
  const monthlyTotals = overview?.monthly?.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      costs: acc.costs + row.costs,
      margin: acc.margin + row.margin,
      generationCount: acc.generationCount + row.generationCount,
      paymentCount: acc.paymentCount + row.paymentCount,
    }),
    { revenue: 0, costs: 0, margin: 0, generationCount: 0, paymentCount: 0 }
  );

  // --- Loading screen ---

  const isInitialLoading = loadingSummary && loadingOverview && !summary && !overview;

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // --- Tab definitions ---

  const tabs: { key: TabKey; label: string; icon: typeof BarChart3 }[] = [
    { key: 'overview', label: "Vue d'ensemble", icon: BarChart3 },
    { key: 'payments', label: 'Paiements', icon: CreditCard },
    { key: 'costs', label: 'Co\u00FBts', icon: Cpu },
  ];

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finances</h1>
        <p className="text-gray-600 mt-1">Chiffre d'affaires, co\u00FBts et rentabilit\u00E9</p>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Onglets finances">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ==================== TAB: Vue d'ensemble ==================== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* P&L Overview cards */}
          {loadingOverview && !overview ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : overview ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Revenue card */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Chiffre d'affaires</span>
                  <DollarSign className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatEuro(overview.revenue.month)}</p>
                <p className="text-sm text-gray-500 mt-1">Ce mois</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-lg font-semibold text-gray-700">{formatEuro(overview.revenue.year)}</p>
                  <p className="text-xs text-gray-400">Cette ann\u00E9e</p>
                </div>
              </div>

              {/* Costs card */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Co\u00FBts</span>
                  <Cpu className="w-4 h-4 text-orange-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{formatEuro(overview.costs.month)}</p>
                <p className="text-sm text-gray-500 mt-1">Ce mois</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-lg font-semibold text-gray-700">{formatEuro(overview.costs.year)}</p>
                  <p className="text-xs text-gray-400">Cette ann\u00E9e</p>
                </div>
              </div>

              {/* Margin card */}
              <div className={`card border ${marginBg(overview.margin.month)}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Marge</span>
                  {overview.margin.month >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  )}
                </div>
                <p className={`text-2xl font-bold ${marginColor(overview.margin.month)}`}>
                  {formatEuro(overview.margin.month)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Ce mois</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className={`text-lg font-semibold ${marginColor(overview.margin.year)}`}>
                    {formatEuro(overview.margin.year)}
                  </p>
                  <p className="text-xs text-gray-400">Cette ann\u00E9e</p>
                </div>
              </div>

              {/* Margin percentage card */}
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Taux de marge</span>
                  <Percent className="w-4 h-4 text-primary-500" />
                </div>
                <p className={`text-2xl font-bold ${marginColor(monthlyMarginPercent)}`}>
                  {formatPercent(monthlyMarginPercent)}
                </p>
                <p className="text-sm text-gray-500 mt-1">Ce mois</p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className={`text-lg font-semibold ${marginColor(yearlyMarginPercent)}`}>
                    {formatPercent(yearlyMarginPercent)}
                  </p>
                  <p className="text-xs text-gray-400">Cette ann\u00E9e</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-8 text-gray-500">
              Donn\u00E9es non disponibles
            </div>
          )}

          {/* Revenue recap (existing) */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">R\u00E9capitulatif revenus</h2>
            <div className="flex gap-2 mb-4">
              {[
                { key: 'day', label: 'Jour' },
                { key: 'week', label: 'Semaine' },
                { key: 'month', label: 'Mois' },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key as 'day' | 'week' | 'month')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    period === p.key
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">{periodData.label}</p>
                <p className="text-xl font-bold text-gray-900">{formatEuro(periodData.current || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">{periodData.count || 0} paiement(s)</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Aujourd'hui</p>
                <p className="text-xl font-bold text-gray-900">{formatEuro(summary?.today.revenue || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary?.today.count || 0} paiement(s)</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">Cette semaine</p>
                <p className="text-xl font-bold text-gray-900">{formatEuro(summary?.thisWeek.revenue || 0)}</p>
                <p className="text-xs text-gray-500 mt-1">{summary?.thisWeek.count || 0} paiement(s)</p>
              </div>
              <div className="p-4 bg-primary-50 rounded-xl border border-primary-200">
                <div className="flex items-center gap-1 mb-1">
                  <CheckCircle className="w-3 h-3 text-primary-500" />
                  <p className="text-sm text-primary-700">Abonn\u00E9s actifs</p>
                </div>
                <p className="text-xl font-bold text-primary-700">{totalSubscriptions}</p>
                <div className="text-xs text-primary-600 mt-1 space-x-2">
                  {summary?.subscriptions.byLevel &&
                    Object.entries(summary.subscriptions.byLevel).map(([level, count]) => (
                      <span key={level}>L{level}: {count}</span>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Monthly breakdown table */}
          {overview?.monthly && overview.monthly.length > 0 && (
            <div className="card">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">D\u00E9tail mensuel</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-header">Mois</th>
                      <th className="table-header text-right">Revenus</th>
                      <th className="table-header text-right">Co\u00FBts</th>
                      <th className="table-header text-right">Marge</th>
                      <th className="table-header text-right">Marge %</th>
                      <th className="table-header text-right">G\u00E9n\u00E9rations</th>
                      <th className="table-header text-right">Paiements</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overview.monthly.map((row) => {
                      const pct = computeMarginPercent(row.revenue, row.costs);
                      return (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="table-cell font-medium text-gray-900">
                            {formatMonthLabel(row.month)}
                          </td>
                          <td className="table-cell text-right">{formatEuro(row.revenue)}</td>
                          <td className="table-cell text-right">{formatEuro(row.costs)}</td>
                          <td className={`table-cell text-right font-medium ${marginColor(row.margin)}`}>
                            {formatEuro(row.margin)}
                          </td>
                          <td className={`table-cell text-right text-sm ${marginColor(pct)}`}>
                            {formatPercent(pct)}
                          </td>
                          <td className="table-cell text-right text-gray-600">
                            {row.generationCount.toLocaleString('fr-FR')}
                          </td>
                          <td className="table-cell text-right text-gray-600">
                            {row.paymentCount.toLocaleString('fr-FR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  {monthlyTotals && (
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td className="table-cell font-bold text-gray-900">Total</td>
                        <td className="table-cell text-right font-bold">{formatEuro(monthlyTotals.revenue)}</td>
                        <td className="table-cell text-right font-bold">{formatEuro(monthlyTotals.costs)}</td>
                        <td className={`table-cell text-right font-bold ${marginColor(monthlyTotals.margin)}`}>
                          {formatEuro(monthlyTotals.margin)}
                        </td>
                        <td className={`table-cell text-right font-bold text-sm ${marginColor(
                          computeMarginPercent(monthlyTotals.revenue, monthlyTotals.costs)
                        )}`}>
                          {formatPercent(computeMarginPercent(monthlyTotals.revenue, monthlyTotals.costs))}
                        </td>
                        <td className="table-cell text-right font-bold">
                          {monthlyTotals.generationCount.toLocaleString('fr-FR')}
                        </td>
                        <td className="table-cell text-right font-bold">
                          {monthlyTotals.paymentCount.toLocaleString('fr-FR')}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}

          {/* Forecast section */}
          {overview?.forecast && overview.forecast.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-semibold text-gray-900">Pr\u00E9visions</h2>
                <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                  Estimation
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="table-header">Mois</th>
                      <th className="table-header text-right">Revenus estim\u00E9s</th>
                      <th className="table-header text-right">Co\u00FBts estim\u00E9s</th>
                      <th className="table-header text-right">Marge estim\u00E9e</th>
                      <th className="table-header text-right">Marge %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {overview.forecast.map((row) => {
                      const pct = computeMarginPercent(row.revenue, row.costs);
                      return (
                        <tr key={row.month} className="hover:bg-gray-50">
                          <td className="table-cell font-medium text-gray-400 italic">
                            {formatMonthLabel(row.month)}
                          </td>
                          <td className="table-cell text-right text-gray-400 italic">
                            {formatEuro(row.revenue)}
                          </td>
                          <td className="table-cell text-right text-gray-400 italic">
                            {formatEuro(row.costs)}
                          </td>
                          <td className={`table-cell text-right font-medium italic ${
                            row.margin >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatEuro(row.margin)}
                          </td>
                          <td className={`table-cell text-right text-sm italic ${
                            pct >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {formatPercent(pct)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3 italic">
                Les pr\u00E9visions sont bas\u00E9es sur les tendances des derniers mois et peuvent varier.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB: Paiements ==================== */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Quick revenue stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Aujourd'hui</span>
                <Calendar className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatEuro(summary?.today.revenue || 0)}</p>
              <p className="text-sm text-gray-500 mt-1">{summary?.today.count || 0} paiement(s)</p>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Cette semaine</span>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatEuro(summary?.thisWeek.revenue || 0)}</p>
              <p className="text-sm text-gray-500 mt-1">{summary?.thisWeek.count || 0} paiement(s)</p>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Ce mois</span>
                <DollarSign className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatEuro(summary?.thisMonth.revenue || 0)}</p>
              <p className="text-sm text-gray-500 mt-1">{summary?.thisMonth.count || 0} paiement(s)</p>
            </div>
            <div className="card bg-primary-50 border-primary-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-primary-500" />
                <span className="text-sm text-primary-700">Abonn\u00E9s actifs</span>
              </div>
              <p className="text-2xl font-bold text-primary-700">{totalSubscriptions}</p>
              <div className="text-sm text-primary-600 mt-1 space-x-2">
                {summary?.subscriptions.byLevel &&
                  Object.entries(summary.subscriptions.byLevel).map(([level, count]) => (
                    <span key={level}>L{level}: {count}</span>
                  ))}
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
                  <option value="succeeded">R\u00E9ussis</option>
                  <option value="failed">\u00C9chou\u00E9s</option>
                </select>
              </div>
            </div>

            {loadingPayments && payments.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Aucun paiement trouv\u00E9</div>
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
                      <tr
                        key={payment.id}
                        className={`hover:bg-gray-50 ${payment.status === 'failed' ? 'bg-red-50' : ''}`}
                      >
                        <td className="table-cell">
                          <p className="font-medium text-gray-900">{payment.email}</p>
                        </td>
                        <td className="table-cell">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                              payment.productType === 'subscription'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {payment.productType === 'subscription' ? 'Abo' : 'One-shot'}
                            {payment.period && ` (${payment.period})`}
                          </span>
                        </td>
                        <td className="table-cell">
                          {payment.productLevel !== null && (
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                payment.productLevel === 3
                                  ? 'bg-purple-100 text-purple-700'
                                  : payment.productLevel === 2
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {levelNames[payment.productLevel] || `Niveau ${payment.productLevel}`}
                            </span>
                          )}
                        </td>
                        <td className="table-cell font-medium">
                          {payment.amount} {payment.currency}
                        </td>
                        <td className="table-cell text-gray-600">
                          {new Date(payment.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="table-cell">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                              payment.status === 'succeeded'
                                ? 'bg-green-100 text-green-700'
                                : payment.status === 'failed'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-yellow-100 text-yellow-700'
                            }`}
                          >
                            {payment.status === 'succeeded' ? (
                              <>
                                <CheckCircle className="w-3 h-3" /> R\u00E9ussi
                              </>
                            ) : payment.status === 'failed' ? (
                              <>
                                <AlertCircle className="w-3 h-3" /> \u00C9chou\u00E9
                              </>
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
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-secondary"
                >
                  Pr\u00E9c\u00E9dent
                </button>
                <span className="px-4 py-2 text-sm text-gray-600">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="btn-secondary"
                >
                  Suivant
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB: Couts ==================== */}
      {activeTab === 'costs' && (
        <div className="space-y-6">
          {loadingCosts && !costsData ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : costsData ? (
            <>
              {/* Cost summary cards */}
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Aujourd'hui</span>
                    <Cpu className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatEuro(costsData.today.cost)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {costsData.today.generations} g\u00E9n\u00E9ration(s)
                  </p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Cette semaine</span>
                    <Cpu className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatEuro(costsData.thisWeek.cost)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {costsData.thisWeek.generations} g\u00E9n\u00E9ration(s)
                  </p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Ce mois</span>
                    <Cpu className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatEuro(costsData.thisMonth.cost)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {costsData.thisMonth.generations} g\u00E9n\u00E9ration(s)
                  </p>
                </div>
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">Cette ann\u00E9e</span>
                    <Cpu className="w-4 h-4 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{formatEuro(costsData.thisYear.cost)}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {costsData.thisYear.generations} g\u00E9n\u00E9ration(s)
                  </p>
                </div>
              </div>

              {/* Cost per generation */}
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Co\u00FBt par g\u00E9n\u00E9ration</h2>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Aujourd'hui</p>
                    <p className="text-xl font-bold text-gray-900">
                      {costPerGenToday > 0
                        ? costPerGenToday.toLocaleString('fr-FR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          }) + ' \u20AC'
                        : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {costsData.today.generations > 0
                        ? `${formatEuro(costsData.today.cost)} / ${costsData.today.generations} g\u00E9n.`
                        : 'Aucune g\u00E9n\u00E9ration'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Ce mois</p>
                    <p className="text-xl font-bold text-gray-900">
                      {costPerGenMonth > 0
                        ? costPerGenMonth.toLocaleString('fr-FR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          }) + ' \u20AC'
                        : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {costsData.thisMonth.generations > 0
                        ? `${formatEuro(costsData.thisMonth.cost)} / ${costsData.thisMonth.generations} g\u00E9n.`
                        : 'Aucune g\u00E9n\u00E9ration'}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-1">Cette ann\u00E9e (moy.)</p>
                    <p className="text-xl font-bold text-gray-900">
                      {costsData.thisYear.generations > 0
                        ? (costsData.thisYear.cost / costsData.thisYear.generations).toLocaleString('fr-FR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          }) + ' \u20AC'
                        : '-'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {costsData.thisYear.generations > 0
                        ? `${formatEuro(costsData.thisYear.cost)} / ${costsData.thisYear.generations} g\u00E9n.`
                        : 'Aucune g\u00E9n\u00E9ration'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cost breakdown detail from monthly data */}
              {overview?.monthly && overview.monthly.length > 0 && (
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    \u00C9volution mensuelle des co\u00FBts
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="table-header">Mois</th>
                          <th className="table-header text-right">Co\u00FBts</th>
                          <th className="table-header text-right">G\u00E9n\u00E9rations</th>
                          <th className="table-header text-right">Co\u00FBt / g\u00E9n.</th>
                          <th className="table-header text-right">Revenus</th>
                          <th className="table-header text-right">Ratio co\u00FBt/revenu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {overview.monthly.map((row) => {
                          const cpg = row.generationCount > 0 ? row.costs / row.generationCount : 0;
                          const costRatio = row.revenue > 0 ? (row.costs / row.revenue) * 100 : 0;
                          return (
                            <tr key={row.month} className="hover:bg-gray-50">
                              <td className="table-cell font-medium text-gray-900">
                                {formatMonthLabel(row.month)}
                              </td>
                              <td className="table-cell text-right">{formatEuro(row.costs)}</td>
                              <td className="table-cell text-right text-gray-600">
                                {row.generationCount.toLocaleString('fr-FR')}
                              </td>
                              <td className="table-cell text-right text-gray-600">
                                {cpg > 0
                                  ? cpg.toLocaleString('fr-FR', {
                                      minimumFractionDigits: 4,
                                      maximumFractionDigits: 4,
                                    }) + ' \u20AC'
                                  : '-'}
                              </td>
                              <td className="table-cell text-right">{formatEuro(row.revenue)}</td>
                              <td className="table-cell text-right">
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                    costRatio < 30
                                      ? 'bg-green-100 text-green-700'
                                      : costRatio < 60
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {costRatio.toLocaleString('fr-FR', {
                                    minimumFractionDigits: 1,
                                    maximumFractionDigits: 1,
                                  })}
                                  %
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {monthlyTotals && (
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td className="table-cell font-bold text-gray-900">Total</td>
                            <td className="table-cell text-right font-bold">
                              {formatEuro(monthlyTotals.costs)}
                            </td>
                            <td className="table-cell text-right font-bold">
                              {monthlyTotals.generationCount.toLocaleString('fr-FR')}
                            </td>
                            <td className="table-cell text-right font-bold">
                              {monthlyTotals.generationCount > 0
                                ? (monthlyTotals.costs / monthlyTotals.generationCount).toLocaleString(
                                    'fr-FR',
                                    { minimumFractionDigits: 4, maximumFractionDigits: 4 }
                                  ) + ' \u20AC'
                                : '-'}
                            </td>
                            <td className="table-cell text-right font-bold">
                              {formatEuro(monthlyTotals.revenue)}
                            </td>
                            <td className="table-cell text-right">
                              {monthlyTotals.revenue > 0 && (
                                <span
                                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                                    (monthlyTotals.costs / monthlyTotals.revenue) * 100 < 30
                                      ? 'bg-green-100 text-green-700'
                                      : (monthlyTotals.costs / monthlyTotals.revenue) * 100 < 60
                                      ? 'bg-yellow-100 text-yellow-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {((monthlyTotals.costs / monthlyTotals.revenue) * 100).toLocaleString(
                                    'fr-FR',
                                    { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                                  )}
                                  %
                                </span>
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card text-center py-8 text-gray-500">
              Donn\u00E9es de co\u00FBts non disponibles
            </div>
          )}
        </div>
      )}
    </div>
  );
}
