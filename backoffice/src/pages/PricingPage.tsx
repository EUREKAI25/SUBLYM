import { useState, useEffect } from 'react';
import { Save, Edit2, Loader2, Plus, Trash2, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface PricingLevel {
  id: number;
  level: number;
  name: string;
  description: string | null;
  photosMin: number;
  photosMax: number;
  keyframesCount: number;
  videoEnabled: boolean;
  scenesCount: number;
  generationsPerMonth: number;
  subliminalEnabled: boolean;
  priceMonthly: number;
  priceYearly: number;
  priceOneShot: number | null;
  currency: string;
  enabled: boolean;
  displayOrder: number;
  badgeText: string | null;
}

type NewPricingLevel = Omit<PricingLevel, 'id'>;

const defaultNewLevel: NewPricingLevel = {
  level: 0,
  name: '',
  description: '',
  photosMin: 3,
  photosMax: 5,
  keyframesCount: 5,
  videoEnabled: true,
  scenesCount: 5,
  generationsPerMonth: 1,
  subliminalEnabled: false,
  priceMonthly: 0,
  priceYearly: 0,
  priceOneShot: null,
  currency: 'EUR',
  enabled: true,
  displayOrder: 0,
  badgeText: null,
};

export function PricingPage() {
  const { fetchWithAuth } = useAuth();
  const [levels, setLevels] = useState<PricingLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLevel, setNewLevel] = useState<NewPricingLevel>({ ...defaultNewLevel });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    fetchPricing();
  }, [fetchWithAuth]);

  async function fetchPricing() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/pricing`);
      if (response.ok) {
        const data = await response.json();
        setLevels(data.levels || []);
      }
    } catch (err) {
      console.error('Error fetching pricing:', err);
    } finally {
      setLoading(false);
    }
  }

  const updateLevel = (levelIndex: number, field: string, value: number | boolean | string | null) => {
    const newLevels = [...levels];
    newLevels[levelIndex] = { ...newLevels[levelIndex], [field]: value };
    setLevels(newLevels);
    setHasChanges(true);
  };

  const savePricing = async () => {
    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_URL}/admin/pricing`, {
        method: 'PUT',
        body: JSON.stringify({ levels }),
      });
      if (response.ok) {
        setHasChanges(false);
        setEditingLevel(null);
        await fetchPricing();
        alert('Configuration sauvegardee !');
      } else {
        const err = await response.json().catch(() => ({}));
        alert(err.message || 'Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Error saving pricing:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    const maxLevel = levels.length > 0 ? Math.max(...levels.map((l) => l.level)) : -1;
    setNewLevel({ ...defaultNewLevel, level: maxLevel + 1, displayOrder: levels.length });
    setCreateError(null);
    setShowCreateModal(true);
  };

  const updateNewLevel = (field: string, value: number | boolean | string | null) => {
    setNewLevel((prev) => ({ ...prev, [field]: value }));
  };

  const createPlan = async () => {
    if (!newLevel.name.trim()) { setCreateError('Le nom du plan est requis'); return; }
    if (newLevel.priceMonthly <= 0 && newLevel.priceYearly <= 0) { setCreateError('Au moins un prix doit etre superieur a 0'); return; }
    try {
      setCreating(true);
      setCreateError(null);
      const response = await fetchWithAuth(`${API_URL}/admin/pricing`, { method: 'POST', body: JSON.stringify(newLevel) });
      if (response.ok) {
        setShowCreateModal(false);
        setNewLevel({ ...defaultNewLevel });
        await fetchPricing();
      } else {
        const err = await response.json().catch(() => ({}));
        setCreateError(err.message || 'Erreur lors de la creation');
      }
    } catch {
      setCreateError('Erreur lors de la creation');
    } finally {
      setCreating(false);
    }
  };

  const deletePlan = async (id: number) => {
    try {
      setDeleting(true);
      setDeleteError(null);
      const response = await fetchWithAuth(`${API_URL}/admin/pricing/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setDeleteConfirmId(null);
        await fetchPricing();
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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
    </label>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuration Pricing</h1>
          <p className="text-gray-600 mt-1">Gerez les niveaux d'abonnement et tarifs</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={openCreateModal} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nouveau plan
          </button>
          {hasChanges && (
            <button onClick={savePricing} className="btn-primary flex items-center gap-2" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder
            </button>
          )}
        </div>
      </div>

      {levels.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun niveau de tarification configure.
          <button onClick={openCreateModal} className="block mx-auto mt-4 btn-primary">
            <Plus className="w-4 h-4 inline mr-2" /> Creer le premier plan
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {levels.map((level, index) => (
            <div key={level.id} className={`card relative ${!level.enabled ? 'opacity-60' : ''}`}>
              {/* Actions */}
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <button
                  onClick={() => { setDeleteError(null); setDeleteConfirmId(level.id); }}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer ce plan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingLevel(editingLevel === index ? null : index)}
                  className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>

              {/* Header */}
              <div className="text-center mb-4">
                {level.badgeText && level.enabled && (
                  <span className="inline-flex px-3 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-700 mb-2">
                    {level.badgeText}
                  </span>
                )}
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  level.level === 3 ? 'bg-purple-100 text-purple-700'
                    : level.level === 2 ? 'bg-indigo-100 text-indigo-700'
                    : level.level === 1 ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  Niveau {level.level}
                </span>
                {editingLevel === index ? (
                  <input type="text" value={level.name} onChange={(e) => updateLevel(index, 'name', e.target.value)} className="input mt-2 text-center text-xl font-bold" />
                ) : (
                  <h3 className="text-xl font-bold text-gray-900 mt-2">{level.name}</h3>
                )}
                {!level.enabled && <span className="text-xs text-red-500 mt-1 block">Desactive</span>}
              </div>

              <div className="space-y-1">
                {/* Description */}
                {editingLevel === index && (
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-gray-600 text-sm block mb-1">Description</span>
                    <input type="text" value={level.description || ''} onChange={(e) => updateLevel(index, 'description', e.target.value || null)} className="input text-sm" placeholder="Description du plan..." />
                  </div>
                )}

                {/* ===== SECTION: Requis pour la soumission ===== */}
                <div className="pt-2 pb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Requis (soumission)</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Photos requises</span>
                  {editingLevel === index ? (
                    <div className="flex items-center gap-1">
                      <input type="number" value={level.photosMin} onChange={(e) => updateLevel(index, 'photosMin', parseInt(e.target.value))} className="input w-14 text-center text-sm" min={1} />
                      <span className="text-gray-400">a</span>
                      <input type="number" value={level.photosMax} onChange={(e) => updateLevel(index, 'photosMax', parseInt(e.target.value))} className="input w-14 text-center text-sm" min={1} />
                    </div>
                  ) : (
                    <span className="font-medium text-sm">{level.photosMin} a {level.photosMax}</span>
                  )}
                </div>

                {/* ===== SECTION: Generation autorisee ===== */}
                <div className="pt-3 pb-1">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Generation autorisee</span>
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Generations/mois</span>
                  {editingLevel === index ? (
                    <div className="flex items-center gap-2">
                      <input type="number" value={level.generationsPerMonth} onChange={(e) => updateLevel(index, 'generationsPerMonth', parseInt(e.target.value))} className="input w-16 text-center text-sm" min={-1} />
                      {level.generationsPerMonth === -1 && <span className="text-xs text-primary-600 font-medium">Illimite</span>}
                    </div>
                  ) : (
                    <span className="font-medium text-sm">{level.generationsPerMonth === -1 ? 'Illimite' : level.generationsPerMonth}</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Keyframes (photos)</span>
                  {editingLevel === index ? (
                    <input type="number" value={level.keyframesCount} onChange={(e) => updateLevel(index, 'keyframesCount', parseInt(e.target.value))} className="input w-16 text-center text-sm" min={1} />
                  ) : (
                    <span className="font-medium text-sm">{level.keyframesCount}</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Scenes video</span>
                  {editingLevel === index ? (
                    <input type="number" value={level.scenesCount} onChange={(e) => updateLevel(index, 'scenesCount', parseInt(e.target.value))} className="input w-16 text-center text-sm" min={1} />
                  ) : (
                    <span className="font-medium text-sm">{level.scenesCount}</span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Video</span>
                  {editingLevel === index ? (
                    <Toggle checked={level.videoEnabled} onChange={(v) => updateLevel(index, 'videoEnabled', v)} />
                  ) : (
                    <span className={`font-medium text-sm ${level.videoEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.videoEnabled ? 'Oui' : 'Non'}
                    </span>
                  )}
                </div>

                <div className="flex justify-between items-center py-1.5 border-b border-gray-100">
                  <span className="text-gray-600 text-sm">Subliminal</span>
                  {editingLevel === index ? (
                    <Toggle checked={level.subliminalEnabled} onChange={(v) => updateLevel(index, 'subliminalEnabled', v)} />
                  ) : (
                    <span className={`font-medium text-sm ${level.subliminalEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.subliminalEnabled ? 'Oui' : 'Non'}
                    </span>
                  )}
                </div>

                {/* Badge + Enabled (edit only) */}
                {editingLevel === index && (
                  <>
                    <div className="py-2 border-b border-gray-100">
                      <span className="text-gray-600 text-sm block mb-1">Badge</span>
                      <input type="text" value={level.badgeText || ''} onChange={(e) => updateLevel(index, 'badgeText', e.target.value || null)} className="input text-sm" placeholder="ex: POPULAIRE" />
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-600 text-sm">Actif</span>
                      <Toggle checked={level.enabled} onChange={(v) => updateLevel(index, 'enabled', v)} />
                    </div>
                  </>
                )}

                {/* ===== SECTION: Tarifs ===== */}
                <div className="pt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Prix mensuel</span>
                    {editingLevel === index ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={level.priceMonthly} onChange={(e) => updateLevel(index, 'priceMonthly', parseFloat(e.target.value))} className="input w-20 text-right text-sm" min={0} step={0.01} />
                        <span className="text-sm">EUR</span>
                      </div>
                    ) : (
                      <span className="text-lg font-bold text-primary-600">{level.priceMonthly} EUR/mois</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Prix annuel</span>
                    {editingLevel === index ? (
                      <div className="flex items-center gap-1">
                        <input type="number" value={level.priceYearly} onChange={(e) => updateLevel(index, 'priceYearly', parseFloat(e.target.value))} className="input w-20 text-right text-sm" min={0} step={0.01} />
                        <span className="text-sm">EUR</span>
                      </div>
                    ) : (
                      <span className="text-base font-medium text-gray-700">{level.priceYearly} EUR/an</span>
                    )}
                  </div>
                  {editingLevel === index ? (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Prix one-shot</span>
                      <div className="flex items-center gap-1">
                        <input type="number" value={level.priceOneShot ?? ''} onChange={(e) => updateLevel(index, 'priceOneShot', e.target.value ? parseFloat(e.target.value) : null)} className="input w-20 text-right text-sm" min={0} step={0.01} placeholder="--" />
                        <span className="text-sm">EUR</span>
                      </div>
                    </div>
                  ) : level.priceOneShot != null ? (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">One-shot</span>
                      <span className="text-base font-medium text-gray-700">{level.priceOneShot} EUR</span>
                    </div>
                  ) : null}
                  {editingLevel === index && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Devise</span>
                      <select value={level.currency} onChange={(e) => updateLevel(index, 'currency', e.target.value)} className="input w-24 text-sm">
                        <option value="EUR">EUR</option>
                        <option value="USD">USD</option>
                        <option value="GBP">GBP</option>
                        <option value="CHF">CHF</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ===== CREATE MODAL ===== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900">Nouveau plan tarifaire</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {createError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {createError}
                </div>
              )}

              {/* Basic info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Nom *</label>
                  <input type="text" value={newLevel.name} onChange={(e) => updateNewLevel('name', e.target.value)} className="input" placeholder="ex: Premium" />
                </div>
                <div>
                  <label className="label">Niveau (unique)</label>
                  <input type="number" value={newLevel.level} onChange={(e) => updateNewLevel('level', parseInt(e.target.value))} className="input" min={0} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <input type="text" value={newLevel.description || ''} onChange={(e) => updateNewLevel('description', e.target.value || null)} className="input" placeholder="Description du plan..." />
              </div>

              {/* Requis (soumission) */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Requis pour la soumission</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Photos min</label>
                    <input type="number" value={newLevel.photosMin} onChange={(e) => updateNewLevel('photosMin', parseInt(e.target.value))} className="input" min={1} />
                  </div>
                  <div>
                    <label className="label">Photos max</label>
                    <input type="number" value={newLevel.photosMax} onChange={(e) => updateNewLevel('photosMax', parseInt(e.target.value))} className="input" min={1} />
                  </div>
                </div>
              </div>

              {/* Generation autorisee */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Generation autorisee</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Generations/mois</label>
                    <input type="number" value={newLevel.generationsPerMonth} onChange={(e) => updateNewLevel('generationsPerMonth', parseInt(e.target.value))} className="input" min={-1} />
                    <p className="text-xs text-gray-500 mt-1">-1 = Illimite</p>
                  </div>
                  <div>
                    <label className="label">Keyframes (photos generees)</label>
                    <input type="number" value={newLevel.keyframesCount} onChange={(e) => updateNewLevel('keyframesCount', parseInt(e.target.value))} className="input" min={1} />
                  </div>
                  <div>
                    <label className="label">Scenes video</label>
                    <input type="number" value={newLevel.scenesCount} onChange={(e) => updateNewLevel('scenesCount', parseInt(e.target.value))} className="input" min={1} />
                  </div>
                  <div className="flex flex-col justify-center gap-3 pt-4">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={newLevel.videoEnabled} onChange={(e) => updateNewLevel('videoEnabled', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">Video activee</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={newLevel.subliminalEnabled} onChange={(e) => updateNewLevel('subliminalEnabled', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">Subliminal active</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Tarification */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Tarification</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Prix mensuel *</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={newLevel.priceMonthly} onChange={(e) => updateNewLevel('priceMonthly', parseFloat(e.target.value) || 0)} className="input" min={0} step={0.01} />
                      <span className="text-gray-500">EUR</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Prix annuel *</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={newLevel.priceYearly} onChange={(e) => updateNewLevel('priceYearly', parseFloat(e.target.value) || 0)} className="input" min={0} step={0.01} />
                      <span className="text-gray-500">EUR</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Prix one-shot (optionnel)</label>
                    <div className="flex items-center gap-1">
                      <input type="number" value={newLevel.priceOneShot ?? ''} onChange={(e) => updateNewLevel('priceOneShot', e.target.value ? parseFloat(e.target.value) : null)} className="input" min={0} step={0.01} placeholder="--" />
                      <span className="text-gray-500">EUR</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Devise</label>
                    <select value={newLevel.currency} onChange={(e) => updateNewLevel('currency', e.target.value)} className="input">
                      <option value="EUR">EUR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Affichage */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Affichage</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Badge</label>
                    <input type="text" value={newLevel.badgeText || ''} onChange={(e) => updateNewLevel('badgeText', e.target.value || null)} className="input" placeholder="ex: POPULAIRE" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" checked={newLevel.enabled} onChange={(e) => updateNewLevel('enabled', e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                      <span className="text-sm text-gray-700">Activer immediatement</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowCreateModal(false)} className="btn-secondary" disabled={creating}>Annuler</button>
              <button onClick={createPlan} className="btn-primary flex items-center gap-2" disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Creer le plan
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
                <h2 className="text-lg font-bold text-gray-900">Supprimer ce plan ?</h2>
              </div>
              <p className="text-gray-600 text-sm mb-2">Cette action est irreversible. Si des abonnes utilisent ce plan, la suppression sera refusee.</p>
              {(() => {
                const t = levels.find((l) => l.id === deleteConfirmId);
                return t ? (
                  <div className="p-3 bg-gray-50 rounded-lg text-sm mb-4">
                    <span className="font-medium">{t.name}</span>
                    <span className="text-gray-500 ml-2">(Niveau {t.level})</span>
                  </div>
                ) : null;
              })()}
              {deleteError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /> <span>{deleteError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
              <button onClick={() => { setDeleteConfirmId(null); setDeleteError(null); }} className="btn-secondary" disabled={deleting}>Annuler</button>
              <button onClick={() => deletePlan(deleteConfirmId)} className="btn-danger flex items-center gap-2" disabled={deleting}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
