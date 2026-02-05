import { useState, useEffect } from 'react';
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Mail, Ban, X, Loader2, Save } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

interface UserDetail extends User {
  birthDate: string | null;
  gender: string | null;
  lang: string | null;
  generationsUsedThisMonth: number;
  marketingConsent: boolean;
  photos: { id: number; path: string; verified: boolean }[];
  dreams: { id: number; title: string; status: string; runs: { id: number; status: string }[] }[];
  testimonials: { id: number; status: string; rating: number; text: string }[];
  invitation: { id: number; code: string } | null;
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
  const { fetchWithAuth } = useAuth();
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

  // Detail modal state
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editFields, setEditFields] = useState<{ subscriptionLevel: number; freeGenerations: number; isTestAccount: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Message
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchWithAuth, page, filters]);

  async function fetchUsers() {
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

      const response = await fetchWithAuth(`${API_URL}/admin/users?${params}`);

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
    if (user.deletedAt) return { label: 'Supprime', color: 'bg-red-100 text-red-700' };
    if (user.subscriptionLevel > 0 && user.subscriptionEnd) {
      const endDate = new Date(user.subscriptionEnd);
      if (endDate < new Date()) return { label: 'Expire', color: 'bg-orange-100 text-orange-700' };
      return { label: 'Actif', color: 'bg-green-100 text-green-700' };
    }
    if (user.freeGenerations > 0) return { label: 'Free', color: 'bg-blue-100 text-blue-700' };
    return { label: 'Inactif', color: 'bg-gray-100 text-gray-700' };
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  // View user detail
  const handleViewUser = async (userId: number) => {
    try {
      setDetailLoading(true);
      setSelectedUser(null);
      const response = await fetchWithAuth(`${API_URL}/admin/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        const u = data.user;
        setSelectedUser(u);
        setEditFields({
          subscriptionLevel: u.subscriptionLevel,
          freeGenerations: u.freeGenerations,
          isTestAccount: u.isTestAccount,
        });
      } else {
        showMsg('error', 'Erreur chargement utilisateur');
      }
    } catch {
      showMsg('error', 'Erreur reseau');
    } finally {
      setDetailLoading(false);
    }
  };

  // Save user edits
  const handleSaveUser = async () => {
    if (!selectedUser || !editFields) return;
    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_URL}/admin/users/${selectedUser.id}`, {
        method: 'PUT',
        body: JSON.stringify(editFields),
      });
      if (response.ok) {
        showMsg('success', 'Utilisateur mis a jour');
        setSelectedUser(null);
        fetchUsers();
      } else {
        showMsg('error', 'Erreur lors de la mise a jour');
      }
    } catch {
      showMsg('error', 'Erreur reseau');
    } finally {
      setSaving(false);
    }
  };

  // Copy email
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email).then(() => {
      showMsg('success', `Email copie : ${email}`);
    });
  };

  // Delete user
  const handleDeleteUser = async (userId: number) => {
    try {
      setDeleting(true);
      const response = await fetchWithAuth(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        showMsg('success', 'Utilisateur supprime');
        setDeleteConfirm(null);
        fetchUsers();
      } else {
        showMsg('error', 'Erreur lors de la suppression');
      }
    } catch {
      showMsg('error', 'Erreur reseau');
    } finally {
      setDeleting(false);
    }
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
        <p className="text-gray-600 mt-1">Gerez les comptes utilisateurs</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

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
                  <span className="text-sm text-gray-700">Afficher les supprimes</span>
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
                <th className="table-header">Reves</th>
                <th className="table-header">Generations</th>
                <th className="table-header">Inscrit le</th>
                <th className="table-header">Statut</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-gray-500">
                    Aucun utilisateur trouve
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
                          <button
                            onClick={() => handleViewUser(user.id)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Voir detail"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleCopyEmail(user.email)}
                            className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                            title="Copier email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                          {!user.deletedAt && (
                            <button
                              onClick={() => setDeleteConfirm(user.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer"
                            >
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

      {/* Delete confirmation dialog */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirmer la suppression</h3>
            <p className="text-gray-600 mb-6">
              Etes-vous sur de vouloir supprimer cet utilisateur ? Cette action est reversible (soft delete).
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary">
                Annuler
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirm)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User detail modal */}
      {(selectedUser || detailLoading) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => { setSelectedUser(null); setEditFields(null); }}>
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {detailLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              </div>
            ) : selectedUser && editFields && (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </h3>
                  <button onClick={() => { setSelectedUser(null); setEditFields(null); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <span className="text-gray-500">Email</span>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Pays</span>
                    <p className="font-medium">{selectedUser.country || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Langue</span>
                    <p className="font-medium">{selectedUser.lang || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Genre</span>
                    <p className="font-medium">{selectedUser.gender || '-'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Inscription</span>
                    <p className="font-medium">{new Date(selectedUser.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Generations ce mois</span>
                    <p className="font-medium">{selectedUser.generationsUsedThisMonth} / {selectedUser.totalGenerations} total</p>
                  </div>
                  {selectedUser.invitation && (
                    <div>
                      <span className="text-gray-500">Code invitation</span>
                      <p className="font-medium">{selectedUser.invitation.code}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">Reves / Photos / Temoignages</span>
                    <p className="font-medium">{selectedUser.dreams?.length || 0} / {selectedUser.photos?.length || 0} / {selectedUser.testimonials?.length || 0}</p>
                  </div>
                </div>

                {/* Editable fields */}
                <div className="border-t border-gray-200 pt-4 mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Modifier</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Niveau abonnement</label>
                      <select
                        value={editFields.subscriptionLevel}
                        onChange={(e) => setEditFields({ ...editFields, subscriptionLevel: parseInt(e.target.value) })}
                        className="input w-full"
                      >
                        {Object.entries(levelNames).map(([val, name]) => (
                          <option key={val} value={val}>{name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">Generations gratuites</label>
                      <input
                        type="number"
                        value={editFields.freeGenerations}
                        onChange={(e) => setEditFields({ ...editFields, freeGenerations: parseInt(e.target.value) || 0 })}
                        className="input w-full"
                        min={0}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editFields.isTestAccount}
                          onChange={(e) => setEditFields({ ...editFields, isTestAccount: e.target.checked })}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">Compte de test</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button onClick={() => { setSelectedUser(null); setEditFields(null); }} className="btn-secondary">
                    Fermer
                  </button>
                  <button
                    onClick={handleSaveUser}
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Enregistrer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
