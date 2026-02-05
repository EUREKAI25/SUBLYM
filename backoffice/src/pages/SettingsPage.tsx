import { useState, useEffect } from 'react';
import { Save, AlertTriangle, CheckCircle, Globe, CreditCard, DollarSign, RefreshCw, Loader2, Clapperboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface Config {
  key: string;
  value: string;
  type: string;
}

interface SmileConfig {
  id: number;
  country: string;
  threshold: number;
  currentCount: number;
  premiumLevel: number;
  premiumMonths: number;
  isActive: boolean;
}

const currencies = [
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
];

export function SettingsPage() {
  const { fetchWithAuth } = useAuth();
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [smileConfigs, setSmileConfigs] = useState<SmileConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchWithAuth]);

  async function fetchSettings() {
    try {
      setLoading(true);

      // Fetch configs
      const configRes = await fetchWithAuth(`${API_URL}/admin/config`);

      if (configRes.ok) {
        const data = await configRes.json();
        const configMap: Record<string, string> = {};
        (data.configs || []).forEach((c: Config) => {
          configMap[c.key] = c.value;
        });
        setConfigs(configMap);
      }

      // Fetch smile configs
      const smileRes = await fetchWithAuth(`${API_URL}/admin/smile-configs`);
      if (smileRes.ok) {
        const smileData = await smileRes.json();
        setSmileConfigs(smileData.configs || []);
      }

    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }

  const updateConfig = (key: string, value: string) => {
    setConfigs({ ...configs, [key]: value });
    setHasChanges(true);
  };

  const updateStripeMode = (mode: 'test' | 'live') => {
    if (mode === 'live' && !confirm('⚠️ Passer en mode LIVE Stripe ? Les paiements seront réels !')) {
      return;
    }
    updateConfig('stripe_mode', mode);
  };

  const saveSettings = async () => {
    try {
      setSaving(true);

      // Convert configs to array format for API
      const configsToSave = Object.entries(configs).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      const response = await fetchWithAuth(`${API_URL}/admin/config`, {
        method: 'PUT',
        body: JSON.stringify({ configs: configsToSave }),
      });

      if (response.ok) {
        setHasChanges(false);
        alert('Configuration sauvegardée !');
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const stripeMode = configs['stripe_mode'] || 'test';
  const baseCurrency = configs['base_currency'] || 'EUR';
  const videosPerWeek = parseInt(configs['videos_per_week'] || '1');
  const minPhotos = parseInt(configs['min_photos'] || '3');
  const maxPhotos = parseInt(configs['max_photos'] || '5');
  const minDreamLength = parseInt(configs['min_dream_length'] || '20');
  const faceVerification = configs['face_verification_enabled'] === 'true';
  const subliminalAudio = configs['subliminal_audio_enabled'] !== 'false';
  const subliminalVisual = configs['subliminal_visual_enabled'] !== 'false';
  const smileLevel = parseInt(configs['smile_level'] || '3');
  const smileMonths = parseInt(configs['smile_months'] || '3');

  // Generation config
  const genTimeoutMinutes = parseInt(configs['generation_timeout_minutes'] || '25');
  const genMaxAttempts = parseInt(configs['generation_max_attempts'] || '5');
  const genMaxVideoAttempts = parseInt(configs['generation_max_video_attempts'] || '4');
  const genModelScenario = configs['generation_model_scenario'] || 'gpt-4o';
  const genModelImage = configs['generation_model_image'] || 'gemini-3-pro-image-preview';
  const genModelVideo = configs['generation_model_video'] || 'fal-ai/minimax/hailuo-02/standard/image-to-video';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-600 mt-1">Configuration globale de l'application</p>
        </div>
        {hasChanges && (
          <button onClick={saveSettings} className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        )}
      </div>

      {/* Stripe Mode */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <CreditCard className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Mode Stripe</h2>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => updateStripeMode('test')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              stripeMode === 'test'
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                stripeMode === 'test' ? 'bg-orange-100' : 'bg-gray-100'
              }`}>
                <AlertTriangle className={`w-5 h-5 ${
                  stripeMode === 'test' ? 'text-orange-600' : 'text-gray-400'
                }`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Mode Test</p>
                <p className="text-sm text-gray-500">Paiements simulés</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => updateStripeMode('live')}
            className={`flex-1 p-4 rounded-xl border-2 transition-all ${
              stripeMode === 'live'
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                stripeMode === 'live' ? 'bg-green-100' : 'bg-gray-100'
              }`}>
                <CheckCircle className={`w-5 h-5 ${
                  stripeMode === 'live' ? 'text-green-600' : 'text-gray-400'
                }`} />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">Mode Live</p>
                <p className="text-sm text-gray-500">Paiements réels</p>
              </div>
            </div>
          </button>
        </div>

        {stripeMode === 'live' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4" />
            Mode production actif - Les paiements sont réels
          </div>
        )}
      </div>

      {/* Currency */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <DollarSign className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Devise</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Devise de base</label>
            <select
              value={baseCurrency}
              onChange={(e) => updateConfig('base_currency', e.target.value)}
              className="input"
            >
              {currencies.map(c => (
                <option key={c.code} value={c.code}>{c.symbol} {c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Global Parameters */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">⚙️</span>
          <h2 className="text-lg font-semibold text-gray-900">Paramètres généraux</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label">Vidéos par semaine (abonnés)</label>
            <input
              type="number"
              value={videosPerWeek}
              onChange={(e) => updateConfig('videos_per_week', e.target.value)}
              className="input"
              min={1}
            />
          </div>
          <div>
            <label className="label">Photos minimum</label>
            <input
              type="number"
              value={minPhotos}
              onChange={(e) => updateConfig('min_photos', e.target.value)}
              className="input"
              min={1}
            />
          </div>
          <div>
            <label className="label">Photos maximum</label>
            <input
              type="number"
              value={maxPhotos}
              onChange={(e) => updateConfig('max_photos', e.target.value)}
              className="input"
              min={1}
            />
          </div>
          <div>
            <label className="label">Longueur min. du rêve (caractères)</label>
            <input
              type="number"
              value={minDreamLength}
              onChange={(e) => updateConfig('min_dream_length', e.target.value)}
              className="input"
              min={1}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-200 pt-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="face_verif"
              checked={faceVerification}
              onChange={(e) => updateConfig('face_verification_enabled', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="face_verif" className="text-sm text-gray-700">
              Vérification faciale (même personne sur toutes les photos)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sublim_audio"
              checked={subliminalAudio}
              onChange={(e) => updateConfig('subliminal_audio_enabled', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="sublim_audio" className="text-sm text-gray-700">
              Subliminal audio (Premium)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="sublim_visual"
              checked={subliminalVisual}
              onChange={(e) => updateConfig('subliminal_visual_enabled', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="sublim_visual" className="text-sm text-gray-700">
              Subliminal visuel (Premium)
            </label>
          </div>
        </div>
      </div>

      {/* Generation AI */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Clapperboard className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Pipeline de Génération</h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="label">Timeout (minutes)</label>
            <input
              type="number"
              value={genTimeoutMinutes}
              onChange={(e) => updateConfig('generation_timeout_minutes', e.target.value)}
              className="input"
              min={5}
              max={60}
            />
            <p className="text-xs text-gray-500 mt-1">Temps max avant abandon</p>
          </div>
          <div>
            <label className="label">Max tentatives (keyframes)</label>
            <input
              type="number"
              value={genMaxAttempts}
              onChange={(e) => updateConfig('generation_max_attempts', e.target.value)}
              className="input"
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500 mt-1">Retries par image clé</p>
          </div>
          <div>
            <label className="label">Max tentatives (vidéos)</label>
            <input
              type="number"
              value={genMaxVideoAttempts}
              onChange={(e) => updateConfig('generation_max_video_attempts', e.target.value)}
              className="input"
              min={1}
              max={10}
            />
            <p className="text-xs text-gray-500 mt-1">Retries par vidéo</p>
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-700">Modèles IA</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Scénario (texte)</label>
              <select
                value={genModelScenario}
                onChange={(e) => updateConfig('generation_model_scenario', e.target.value)}
                className="input"
              >
                <option value="gpt-4o">GPT-4o (OpenAI)</option>
                <option value="gpt-4o-mini">GPT-4o Mini (OpenAI)</option>
              </select>
            </div>
            <div>
              <label className="label">Images (keyframes)</label>
              <select
                value={genModelImage}
                onChange={(e) => updateConfig('generation_model_image', e.target.value)}
                className="input"
              >
                <option value="gemini-3-pro-image-preview">Gemini 3 Pro (Google)</option>
              </select>
            </div>
            <div>
              <label className="label">Vidéo</label>
              <select
                value={genModelVideo}
                onChange={(e) => updateConfig('generation_model_video', e.target.value)}
                className="input"
              >
                <option value="fal-ai/minimax/hailuo-02/standard/image-to-video">Hailuo 02 Standard (MiniMax)</option>
                <option value="fal-ai/minimax/hailuo-02/pro/image-to-video">Hailuo 02 Pro (MiniMax)</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg mt-4">
          Les changements de modèles affectent les nouvelles générations uniquement.
          Modifier les modèles peut impacter la qualité et le coût.
        </p>
      </div>

      {/* Smile Offer */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xl">😊</span>
          <h2 className="text-lg font-semibold text-gray-900">Offre Smile</h2>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">Niveau offert</label>
            <select
              value={smileLevel}
              onChange={(e) => updateConfig('smile_level', e.target.value)}
              className="input"
            >
              <option value={1}>Niveau 1 - Essentiel</option>
              <option value={2}>Niveau 2 - Standard</option>
              <option value={3}>Niveau 3 - Premium</option>
            </select>
          </div>
          <div>
            <label className="label">Durée (mois)</label>
            <input
              type="number"
              value={smileMonths}
              onChange={(e) => updateConfig('smile_months', e.target.value)}
              className="input"
              min={1}
              max={12}
            />
          </div>
        </div>

        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
          Actuellement : <strong>Niveau {smileLevel} pendant {smileMonths} mois</strong> offert aux utilisateurs qui acceptent d'être filmés.
        </p>
      </div>

      {/* Smile Thresholds */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Seuils Smile par pays</h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          L'offre Smile est désactivée automatiquement quand le seuil est atteint.
        </p>

        {smileConfigs.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">Aucune configuration Smile</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetchWithAuth(`${API_URL}/admin/smile-configs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      country: 'ALL',
                      threshold: 1000,
                      premiumLevel: 3,
                      premiumMonths: 3,
                      isActive: true,
                    }),
                  });
                  if (res.ok) {
                    fetchSettings();
                  }
                } catch (err) {
                  console.error('Error creating smile config:', err);
                }
              }}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Créer une configuration globale
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {smileConfigs.map((config) => (
              <div key={config.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-24">
                  <span className="font-medium text-gray-900">
                    {config.country === 'ALL' ? 'Global' : config.country}
                  </span>
                  <p className={`text-xs ${config.isActive ? 'text-green-600' : 'text-red-600'}`}>
                    {config.isActive ? 'Actif' : 'Inactif'}
                  </p>
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">
                      {config.currentCount.toLocaleString()} inscrits
                    </span>
                    <span className={`text-sm font-medium ${
                      config.currentCount >= config.threshold ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {config.currentCount >= config.threshold ? 'Seuil atteint' : 'En cours'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        config.currentCount >= config.threshold ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(100, (config.currentCount / config.threshold) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-sm text-gray-600">Seuil: {config.threshold.toLocaleString()}</span>
                  <p className="text-xs text-gray-500">
                    Niveau {config.premiumLevel}, {config.premiumMonths} mois
                  </p>
                </div>

                <button
                  onClick={async () => {
                    try {
                      const res = await fetchWithAuth(`${API_URL}/admin/smile-configs/${config.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...config, isActive: !config.isActive }),
                      });
                      if (res.ok) {
                        fetchSettings();
                      }
                    } catch (err) {
                      console.error('Error toggling smile config:', err);
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded-lg ${
                    config.isActive
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {config.isActive ? 'Désactiver' : 'Activer'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
