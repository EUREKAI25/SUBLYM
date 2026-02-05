import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Loader2, Save, X, Layers } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface SceneType {
  id: number;
  code: string;
  mode: string;
  description: string;
  minRatio: number;
  maxRatio: number;
  examples: string[];
  position: string | null;
  allowsCameraLook: boolean;
  enabled: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SceneTypeFormData {
  code: string;
  mode: string;
  description: string;
  minRatio: number;
  maxRatio: number;
  examples: string;
  position: string;
  allowsCameraLook: boolean;
}

const defaultFormData: SceneTypeFormData = {
  code: '',
  mode: 'all',
  description: '',
  minRatio: 0,
  maxRatio: 1,
  examples: '',
  position: '',
  allowsCameraLook: false,
};

const modeLabels: Record<string, string> = {
  all: 'Tous',
  scenario: 'Scenario',
  scenario_pub: 'Scenario Pub',
  free_scenes: 'Scenes libres',
};

const modeColors: Record<string, string> = {
  all: 'bg-blue-100 text-blue-700',
  scenario: 'bg-indigo-100 text-indigo-700',
  scenario_pub: 'bg-purple-100 text-purple-700',
  free_scenes: 'bg-amber-100 text-amber-700',
};

export function SceneTypesPage() {
  const { fetchWithAuth } = useAuth();
  const [sceneTypes, setSceneTypes] = useState<SceneType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<SceneTypeFormData>({ ...defaultFormData });
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toggling enabled
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    fetchSceneTypes();
  }, [fetchWithAuth]);

  async function fetchSceneTypes() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/scene-types`);
      if (response.ok) {
        const data = await response.json();
        setSceneTypes(data.sceneTypes || []);
      }
    } catch (err) {
      console.error('Error fetching scene types:', err);
    } finally {
      setLoading(false);
    }
  }

  const openCreateModal = () => {
    setEditingId(null);
    setFormData({ ...defaultFormData });
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (st: SceneType) => {
    setEditingId(st.id);
    setFormData({
      code: st.code,
      mode: st.mode,
      description: st.description,
      minRatio: st.minRatio,
      maxRatio: st.maxRatio,
      examples: st.examples.join(', '),
      position: st.position || '',
      allowsCameraLook: st.allowsCameraLook,
    });
    setFormError(null);
    setShowModal(true);
  };

  const updateFormField = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.code.trim()) {
      setFormError('Le code est requis');
      return;
    }
    if (formData.minRatio < 0 || formData.minRatio > 1) {
      setFormError('Le ratio min doit etre entre 0 et 1');
      return;
    }
    if (formData.maxRatio < 0 || formData.maxRatio > 1) {
      setFormError('Le ratio max doit etre entre 0 et 1');
      return;
    }
    if (formData.minRatio > formData.maxRatio) {
      setFormError('Le ratio min ne peut pas etre superieur au ratio max');
      return;
    }

    const payload = {
      code: formData.code.trim(),
      mode: formData.mode,
      description: formData.description.trim(),
      minRatio: formData.minRatio,
      maxRatio: formData.maxRatio,
      examples: formData.examples
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.length > 0),
      position: formData.position.trim() || null,
      allowsCameraLook: formData.allowsCameraLook,
    };

    try {
      setSaving(true);
      setFormError(null);

      const url = editingId
        ? `${API_URL}/admin/scene-types/${editingId}`
        : `${API_URL}/admin/scene-types`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetchWithAuth(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowModal(false);
        setFormData({ ...defaultFormData });
        setEditingId(null);
        await fetchSceneTypes();
      } else {
        const err = await response.json().catch(() => ({}));
        setFormError(err.message || 'Erreur lors de la sauvegarde');
      }
    } catch {
      setFormError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setDeleting(true);
      setDeleteError(null);
      const response = await fetchWithAuth(`${API_URL}/admin/scene-types/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDeleteConfirmId(null);
        await fetchSceneTypes();
      } else {
        const err = await response.json().catch(() => ({}));
        setDeleteError(err.message || 'Erreur lors de la suppression');
      }
    } catch {
      setDeleteError('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleEnabled = async (st: SceneType) => {
    try {
      setTogglingId(st.id);
      const response = await fetchWithAuth(`${API_URL}/admin/scene-types/${st.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !st.enabled }),
      });
      if (response.ok) {
        setSceneTypes((prev) =>
          prev.map((s) => (s.id === st.id ? { ...s, enabled: !s.enabled } : s))
        );
      }
    } catch (err) {
      console.error('Error toggling scene type:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const Toggle = ({
    checked,
    onChange,
    disabled,
  }: {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
  }) => (
    <label className={`relative inline-flex items-center ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only peer"
      />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
    </label>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-7 h-7 text-primary-600" />
            Types de scenes
          </h1>
          <p className="text-gray-600 mt-1">
            Gerez les types de scenes du pipeline de generation SUBLYM
          </p>
        </div>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Ajouter un type
        </button>
      </div>

      {/* Table */}
      {sceneTypes.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun type de scene configure.
          <button onClick={openCreateModal} className="block mx-auto mt-4 btn-primary">
            <Plus className="w-4 h-4 inline mr-2" />
            Creer le premier type
          </button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-header">Code</th>
                  <th className="table-header">Mode</th>
                  <th className="table-header">Description</th>
                  <th className="table-header">Min%</th>
                  <th className="table-header">Max%</th>
                  <th className="table-header">Position</th>
                  <th className="table-header">Camera Look</th>
                  <th className="table-header">Actif</th>
                  <th className="table-header">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sceneTypes.map((st) => (
                  <tr key={st.id} className={`hover:bg-gray-50 ${!st.enabled ? 'opacity-50' : ''}`}>
                    <td className="table-cell font-medium font-mono text-sm">{st.code}</td>
                    <td className="table-cell">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          modeColors[st.mode] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {modeLabels[st.mode] || st.mode}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600 max-w-xs">
                      <span className="block truncate" title={st.description}>
                        {st.description.length > 60
                          ? st.description.substring(0, 60) + '...'
                          : st.description}
                      </span>
                    </td>
                    <td className="table-cell text-center">{Math.round(st.minRatio * 100)}%</td>
                    <td className="table-cell text-center">{Math.round(st.maxRatio * 100)}%</td>
                    <td className="table-cell">
                      {st.position ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
                          {st.position}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell text-center">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          st.allowsCameraLook
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {st.allowsCameraLook ? 'Oui' : 'Non'}
                      </span>
                    </td>
                    <td className="table-cell">
                      <Toggle
                        checked={st.enabled}
                        onChange={() => handleToggleEnabled(st)}
                        disabled={togglingId === st.id}
                      />
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(st)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError(null);
                            setDeleteConfirmId(st.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Count */}
          <div className="px-6 py-4 border-t border-gray-200 text-sm text-gray-600">
            {sceneTypes.length} type(s) de scene
            {' '}
            <span className="text-gray-400">
              ({sceneTypes.filter((s) => s.enabled).length} actif(s))
            </span>
          </div>
        </div>
      )}

      {/* ===== CREATE / EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">
                {editingId ? 'Modifier le type de scene' : 'Nouveau type de scene'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {formError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <X className="w-4 h-4 flex-shrink-0" /> {formError}
                </div>
              )}

              {/* Code + Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => updateFormField('code', e.target.value)}
                    className="input"
                    placeholder="ex: close_up_face"
                  />
                </div>
                <div>
                  <label className="label">Mode *</label>
                  <select
                    value={formData.mode}
                    onChange={(e) => updateFormField('mode', e.target.value)}
                    className="input"
                  >
                    <option value="all">Tous</option>
                    <option value="scenario">Scenario</option>
                    <option value="scenario_pub">Scenario Pub</option>
                    <option value="free_scenes">Scenes libres</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="label">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormField('description', e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="Description du type de scene..."
                  rows={3}
                />
              </div>

              {/* Ratios */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Ratios</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Ratio min (0-1)</label>
                    <input
                      type="number"
                      value={formData.minRatio}
                      onChange={(e) =>
                        updateFormField('minRatio', parseFloat(e.target.value) || 0)
                      }
                      className="input"
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      = {Math.round(formData.minRatio * 100)}%
                    </p>
                  </div>
                  <div>
                    <label className="label">Ratio max (0-1)</label>
                    <input
                      type="number"
                      value={formData.maxRatio}
                      onChange={(e) =>
                        updateFormField('maxRatio', parseFloat(e.target.value) || 0)
                      }
                      className="input"
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      = {Math.round(formData.maxRatio * 100)}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Examples */}
              <div className="border-t border-gray-200 pt-4">
                <label className="label">Exemples (separes par des virgules)</label>
                <input
                  type="text"
                  value={formData.examples}
                  onChange={(e) => updateFormField('examples', e.target.value)}
                  className="input"
                  placeholder="ex: portrait serein, visage lumineux, regard inspire"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.examples
                    .split(',')
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0).length}{' '}
                  exemple(s)
                </p>
              </div>

              {/* Position + Camera Look */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Options</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Position (optionnel)</label>
                    <input
                      type="text"
                      value={formData.position}
                      onChange={(e) => updateFormField('position', e.target.value)}
                      className="input"
                      placeholder="ex: center, left, right"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.allowsCameraLook}
                        onChange={(e) => updateFormField('allowsCameraLook', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700">Autorise Camera Look</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
                disabled={saving}
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="btn-primary flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editingId ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {deleteConfirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h2 className="text-lg font-bold text-gray-900">Supprimer ce type de scene ?</h2>
              </div>
              <p className="text-gray-600 text-sm mb-2">
                Cette action est irreversible. Si ce type est utilise dans des generations existantes, la suppression pourrait echouer.
              </p>
              {(() => {
                const st = sceneTypes.find((s) => s.id === deleteConfirmId);
                return st ? (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm mb-4">
                    <span className="font-medium font-mono">{st.code}</span>
                    <span className="text-gray-500 ml-2">
                      ({modeLabels[st.mode] || st.mode})
                    </span>
                  </div>
                ) : null;
              })()}
              {deleteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  <X className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
                className="btn-secondary"
                disabled={deleting}
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="btn-danger flex items-center gap-2"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
