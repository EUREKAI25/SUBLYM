import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Search, Globe, ChevronDown, ChevronRight, Edit2, Trash2, Upload, Download, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface Text {
  id: number;
  lang: string;
  key: string;
  value: string;
}

interface Language {
  code: string;
  name: string;
  flag: string;
}

const defaultLanguages: Language[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
];

const getDefaultLang = () => {
  const systemLang = navigator.language.split('-')[0];
  const available = defaultLanguages.map(l => l.code);
  return available.includes(systemLang) ? systemLang : 'fr';
};

export function TextsPage() {
  const { fetchWithAuth } = useAuth();
  const [texts, setTexts] = useState<Text[]>([]);
  const [languages, setLanguages] = useState<Language[]>(defaultLanguages);
  const [selectedLang, setSelectedLang] = useState(getDefaultLang());
  const [search, setSearch] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showAddLang, setShowAddLang] = useState(false);
  const [newLang, setNewLang] = useState({ code: '', name: '', flag: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Flatten nested JSON to dot-notation keys
  function flattenJson(obj: Record<string, any>, prefix = ''): { key: string; value: string }[] {
    const result: { key: string; value: string }[] = [];
    for (const k of Object.keys(obj)) {
      const fullKey = prefix ? `${prefix}.${k}` : k;
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        result.push(...flattenJson(obj[k], fullKey));
      } else {
        result.push({ key: fullKey, value: String(obj[k]) });
      }
    }
    return result;
  }

  // Import JSON
  const importJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const entries = flattenJson(json);
        const updates = entries.map(({ key, value }) => ({ lang: selectedLang, key, value }));

        if (updates.length > 0) {
          const response = await fetchWithAuth(`${API_URL}/admin/texts`, {
            method: 'PUT',
            body: JSON.stringify({ texts: updates }),
          });

          if (response.ok) {
            fetchTexts();
            alert(`${updates.length} textes importés depuis JSON !`);
          } else {
            alert('Erreur lors de l\'import JSON');
          }
        }
      } catch {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  useEffect(() => {
    fetchTexts();
  }, [fetchWithAuth, selectedLang]);

  async function fetchTexts() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/texts?lang=${selectedLang}`);

      if (response.ok) {
        const data = await response.json();
        setTexts(data.texts || []);
      }
    } catch (err) {
      console.error('Error fetching texts:', err);
    } finally {
      setLoading(false);
    }
  }

  // Group texts by section (first part of key before .)
  const groupedTexts = texts.reduce((acc, text) => {
    const parts = text.key.split('.');
    const section = parts[0] || 'other';
    if (!acc[section]) acc[section] = [];
    acc[section].push(text);
    return acc;
  }, {} as Record<string, Text[]>);

  // Filter by search
  const filteredSections = Object.entries(groupedTexts).filter(([section, items]) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return section.toLowerCase().includes(searchLower) ||
      items.some(t => t.key.toLowerCase().includes(searchLower) || t.value.toLowerCase().includes(searchLower));
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const expandAll = () => setExpandedSections(Object.keys(groupedTexts));
  const collapseAll = () => setExpandedSections([]);

  const startEdit = (key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  };

  const saveEdit = async () => {
    if (!editingKey) return;

    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_URL}/admin/texts`, {
        method: 'PUT',
        body: JSON.stringify({
          texts: [{ lang: selectedLang, key: editingKey, value: editValue }],
        }),
      });

      if (response.ok) {
        // Update local state
        setTexts(prev => prev.map(t => 
          t.key === editingKey ? { ...t, value: editValue } : t
        ));
        setEditingKey(null);
        setEditValue('');
      }
    } catch (err) {
      console.error('Error saving text:', err);
    } finally {
      setSaving(false);
    }
  };

  // Export CSV
  const exportCSV = () => {
    let csv = 'key,value\n';
    texts.forEach(t => {
      csv += `"${t.key}","${t.value.replace(/"/g, '""')}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sublym_texts_${selectedLang}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Import CSV
  const importCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').slice(1); // Skip header
      const updates: { lang: string; key: string; value: string }[] = [];

      lines.forEach(line => {
        const match = line.match(/^"([^"]+)","(.*)"/);
        if (match) {
          updates.push({ lang: selectedLang, key: match[1], value: match[2].replace(/""/g, '"') });
        }
      });

      if (updates.length > 0) {
        try {
          const response = await fetchWithAuth(`${API_URL}/admin/texts`, {
            method: 'PUT',
            body: JSON.stringify({ texts: updates }),
          });

          if (response.ok) {
            fetchTexts();
            alert(`${updates.length} textes importés avec succès !`);
          }
        } catch (err) {
          console.error('Import error:', err);
          alert('Erreur lors de l\'import');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Add new language
  const addLanguage = () => {
    if (!newLang.code || !newLang.name) return;
    if (languages.find(l => l.code === newLang.code)) {
      alert('Cette langue existe déjà');
      return;
    }
    setLanguages([...languages, { ...newLang, flag: newLang.flag || '🏳️' }]);
    setNewLang({ code: '', name: '', flag: '' });
    setShowAddLang(false);
  };

  if (loading && texts.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Textes & Traductions</h1>
          <p className="text-gray-600 mt-1">Gérez tous les textes de l'application ({texts.length} clés)</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={importCSV} className="hidden" />

          <button onClick={() => jsonInputRef.current?.click()} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Import JSON
          </button>
          <input ref={jsonInputRef} type="file" accept=".json" onChange={importJSON} className="hidden" />

          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Language selector */}
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="input w-40"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowAddLang(true)}
              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
              title="Ajouter une langue"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une clé ou un texte..."
              className="input pl-10"
            />
          </div>

          {/* Expand/Collapse */}
          <div className="flex items-center gap-2">
            <button onClick={expandAll} className="text-sm text-primary-600 hover:underline">
              Tout ouvrir
            </button>
            <span className="text-gray-300">|</span>
            <button onClick={collapseAll} className="text-sm text-primary-600 hover:underline">
              Tout fermer
            </button>
          </div>
        </div>
      </div>

      {/* Add language modal */}
      {showAddLang && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Ajouter une langue</h3>
              <button onClick={() => setShowAddLang(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Code (ex: es, de, pt)</label>
                <input
                  type="text"
                  value={newLang.code}
                  onChange={(e) => setNewLang({ ...newLang, code: e.target.value.toLowerCase() })}
                  className="input"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="label">Nom</label>
                <input
                  type="text"
                  value={newLang.name}
                  onChange={(e) => setNewLang({ ...newLang, name: e.target.value })}
                  className="input"
                  placeholder="Español"
                />
              </div>
              <div>
                <label className="label">Emoji drapeau</label>
                <input
                  type="text"
                  value={newLang.flag}
                  onChange={(e) => setNewLang({ ...newLang, flag: e.target.value })}
                  className="input"
                  placeholder="🇪🇸"
                />
              </div>
              <button onClick={addLanguage} className="btn-primary w-full">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Texts by section */}
      <div className="space-y-4">
        {filteredSections.length === 0 ? (
          <div className="card text-center py-8 text-gray-500">
            Aucun texte trouvé
          </div>
        ) : (
          filteredSections.map(([section, items]) => (
            <div key={section} className="card p-0 overflow-hidden">
              {/* Section header */}
              <button
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedSections.includes(section) ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-semibold text-gray-900 capitalize">{section}</span>
                  <span className="text-sm text-gray-500">
                    ({items.length} clés)
                  </span>
                </div>
              </button>

              {/* Section content */}
              {expandedSections.includes(section) && (
                <div className="divide-y divide-gray-100">
                  {items.map((text) => {
                    const isEditing = editingKey === text.key;

                    return (
                      <div key={text.key} className="px-6 py-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <code className="text-sm text-primary-600 bg-primary-50 px-2 py-1 rounded">
                              {text.key}
                            </code>
                            
                            {isEditing ? (
                              <div className="mt-2 flex gap-2">
                                <textarea
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="input flex-1 min-h-[80px]"
                                  autoFocus
                                />
                                <div className="flex flex-col gap-2">
                                  <button onClick={saveEdit} className="btn-primary" disabled={saving}>
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    onClick={() => setEditingKey(null)} 
                                    className="btn-secondary"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-2 text-gray-700 whitespace-pre-wrap">
                                {text.value || <em className="text-gray-400">Non défini</em>}
                              </p>
                            )}
                          </div>

                          {!isEditing && (
                            <button
                              onClick={() => startEdit(text.key, text.value)}
                              className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
