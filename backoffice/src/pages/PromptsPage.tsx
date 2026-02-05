import { useState, useEffect, useMemo } from 'react';
import { Code, Save, RotateCcw, Copy, Loader2, ArrowLeft, Search, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

interface PromptTemplate {
  id: number;
  code: string;
  name: string;
  description: string | null;
  template: string;
  templateEn: string | null;
  category: string;
  version: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const categoryLabels: Record<string, string> = {
  generation: 'Generation',
  validation: 'Validation',
  video: 'Video',
};

const categoryColors: Record<string, string> = {
  generation: 'bg-blue-100 text-blue-700',
  validation: 'bg-amber-100 text-amber-700',
  video: 'bg-purple-100 text-purple-700',
};

export function PromptsPage() {
  const { fetchWithAuth } = useAuth();

  // List view state
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit view state
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [editTemplateEn, setEditTemplateEn] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // ── Fetch all prompts ──────────────────────────────────────────────

  useEffect(() => {
    fetchPrompts();
  }, [fetchWithAuth]);

  async function fetchPrompts() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/prompts`);
      if (response.ok) {
        const data = await response.json();
        setPrompts(data.prompts || []);
      }
    } catch (err) {
      console.error('Error fetching prompts:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Derived data ───────────────────────────────────────────────────

  const filteredPrompts = useMemo(() => {
    if (!search) return prompts;
    const q = search.toLowerCase();
    return prompts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [prompts, search]);

  const groupedPrompts = useMemo(() => {
    const groups: Record<string, PromptTemplate[]> = {};
    for (const p of filteredPrompts) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    // Sort categories in a stable order
    const order = ['generation', 'validation', 'video'];
    const sorted: [string, PromptTemplate[]][] = [];
    for (const cat of order) {
      if (groups[cat]) sorted.push([cat, groups[cat]]);
    }
    // Append any categories not in the predefined order
    for (const [cat, items] of Object.entries(groups)) {
      if (!order.includes(cat)) sorted.push([cat, items]);
    }
    return sorted;
  }, [filteredPrompts]);

  const detectedPlaceholders = useMemo(() => {
    if (!editTemplate) return [];
    const matches = editTemplate.match(/\{[a-z_]+\}/g);
    if (!matches) return [];
    return [...new Set(matches)];
  }, [editTemplate]);

  // ── Open edit view ─────────────────────────────────────────────────

  async function openEdit(prompt: PromptTemplate) {
    // Fetch fresh copy
    try {
      const response = await fetchWithAuth(`${API_URL}/admin/prompts/${prompt.id}`);
      if (response.ok) {
        const data = await response.json();
        const fresh: PromptTemplate = data.prompt;
        setEditingPrompt(fresh);
        setEditDescription(fresh.description || '');
        setEditTemplate(fresh.template);
        setEditTemplateEn(fresh.templateEn || '');
        setEditEnabled(fresh.enabled);
      } else {
        // Fallback to the prompt we already have
        setEditingPrompt(prompt);
        setEditDescription(prompt.description || '');
        setEditTemplate(prompt.template);
        setEditTemplateEn(prompt.templateEn || '');
        setEditEnabled(prompt.enabled);
      }
    } catch {
      setEditingPrompt(prompt);
      setEditDescription(prompt.description || '');
      setEditTemplate(prompt.template);
      setEditTemplateEn(prompt.templateEn || '');
      setEditEnabled(prompt.enabled);
    }
  }

  function closeEdit() {
    setEditingPrompt(null);
    setEditDescription('');
    setEditTemplate('');
    setEditTemplateEn('');
    setEditEnabled(true);
  }

  // ── Save ───────────────────────────────────────────────────────────

  async function handleSave() {
    if (!editingPrompt) return;
    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_URL}/admin/prompts/${editingPrompt.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: editDescription || null,
          template: editTemplate,
          templateEn: editTemplateEn || null,
          enabled: editEnabled,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated: PromptTemplate = data.prompt;
        setEditingPrompt(updated);
        setEditDescription(updated.description || '');
        setEditTemplate(updated.template);
        setEditTemplateEn(updated.templateEn || '');
        setEditEnabled(updated.enabled);
        // Update in list
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        alert('Prompt sauvegarde !');
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Error saving prompt:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────

  async function handleReset() {
    if (!editingPrompt) return;
    if (!confirm('Remettre ce prompt au contenu original ? Les modifications seront perdues.')) return;

    try {
      setResetting(true);
      const response = await fetchWithAuth(`${API_URL}/admin/prompts/reset/${editingPrompt.code}`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const reset: PromptTemplate = data.prompt;
        setEditingPrompt(reset);
        setEditDescription(reset.description || '');
        setEditTemplate(reset.template);
        setEditTemplateEn(reset.templateEn || '');
        setEditEnabled(reset.enabled);
        setPrompts((prev) => prev.map((p) => (p.id === reset.id ? reset : p)));
        alert('Prompt remis au contenu original !');
      } else {
        alert('Erreur lors du reset');
      }
    } catch (err) {
      console.error('Error resetting prompt:', err);
      alert('Erreur lors du reset');
    } finally {
      setResetting(false);
    }
  }

  // ── Duplicate ──────────────────────────────────────────────────────

  async function handleDuplicate() {
    if (!editingPrompt) return;
    try {
      setDuplicating(true);
      const response = await fetchWithAuth(`${API_URL}/admin/prompts/${editingPrompt.id}/duplicate`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        const newPrompt: PromptTemplate = data.prompt;
        setPrompts((prev) => [...prev, newPrompt]);
        // Switch to editing the duplicate
        setEditingPrompt(newPrompt);
        setEditDescription(newPrompt.description || '');
        setEditTemplate(newPrompt.template);
        setEditTemplateEn(newPrompt.templateEn || '');
        setEditEnabled(newPrompt.enabled);
        alert('Prompt duplique !');
      } else {
        alert('Erreur lors de la duplication');
      }
    } catch (err) {
      console.error('Error duplicating prompt:', err);
      alert('Erreur lors de la duplication');
    } finally {
      setDuplicating(false);
    }
  }

  // ── Toggle enabled from list view ─────────────────────────────────

  async function toggleEnabled(prompt: PromptTemplate) {
    try {
      setTogglingId(prompt.id);
      const response = await fetchWithAuth(`${API_URL}/admin/prompts/${prompt.id}`, {
        method: 'PUT',
        body: JSON.stringify({ enabled: !prompt.enabled }),
      });

      if (response.ok) {
        const data = await response.json();
        const updated: PromptTemplate = data.prompt;
        setPrompts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch (err) {
      console.error('Error toggling prompt:', err);
    } finally {
      setTogglingId(null);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  // ── EDIT VIEW ──────────────────────────────────────────────────────

  if (editingPrompt) {
    return (
      <div className="space-y-6">
        {/* Back button + header */}
        <div className="flex flex-col gap-4">
          <button
            onClick={closeEdit}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Retour a la liste</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Code className="w-6 h-6 text-gray-400" />
              <h1 className="text-2xl font-bold text-gray-900">{editingPrompt.name}</h1>
              <code className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                {editingPrompt.code}
              </code>
              <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                v{editingPrompt.version}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[editingPrompt.category] || 'bg-gray-100 text-gray-700'}`}>
                {categoryLabels[editingPrompt.category] || editingPrompt.category}
              </span>
            </div>

            {/* Enabled toggle */}
            <button
              onClick={() => setEditEnabled(!editEnabled)}
              className="flex items-center gap-2 text-sm"
            >
              {editEnabled ? (
                <>
                  <ToggleRight className="w-6 h-6 text-green-500" />
                  <span className="text-green-700 font-medium">Actif</span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-6 h-6 text-gray-400" />
                  <span className="text-gray-500 font-medium">Inactif</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Description */}
        <div className="card">
          <label className="label">Description</label>
          <input
            type="text"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Description du prompt..."
            className="input"
          />
        </div>

        {/* Template FR */}
        <div className="card">
          <label className="label">Template (Francais - edition)</label>
          <textarea
            value={editTemplate}
            onChange={(e) => setEditTemplate(e.target.value)}
            rows={20}
            className="input font-mono text-sm leading-relaxed resize-y"
            style={{ minHeight: '480px' }}
            spellCheck={false}
          />

          {/* Detected placeholders */}
          {detectedPlaceholders.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-500 mb-2">
                Placeholders detectes ({detectedPlaceholders.length}) :
              </p>
              <div className="flex flex-wrap gap-2">
                {detectedPlaceholders.map((ph) => (
                  <span
                    key={ph}
                    className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono bg-primary-50 text-primary-700 border border-primary-200"
                  >
                    {ph}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            Reset au contenu original
          </button>

          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            {duplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
            Dupliquer
          </button>
        </div>

        {/* Metadata */}
        <div className="text-xs text-gray-400 flex flex-wrap gap-4">
          <span>Cree le {new Date(editingPrompt.createdAt).toLocaleDateString('fr-FR')}</span>
          <span>Modifie le {new Date(editingPrompt.updatedAt).toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Prompts IA</h1>
          <p className="text-gray-600 mt-1">
            Gestion des templates de prompts du pipeline SUBLYM ({prompts.length} prompts)
          </p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, code ou categorie..."
            className="input pl-10"
          />
        </div>
      </div>

      {/* Grouped prompts */}
      {groupedPrompts.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun prompt trouve
        </div>
      ) : (
        <div className="space-y-6">
          {groupedPrompts.map(([category, items]) => (
            <div key={category}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-3">
                <span className={`text-xs font-semibold uppercase px-2.5 py-1 rounded-full ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
                  {categoryLabels[category] || category}
                </span>
                <span className="text-sm text-gray-400">
                  {items.length} prompt{items.length > 1 ? 's' : ''}
                </span>
                <div className="flex-1 border-t border-gray-200" />
              </div>

              {/* Prompt cards */}
              <div className="space-y-2">
                {items.map((prompt) => (
                  <div
                    key={prompt.id}
                    className="card p-4 hover:shadow-md transition-shadow cursor-pointer group"
                    onClick={() => openEdit(prompt)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{prompt.name}</span>
                          <code className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                            {prompt.code}
                          </code>
                          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                            v{prompt.version}
                          </span>
                        </div>
                        {prompt.description && (
                          <p className="text-sm text-gray-500 mt-1 truncate">{prompt.description}</p>
                        )}
                      </div>

                      {/* Enabled toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleEnabled(prompt);
                        }}
                        disabled={togglingId === prompt.id}
                        className="flex-shrink-0"
                        title={prompt.enabled ? 'Actif - Cliquer pour desactiver' : 'Inactif - Cliquer pour activer'}
                      >
                        {togglingId === prompt.id ? (
                          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                        ) : prompt.enabled ? (
                          <ToggleRight className="w-6 h-6 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-gray-300" />
                        )}
                      </button>

                      {/* Chevron */}
                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
