import { useState, useEffect } from 'react';
import {
  Save, Loader2, Mail, MapPin, FileText, Upload, CheckCircle, Trash2, Eye, Building2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface Config {
  key: string;
  value: string;
  type: string;
}

interface LegalDocument {
  id: number;
  type: string;
  version: string;
  filename: string;
  filepath: string;
  filesize: number | null;
  mimeType: string | null;
  isActive: boolean;
  uploadedBy: number | null;
  notes: string | null;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  terms: 'Conditions Generales',
  privacy: 'Politique de Confidentialite',
  legal_notices: 'Mentions Legales',
  cookies: 'Politique Cookies',
};

export function SublymPage() {
  const { token } = useAuth();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [legalDocuments, setLegalDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Upload form state
  const [uploadType, setUploadType] = useState('terms');
  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    if (!token) return;

    try {
      setLoading(true);

      // Fetch configs
      const configRes = await fetch(`${API_URL}/admin/config`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      if (configRes.ok) {
        const data = await configRes.json();
        const configMap: Record<string, string> = {};
        (data.configs || []).forEach((c: Config) => {
          configMap[c.key] = c.value;
        });
        setConfigs(configMap);
      }

      // Fetch legal documents
      await fetchLegalDocuments();

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLegalDocuments() {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/admin/legal-documents`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setLegalDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching legal documents:', err);
    }
  }

  const updateConfig = (key: string, value: string) => {
    setConfigs({ ...configs, [key]: value });
    setHasChanges(true);
  };

  const saveSettings = async () => {
    if (!token) return;

    try {
      setSaving(true);

      const configsToSave = Object.entries(configs).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      const response = await fetch(`${API_URL}/admin/config`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ configs: configsToSave }),
      });

      if (response.ok) {
        setHasChanges(false);
        alert('Configuration sauvegardee !');
      } else {
        alert('Erreur lors de la sauvegarde');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadType || !uploadVersion || !token) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('type', uploadType);
      formData.append('version', uploadVersion);
      if (uploadNotes) formData.append('notes', uploadNotes);

      const res = await fetch(`${API_URL}/admin/legal-documents`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        await fetchLegalDocuments();
        // Reset form
        setUploadVersion('');
        setUploadNotes('');
        setUploadFile(null);
        alert('Document uploade !');
      } else {
        const data = await res.json();
        alert(data.message || 'Erreur lors de l\'upload');
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      alert('Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const activateDocument = async (id: number) => {
    if (!token) return;

    try {
      const res = await fetch(`${API_URL}/admin/legal-documents/${id}/activate`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        await fetchLegalDocuments();
      }
    } catch (err) {
      console.error('Error activating document:', err);
    }
  };

  const deleteDocument = async (id: number) => {
    if (!token || !confirm('Supprimer ce document ?')) return;

    try {
      const res = await fetch(`${API_URL}/admin/legal-documents/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        await fetchLegalDocuments();
      } else {
        const data = await res.json();
        alert(data.message || 'Erreur');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Sublym</h1>
          <p className="text-gray-600 mt-1">Donnees de l'entreprise et documents legaux</p>
        </div>
        {hasChanges && (
          <button onClick={saveSettings} className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        )}
      </div>

      {/* Section 1: Emails */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Mail className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Adresses email</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email webmaster</label>
            <input
              type="email"
              value={configs['sublym_email_webmaster'] || ''}
              onChange={(e) => updateConfig('sublym_email_webmaster', e.target.value)}
              className="input w-full"
              placeholder="webmaster@sublym.org"
            />
            <p className="text-xs text-gray-500 mt-1">Recoit les messages du formulaire de contact</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email contact</label>
            <input
              type="email"
              value={configs['sublym_email_contact'] || ''}
              onChange={(e) => updateConfig('sublym_email_contact', e.target.value)}
              className="input w-full"
              placeholder="contact@sublym.org"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email support</label>
            <input
              type="email"
              value={configs['sublym_email_support'] || ''}
              onChange={(e) => updateConfig('sublym_email_support', e.target.value)}
              className="input w-full"
              placeholder="support@sublym.org"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email no-reply</label>
            <input
              type="email"
              value={configs['sublym_email_noreply'] || ''}
              onChange={(e) => updateConfig('sublym_email_noreply', e.target.value)}
              className="input w-full"
              placeholder="noreply@sublym.org"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Adresse civile */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Adresse civile</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Raison sociale</label>
            <input
              type="text"
              value={configs['sublym_company_name'] || ''}
              onChange={(e) => updateConfig('sublym_company_name', e.target.value)}
              className="input w-full"
              placeholder="SUBLYM SAS"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
            <input
              type="text"
              value={configs['sublym_address_street'] || ''}
              onChange={(e) => updateConfig('sublym_address_street', e.target.value)}
              className="input w-full"
              placeholder="12 rue de la Paix"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Code postal</label>
            <input
              type="text"
              value={configs['sublym_address_zip'] || ''}
              onChange={(e) => updateConfig('sublym_address_zip', e.target.value)}
              className="input w-full"
              placeholder="75001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
            <input
              type="text"
              value={configs['sublym_address_city'] || ''}
              onChange={(e) => updateConfig('sublym_address_city', e.target.value)}
              className="input w-full"
              placeholder="Paris"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pays</label>
            <input
              type="text"
              value={configs['sublym_address_country'] || ''}
              onChange={(e) => updateConfig('sublym_address_country', e.target.value)}
              className="input w-full"
              placeholder="France"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SIRET</label>
            <input
              type="text"
              value={configs['sublym_siret'] || ''}
              onChange={(e) => updateConfig('sublym_siret', e.target.value)}
              className="input w-full"
              placeholder="123 456 789 00012"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telephone</label>
            <input
              type="tel"
              value={configs['sublym_phone'] || ''}
              onChange={(e) => updateConfig('sublym_phone', e.target.value)}
              className="input w-full"
              placeholder="+33 1 23 45 67 89"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Documents legaux */}
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Documents legaux</h2>
        </div>

        {/* Upload form */}
        <div className="mb-8 p-4 bg-gray-50 rounded-xl">
          <h3 className="font-medium text-gray-800 mb-4">Uploader un nouveau document</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="input w-full"
              >
                {Object.entries(typeLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                type="text"
                value={uploadVersion}
                onChange={(e) => setUploadVersion(e.target.value)}
                className="input w-full"
                placeholder="1.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fichier (PDF)</label>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="input w-full text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <input
              type="text"
              value={uploadNotes}
              onChange={(e) => setUploadNotes(e.target.value)}
              className="input w-full"
              placeholder="Mise a jour article 5..."
            />
          </div>
          <button
            onClick={handleUpload}
            className="btn-primary mt-4 flex items-center gap-2"
            disabled={uploading || !uploadFile || !uploadVersion}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            Uploader
          </button>
        </div>

        {/* Documents list by type */}
        {Object.entries(typeLabels).map(([type, label]) => {
          const docs = legalDocuments.filter(d => d.type === type);
          if (docs.length === 0) return null;

          return (
            <div key={type} className="mb-6">
              <h3 className="font-medium text-gray-800 mb-3">{label}</h3>
              <div className="space-y-2">
                {docs.map(doc => (
                  <div
                    key={doc.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      doc.isActive ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">v{doc.version}</span>
                          {doc.isActive && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {doc.filename} — {formatDate(doc.createdAt)}
                          {doc.filesize ? ` — ${formatSize(doc.filesize)}` : ''}
                        </p>
                        {doc.notes && (
                          <p className="text-xs text-gray-400 italic truncate">{doc.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      {!doc.isActive && (
                        <>
                          <button
                            onClick={() => activateDocument(doc.id)}
                            className="text-sm text-primary-600 hover:text-primary-800 hover:underline"
                            title="Activer cette version"
                          >
                            Activer
                          </button>
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="text-sm text-red-500 hover:text-red-700"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <a
                        href={`${API_URL}/legal/${doc.type}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-gray-500 hover:text-gray-700"
                        title="Voir le document"
                      >
                        <Eye className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {legalDocuments.length === 0 && (
          <p className="text-gray-500 text-center py-6">Aucun document uploade</p>
        )}
      </div>
    </div>
  );
}
