import { useState, useEffect, useCallback } from 'react';
import { FileText, Save, History, Globe, Loader2, Plus, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

const LANGS = ['fr', 'en', 'de', 'es', 'it'];
const LANG_LABELS: Record<string, string> = { fr: 'Français', en: 'English', de: 'Deutsch', es: 'Español', it: 'Italiano' };

const SLUGS = [
  { slug: 'conditions', label: 'Conditions Générales (CGV)' },
  { slug: 'privacy', label: 'Politique de confidentialité' },
  { slug: 'legal', label: 'Mentions légales' },
];

interface PageData {
  id?: number;
  slug: string;
  lang: string;
  title: string;
  content: string;
  metaTitle?: string;
  metaDescription?: string;
  version?: number;
  enabled?: boolean;
  updatedAt?: string;
}

interface VersionInfo {
  id: number;
  version: number;
  title: string;
  enabled: boolean;
  publishedBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export function PagesPage() {
  const { fetchWithAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSlug, setActiveSlug] = useState('conditions');
  const [activeLang, setActiveLang] = useState('fr');
  const [pages, setPages] = useState<Record<string, PageData>>({});
  const [editData, setEditData] = useState<PageData | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPage = useCallback(async (slug: string) => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/admin/pages/${slug}`);
      if (response.ok) {
        const data = await response.json();
        const pageMap: Record<string, PageData> = {};
        for (const page of data.pages) {
          pageMap[page.lang] = page;
        }
        setPages(pageMap);

        if (pageMap[activeLang]) {
          setEditData({ ...pageMap[activeLang] });
        } else {
          setEditData({
            slug,
            lang: activeLang,
            title: SLUGS.find(s => s.slug === slug)?.label || slug,
            content: '',
          });
        }
      } else {
        setPages({});
        setEditData({
          slug,
          lang: activeLang,
          title: SLUGS.find(s => s.slug === slug)?.label || slug,
          content: '',
        });
      }
    } catch (err) {
      console.error('Error fetching page:', err);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, activeLang]);

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/admin/pages/${activeSlug}/versions?lang=${activeLang}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    }
  }, [fetchWithAuth, activeSlug, activeLang]);

  useEffect(() => {
    fetchPage(activeSlug);
  }, [activeSlug, fetchPage]);

  useEffect(() => {
    if (pages[activeLang]) {
      setEditData({ ...pages[activeLang] });
    } else {
      setEditData({
        slug: activeSlug,
        lang: activeLang,
        title: SLUGS.find(s => s.slug === activeSlug)?.label || activeSlug,
        content: '',
      });
    }
    setHasChanges(false);
  }, [activeLang, pages, activeSlug]);

  useEffect(() => {
    if (showVersions) fetchVersions();
  }, [showVersions, fetchVersions]);

  const handleSave = async () => {
    if (!editData) return;
    try {
      setSaving(true);
      const response = await fetchWithAuth(`${API_URL}/admin/pages/${activeSlug}`, {
        method: 'PUT',
        body: JSON.stringify({
          lang: activeLang,
          title: editData.title,
          content: editData.content,
          metaTitle: editData.metaTitle,
          metaDescription: editData.metaDescription,
        }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Page publiée avec succès (nouvelle version créée)' });
        setHasChanges(false);
        fetchPage(activeSlug);
        if (showVersions) fetchVersions();
      } else {
        const err = await response.json().catch(() => ({}));
        setMessage({ type: 'error', text: err.message || 'Erreur lors de la sauvegarde' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau' });
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const updateField = (field: string, value: string) => {
    if (!editData) return;
    setEditData({ ...editData, [field]: value });
    setHasChanges(true);
  };

  const renderMarkdownPreview = (md: string) => {
    return md
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\n\n/gim, '</p><p class="mb-3">')
      .replace(/\n/gim, '<br/>')
      .replace(/^(.+)$/gim, '<p class="mb-3">$1</p>')
      .replace(/<p class="mb-3"><h/gim, '<h')
      .replace(/<\/h([1-3])><\/p>/gim, '</h$1>')
      .replace(/<p class="mb-3"><\/p>/gim, '');
  };

  if (loading && !editData) {
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
          <h1 className="text-2xl font-bold text-gray-900">Pages statiques</h1>
          <p className="text-gray-600 mt-1">CGV, mentions légales, confidentialité</p>
        </div>
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Publier (nouvelle version)
          </button>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {message.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {SLUGS.map((s) => (
          <button
            key={s.slug}
            onClick={() => { setActiveSlug(s.slug); setShowVersions(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeSlug === s.slug
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {LANGS.map((lang) => (
          <button
            key={lang}
            onClick={() => setActiveLang(lang)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activeLang === lang
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {editData && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre</label>
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contenu (Markdown)
                </label>
                <textarea
                  value={editData.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={20}
                  className="input w-full font-mono text-sm"
                  placeholder="# Titre&#10;&#10;## Section 1&#10;&#10;Contenu de la page..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title (SEO)</label>
                  <input
                    type="text"
                    value={editData.metaTitle || ''}
                    onChange={(e) => updateField('metaTitle', e.target.value)}
                    className="input w-full"
                    placeholder="Titre SEO"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description (SEO)</label>
                  <input
                    type="text"
                    value={editData.metaDescription || ''}
                    onChange={(e) => updateField('metaDescription', e.target.value)}
                    className="input w-full"
                    placeholder="Description SEO"
                  />
                </div>
              </div>

              {editData.version && (
                <p className="text-sm text-gray-500">
                  Version actuelle : v{editData.version}
                  {editData.updatedAt && ` — ${new Date(editData.updatedAt).toLocaleString('fr-FR')}`}
                </p>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 w-full"
              >
                {showVersions ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <History className="w-4 h-4" />
                Historique des versions
              </button>
              {showVersions && (
                <div className="mt-3 space-y-2">
                  {versions.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune version</p>
                  ) : (
                    versions.map((v) => (
                      <div
                        key={v.id}
                        className={`flex items-center justify-between p-2 rounded text-sm ${
                          v.enabled ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                        }`}
                      >
                        <span>
                          v{v.version} — {v.title}
                          {v.enabled && <span className="ml-2 text-green-600 font-medium">(active)</span>}
                        </span>
                        <span className="text-gray-500">
                          {new Date(v.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-200">
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Aperçu</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">{editData.title}</h1>
            <div
              className="prose prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(editData.content || '') }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
