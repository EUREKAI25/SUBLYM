import { useEffect, useState } from 'react';
import { Users, DollarSign, Video, Smile, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface DashboardStats {
  users: { total: number; today: number };
  dreams: { total: number };
  runs: { completed: number };
  revenue: { total: number; today: number };
}

interface RecentUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  subscriptionLevel: number;
  createdAt: string;
}

interface SmileConfig {
  id: number;
  country: string;
  threshold: number;
  currentCount: number;
  isActive: boolean;
}

const levelNames: Record<number, string> = {
  0: 'Gratuit',
  1: 'Essentiel',
  2: 'Standard',
  3: 'Premium',
};

const levelColors: Record<number, string> = {
  0: 'bg-gray-100 text-gray-700',
  1: 'bg-blue-100 text-blue-700',
  2: 'bg-indigo-100 text-indigo-700',
  3: 'bg-purple-100 text-purple-700',
};

export function DashboardPage() {
  const { fetchWithAuth } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [smileConfigs, setSmileConfigs] = useState<SmileConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch dashboard stats
        const statsRes = await fetchWithAuth(`${API_URL}/admin/dashboard`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Fetch recent users
        const usersRes = await fetchWithAuth(`${API_URL}/admin/users?perPage=5`);
        if (usersRes.ok) {
          const usersData = await usersRes.json();
          setRecentUsers(usersData.users || []);
        }

        // Fetch smile configs (we'll create this endpoint or use existing data)
        // For now, we'll use mock data until the endpoint is ready
        setSmileConfigs([
          { id: 1, country: 'ALL', threshold: 1000, currentCount: 0, isActive: true },
        ]);

      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [fetchWithAuth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-700 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  const statsCards = [
    {
      label: 'Utilisateurs',
      value: stats?.users.total?.toLocaleString() || '0',
      change: stats?.users.today ? `+${stats.users.today} aujourd'hui` : '',
      trend: 'up',
      icon: Users,
      color: 'bg-blue-500',
    },
    {
      label: 'Chiffre d\'affaires',
      value: `${stats?.revenue.total?.toLocaleString() || '0'} €`,
      change: stats?.revenue.today ? `+${stats.revenue.today}€ aujourd'hui` : 'Cumul depuis le lancement',
      trend: 'up',
      icon: DollarSign,
      color: 'bg-green-500',
    },
    {
      label: 'Vidéos générées',
      value: stats?.runs.completed?.toLocaleString() || '0',
      change: '',
      trend: 'up',
      icon: Video,
      color: 'bg-purple-500',
    },
    {
      label: 'Rêves créés',
      value: stats?.dreams.total?.toLocaleString() || '0',
      change: '',
      trend: 'up',
      icon: Smile,
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Vue d'ensemble de SUBLYM</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat) => (
          <div key={stat.label} className="card">
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.change && (
                <div className={`flex items-center gap-1 text-sm ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.trend === 'up' ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-sm text-gray-600">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent users */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Derniers inscrits</h2>
          {recentUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucun utilisateur pour le moment</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Nom</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Email</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Niveau</th>
                    <th className="text-left py-3 text-sm font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100">
                      <td className="py-3 text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName?.charAt(0)}.
                      </td>
                      <td className="py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          levelColors[user.subscriptionLevel] || levelColors[0]
                        }`}>
                          {levelNames[user.subscriptionLevel] || 'Gratuit'}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Smile status by country */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Offre Smile par pays</h2>
          {smileConfigs.length === 0 ? (
            <p className="text-gray-500 text-sm">Aucune configuration Smile</p>
          ) : (
            <div className="space-y-4">
              {smileConfigs.map((config) => {
                const percent = config.threshold > 0 
                  ? Math.round((config.currentCount / config.threshold) * 100) 
                  : 0;
                return (
                  <div key={config.id}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {config.country === 'ALL' ? 'Global' : config.country}
                      </span>
                      <span className="text-sm text-gray-500">
                        {config.currentCount.toLocaleString()} / {config.threshold.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(percent, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
