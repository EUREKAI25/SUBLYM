import { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Mail, Ban, X, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  subscriptionLevel: number;
  subscriptionEnd: string | null;
  freeGenerations: number;
  totalGenerations: number;
  isTestAccount: boolean;
  dreamsCount: number;
  photosCount: number;
  createdAt: string;
  deletedAt: string | null;
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

const levels = [
  { value: 'all', label: 'Tous les niveaux' },
  { value: '0', label: 'Gratuit' },
  { value: '1', label: 'Essentiel' },
  { value: '2', label: 'Standard' },
  { value: '3', label: 'Premium' },
];

export function UsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    level: 'all',
    deleted: false,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const perPage = 20;

  useEffect(() => {
    fetchUsers();
  }, [token, page, filters]);

  async function fetchUsers() {
    if (!token) return;

    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        perPage: perPage.toString(),
      });

      if (filters.level !== 'all') {
        params.append('subscriptionLevel', filters.level);
      }
      if (filters.deleted) {
        params.append('deleted', 'true');
      }
      if (search) {
        params.append('email', search);
      }

      const response = await fetch(`${API_URL}/admin/users?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setTotal(data.pagination?.total || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const updateFilter = (key: string, value: any) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({ level: 'all', deleted: false });
    setSearch('');
    setPage(1);
  };

  const activeFiltersCount = (filters.level !== 'all' ? 1 : 0) + (filters.deleted ? 1 : 0) + (search ? 1 : 0);

  const getStatus = (user: User) => {
    if (user.deletedAt) return { label: 'Supprimé', color: 'bg-red-100 text-red-700' };
    if (user.subscriptionLevel > 0 && user.subscriptionEnd) {
      const endDate = new Date(user.subscriptionEnd);
      if (endDate < new Date()) return { label: 'Expiré', color: 'bg-orange-100 text-orange-700' };
      return { label: 'Actif', color: 'bg-green-100 text-green-700' };
    }
    if (user.freeGenerations > 0) return { label: 'Free', color: 'bg-blue-100 text-blue-700' };
    return { label: 'Inactif', color: 'bg-gray-100 text-gray-700' };
  };

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Utilisateurs</h1>
        <p className="text-gray-600 mt-1">Gérez les comptes utilisateurs</p>
      </div>

      {/* Search & Filters */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par email..."
              className="input pl-10"
            />
          </div>
          <button type="submit" className="btn-primary">
            Rechercher
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${activeFiltersCount > 0 ? 'border-primary-500 text-primary-600' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filtres
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </form>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="label">Niveau</label>
                <select
                  value={filters.level}
                  onChange={(e) => updateFilter('level', e.target.value)}
                  className="input"
                >
                  {levels.map(l => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Statut</label>
                <label className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    checked={filters.deleted}
                    onChange={(e) => updateFilter('deleted', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Afficher les supprimés</span>
                </label>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button
                onClick={clearFilters}
                className="mt-3 text-sm text-primary-600 hover:underline flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Effacer tous les filtres
              </button>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="table-header">Nom</th>
                <th className="table-header">Email</th>
                <th className="table-header">Pays</th>
                <th className="table-header">Niveau</th>
                <th className="table-header">Rêves</th>
                <th className="table-header">Générations</th>
                <th className="table-header">Inscrit le</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((user) => {
                  const status = getStatus(user);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">
                        {user.firstName} {user.lastName}
                        {user.isTestAccount && (
                          <span className="ml-2 text-xs text-orange-600">(test)</span>
                        )}
                      </td>
                      <td className="table-cell text-gray-600">{user.email}</td>
                      <td className="table-cell">
                        {user.country && (
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                            {user.country}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${levelColors[user.subscriptionLevel] || levelColors[0]}`}>
                          {levelNames[user.subscriptionLevel] || 'Gratuit'}
                        </span>
                      </td>
                      <td className="table-cell">{user.dreamsCount}</td>
                      <td className="table-cell">
                        {user.totalGenerations}
                        {user.freeGenerations > 0 && (
                          <span className="text-xs text-green-600 ml-1">(+{user.freeGenerations} free)</span>
                        )}
                      </td>
                      <td className="table-cell text-gray-600">
                        {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="table-cell">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Voir détail">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors" title="Envoyer email">
                            <Mail className="w-4 h-4" />
                          </button>
                          {!user.deletedAt && (
                            <button className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Supprimer">
                              <Ban className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {total} utilisateur(s)
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50" 
              disabled={page === 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-gray-600">Page {page} / {totalPages}</span>
            <button 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              disabled={page >= totalPages}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
