import { useState, useEffect, useMemo } from 'react';
import { Shield, Save, Loader2, ChevronDown, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ── Types ──────────────────────────────────────────────────────────

type RefType = 'user_photo' | 'character_analysis' | 'previous' | 'pitch' | 'start_current' | 'scene_palette' | 'dream_context' | 'none';

interface Criterion {
  min: number;
  ref: RefType;
  label: string;
  examples_fail?: string[];
}

interface FaceValidation {
  geminiMin: number;
  tolerance: number;
  threshold: number;
}

interface ValidationConfig {
  globalMinScore: number;
  faceValidation: FaceValidation;
  criteria: Record<string, Criterion>;
  criteriaPub: Record<string, Criterion>;
}

// ── Constants ──────────────────────────────────────────────────────

const REF_LABELS: Record<RefType, string> = {
  user_photo: 'Photo ref',
  previous: 'Scene precedente',
  pitch: 'Description scene',
  start_current: 'Start courant',
  scene_palette: 'Palette',
  character_analysis: 'Analyse perso',
  dream_context: 'Contexte du reve',
  none: 'Absolu',
};

const REF_COLORS: Record<RefType, string> = {
  user_photo: 'bg-blue-100 text-blue-700',
  previous: 'bg-purple-100 text-purple-700',
  pitch: 'bg-amber-100 text-amber-700',
  start_current: 'bg-emerald-100 text-emerald-700',
  scene_palette: 'bg-pink-100 text-pink-700',
  character_analysis: 'bg-indigo-100 text-indigo-700',
  dream_context: 'bg-teal-100 text-teal-700',
  none: 'bg-gray-100 text-gray-600',
};

const REF_ORDER: RefType[] = [
  'user_photo',
  'previous',
  'pitch',
  'dream_context',
  'start_current',
  'scene_palette',
  'character_analysis',
  'none',
];

const ALL_REFS: RefType[] = [
  'user_photo',
  'character_analysis',
  'previous',
  'pitch',
  'dream_context',
  'start_current',
  'scene_palette',
  'none',
];

// ── Component ──────────────────────────────────────────────────────

interface NewCriterionForm {
  code: string;
  label: string;
  min: number;
  ref: RefType;
}

export function ValidationPage() {
  const { fetchWithAuth } = useAuth();
  const [config, setConfig] = useState<ValidationConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState<'criteria' | 'criteriaPub' | null>(null);
  const [newCriterion, setNewCriterion] = useState<NewCriterionForm>({
    code: '',
    label: '',
    min: 0.7,
    ref: 'pitch',
  });

  // ── Fetch ──────────────────────────────────────────────────────

  useEffect(() => {
    fetchConfig();
  }, [fetchWithAuth]);

  async function fetchConfig() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/validation-config`);
      if (response.ok) {
        const data: ValidationConfig = await response.json();
        setConfig(data);
      }
    } catch (err) {
      console.error('Error fetching validation config:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Save ───────────────────────────────────────────────────────

  async function handleSave() {
    if (!config) return;
    try {
      setSaving(true);
      setSaveSuccess(false);
      const response = await fetchWithAuth(`${API_URL}/admin/validation-config`, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      if (response.ok) {
        setHasChanges(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Error saving validation config:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // ── Update helpers ─────────────────────────────────────────────

  function updateGlobalMinScore(value: number) {
    if (!config) return;
    setConfig({ ...config, globalMinScore: value });
    setHasChanges(true);
  }

  function updateFaceValidation(field: keyof FaceValidation, value: number) {
    if (!config) return;
    setConfig({
      ...config,
      faceValidation: { ...config.faceValidation, [field]: value },
    });
    setHasChanges(true);
  }

  function updateCriterion(section: 'criteria' | 'criteriaPub', code: string, field: keyof Criterion, value: string | number) {
    if (!config) return;
    const sectionData = { ...config[section] };
    sectionData[code] = { ...sectionData[code], [field]: value };
    setConfig({ ...config, [section]: sectionData });
    setHasChanges(true);
  }

  function addCriterion(section: 'criteria' | 'criteriaPub') {
    if (!config) return;
    const code = newCriterion.code.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!code || config[section][code]) {
      alert('Code invalide ou deja existant');
      return;
    }
    const sectionData = { ...config[section] };
    sectionData[code] = {
      label: newCriterion.label || code,
      min: newCriterion.min,
      ref: newCriterion.ref,
    };
    setConfig({ ...config, [section]: sectionData });
    setHasChanges(true);
    setShowAddModal(null);
    setNewCriterion({ code: '', label: '', min: 0.7, ref: 'pitch' });
  }

  function deleteCriterion(section: 'criteria' | 'criteriaPub', code: string) {
    if (!config) return;
    if (!confirm(`Supprimer le critere "${code}" ?`)) return;
    const sectionData = { ...config[section] };
    delete sectionData[code];
    setConfig({ ...config, [section]: sectionData });
    setHasChanges(true);
  }

  // ── Group criteria by ref ──────────────────────────────────────

  const groupedCriteria = useMemo(() => {
    if (!config) return {};
    return groupByRef(config.criteria);
  }, [config]);

  const groupedCriteriaPub = useMemo(() => {
    if (!config) return {};
    return groupByRef(config.criteriaPub);
  }, [config]);

  function groupByRef(criteria: Record<string, Criterion>): Record<RefType, { code: string; criterion: Criterion }[]> {
    const groups: Record<RefType, { code: string; criterion: Criterion }[]> = {
      user_photo: [],
      previous: [],
      pitch: [],
      dream_context: [],
      start_current: [],
      scene_palette: [],
      character_analysis: [],
      none: [],
    };

    Object.entries(criteria).forEach(([code, criterion]) => {
      const ref = criterion.ref as RefType;
      if (groups[ref]) {
        groups[ref].push({ code, criterion });
      } else {
        groups.none.push({ code, criterion });
      }
    });

    return groups;
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Loading state ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="card text-center py-12 text-gray-500">
        Impossible de charger la configuration de validation.
      </div>
    );
  }

  // ── Criteria row renderer ──────────────────────────────────────

  function renderCriterionRow(
    section: 'criteria' | 'criteriaPub',
    code: string,
    criterion: Criterion,
  ) {
    return (
      <div
        key={code}
        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        {/* Code */}
        <div className="sm:w-44 flex-shrink-0">
          <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {code}
          </span>
        </div>

        {/* Label (editable) */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={criterion.label}
            onChange={(e) => updateCriterion(section, code, 'label', e.target.value)}
            className="input text-sm w-full"
            title={criterion.label}
          />
        </div>

        {/* Min score */}
        <div className="sm:w-20 flex-shrink-0">
          <input
            type="number"
            value={criterion.min}
            onChange={(e) => updateCriterion(section, code, 'min', parseFloat(e.target.value) || 0)}
            className="input text-sm text-center w-full"
            min={0}
            max={1}
            step={0.05}
          />
        </div>

        {/* Ref selector */}
        <div className="sm:w-40 flex-shrink-0">
          <select
            value={criterion.ref}
            onChange={(e) => updateCriterion(section, code, 'ref', e.target.value)}
            className="input text-sm w-full"
          >
            {ALL_REFS.map((ref) => (
              <option key={ref} value={ref}>
                {REF_LABELS[ref]}
              </option>
            ))}
          </select>
        </div>

        {/* Delete button */}
        <div className="sm:w-8 flex-shrink-0">
          <button
            onClick={() => deleteCriterion(section, code)}
            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── Group renderer ─────────────────────────────────────────────

  function renderCriteriaGroups(
    section: 'criteria' | 'criteriaPub',
    grouped: Record<RefType, { code: string; criterion: Criterion }[]>,
    prefix: string,
  ) {
    return REF_ORDER.map((ref) => {
      const items = grouped[ref];
      if (!items || items.length === 0) return null;
      const groupKey = `${prefix}-${ref}`;
      const isCollapsed = collapsedGroups[groupKey];

      return (
        <div key={groupKey} className="mb-2">
          {/* Group header */}
          <button
            onClick={() => toggleGroup(groupKey)}
            className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-100 transition-colors text-left"
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <span
              className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${REF_COLORS[ref]}`}
            >
              {REF_LABELS[ref]}
            </span>
            <span className="text-sm text-gray-500">
              {items.length} critere{items.length > 1 ? 's' : ''}
            </span>
          </button>

          {/* Group items */}
          {!isCollapsed && (
            <div className="ml-7 border-l-2 border-gray-100 pl-3 space-y-0.5">
              {/* Column headers */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-1.5 px-3 text-xs text-gray-400 font-medium uppercase tracking-wider">
                <div className="sm:w-44 flex-shrink-0">Code</div>
                <div className="flex-1">Label</div>
                <div className="sm:w-20 flex-shrink-0 text-center">Min</div>
                <div className="sm:w-40 flex-shrink-0">Reference</div>
                <div className="sm:w-8 flex-shrink-0"></div>
              </div>
              {items.map(({ code, criterion }) =>
                renderCriterionRow(section, code, criterion),
              )}
            </div>
          )}
        </div>
      );
    });
  }

  // ── Counts ─────────────────────────────────────────────────────

  const criteriaCount = Object.keys(config.criteria).length;
  const criteriaPubCount = Object.keys(config.criteriaPub).length;

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary-600" />
            Validation IA
          </h1>
          <p className="text-gray-600 mt-1">
            Criteres de validation et scores minimum par outil
          </p>
        </div>
        {saveSuccess && (
          <div className="text-sm text-green-600 font-medium bg-green-50 px-4 py-2 rounded-lg">
            Configuration sauvegardee
          </div>
        )}
      </div>

      {/* ── Parametres globaux ──────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Parametres globaux</h2>
        </div>

        {/* Global min score */}
        <div className="mb-6">
          <label className="label">Score global minimum</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={config.globalMinScore}
              onChange={(e) => updateGlobalMinScore(parseFloat(e.target.value) || 0)}
              className="input w-32"
              min={0}
              max={1}
              step={0.05}
            />
            <span className="text-sm text-gray-500">
              = {Math.round(config.globalMinScore * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Score minimum requis pour valider une image generee
          </p>
        </div>

        {/* Face validation */}
        <div className="border-t border-gray-200 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Validation faciale</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Gemini Min</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.faceValidation.geminiMin}
                  onChange={(e) => updateFaceValidation('geminiMin', parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min={0}
                  max={1}
                  step={0.05}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {Math.round(config.faceValidation.geminiMin * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Score Gemini minimum pour la verification faciale</p>
            </div>
            <div>
              <label className="label">Tolerance</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.faceValidation.tolerance}
                  onChange={(e) => updateFaceValidation('tolerance', parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min={0}
                  max={1}
                  step={0.05}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {Math.round(config.faceValidation.tolerance * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Marge de tolerance pour la comparaison</p>
            </div>
            <div>
              <label className="label">Seuil (threshold)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={config.faceValidation.threshold}
                  onChange={(e) => updateFaceValidation('threshold', parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min={0}
                  max={1}
                  step={0.05}
                />
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {Math.round(config.faceValidation.threshold * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Seuil de decision pour validation/rejet</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Criteres principaux ─────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <span className="text-sm font-bold text-amber-700">{criteriaCount}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Criteres principaux</h2>
              <p className="text-sm text-gray-500">{criteriaCount} critere{criteriaCount > 1 ? 's' : ''} de validation d'images</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal('criteria')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        <div className="space-y-1">
          {renderCriteriaGroups('criteria', groupedCriteria, 'main')}
        </div>
      </div>

      {/* ── Criteres pub (transitions) ──────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <span className="text-sm font-bold text-purple-700">{criteriaPubCount}</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Criteres additionnels mode pub</h2>
              <p className="text-sm text-gray-500">{criteriaPubCount} critere{criteriaPubCount > 1 ? 's' : ''} pour les transitions publicitaires</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddModal('criteriaPub')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        <div className="space-y-1">
          {renderCriteriaGroups('criteriaPub', groupedCriteriaPub, 'pub')}
        </div>
      </div>

      {/* ── Modal ajout critere ────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Ajouter un critere {showAddModal === 'criteriaPub' ? '(mode pub)' : ''}
              </h3>
              <button
                onClick={() => setShowAddModal(null)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Code (identifiant unique)</label>
                <input
                  type="text"
                  value={newCriterion.code}
                  onChange={(e) => setNewCriterion({ ...newCriterion, code: e.target.value })}
                  className="input w-full font-mono"
                  placeholder="ex: location_coherence"
                />
                <p className="text-xs text-gray-500 mt-1">Lettres minuscules, chiffres et underscores uniquement</p>
              </div>

              <div>
                <label className="label">Label (description)</label>
                <input
                  type="text"
                  value={newCriterion.label}
                  onChange={(e) => setNewCriterion({ ...newCriterion, label: e.target.value })}
                  className="input w-full"
                  placeholder="ex: Le decor correspond-il au lieu du reve ?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Score minimum</label>
                  <input
                    type="number"
                    value={newCriterion.min}
                    onChange={(e) => setNewCriterion({ ...newCriterion, min: parseFloat(e.target.value) || 0.7 })}
                    className="input w-full"
                    min={0}
                    max={1}
                    step={0.05}
                  />
                </div>
                <div>
                  <label className="label">Reference</label>
                  <select
                    value={newCriterion.ref}
                    onChange={(e) => setNewCriterion({ ...newCriterion, ref: e.target.value as RefType })}
                    className="input w-full"
                  >
                    {ALL_REFS.map((ref) => (
                      <option key={ref} value={ref}>
                        {REF_LABELS[ref]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                onClick={() => addCriterion(showAddModal)}
                className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                disabled={!newCriterion.code.trim()}
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky save button ──────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur border-t border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">Modifications non sauvegardees</span>
            ) : (
              <span>Aucune modification</span>
            )}
          </div>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              hasChanges
                ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg shadow-primary-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}
