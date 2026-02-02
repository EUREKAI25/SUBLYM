import { useState, useEffect } from 'react';
import { Save, Edit2, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

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
  enabled: boolean;
}

export function PricingPage() {
  const { fetchWithAuth } = useAuth();
  const [levels, setLevels] = useState<PricingLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchPricing();
  }, [fetchWithAuth]);

  async function fetchPricing() {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${API_URL}/config/pricing`);

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

  const updateLevel = (levelIndex: number, field: string, value: number | boolean | string) => {
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
        alert('Configuration sauvegardée !');
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
          <h1 className="text-2xl font-bold text-gray-900">Configuration Pricing</h1>
          <p className="text-gray-600 mt-1">Gérez les niveaux d'abonnement et tarifs</p>
        </div>
        {hasChanges && (
          <button onClick={savePricing} className="btn-primary flex items-center gap-2" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Sauvegarder
          </button>
        )}
      </div>

      {/* Levels */}
      {levels.length === 0 ? (
        <div className="card text-center py-8 text-gray-500">
          Aucun niveau de tarification configuré
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {levels.map((level, index) => (
            <div key={level.id} className={`card relative ${!level.enabled ? 'opacity-60' : ''}`}>
              <button
                onClick={() => setEditingLevel(editingLevel === index ? null : index)}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <div className="text-center mb-6">
                <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
                  level.level === 3 
                    ? 'bg-purple-100 text-purple-700'
                    : level.level === 2
                    ? 'bg-indigo-100 text-indigo-700'
                    : level.level === 1
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  Niveau {level.level}
                </span>
                {editingLevel === index ? (
                  <input
                    type="text"
                    value={level.name}
                    onChange={(e) => updateLevel(index, 'name', e.target.value)}
                    className="input mt-2 text-center text-xl font-bold"
                  />
                ) : (
                  <h3 className="text-xl font-bold text-gray-900 mt-2">{level.name}</h3>
                )}
                {!level.enabled && (
                  <span className="text-xs text-red-500 mt-1 block">Désactivé</span>
                )}
              </div>

              <div className="space-y-4">
                {/* Photos */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Photos</span>
                  {editingLevel === index ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={level.photosMin}
                        onChange={(e) => updateLevel(index, 'photosMin', parseInt(e.target.value))}
                        className="input w-14 text-center"
                        min={1}
                      />
                      <span>-</span>
                      <input
                        type="number"
                        value={level.photosMax}
                        onChange={(e) => updateLevel(index, 'photosMax', parseInt(e.target.value))}
                        className="input w-14 text-center"
                        min={1}
                      />
                    </div>
                  ) : (
                    <span className="font-medium">{level.photosMin} - {level.photosMax}</span>
                  )}
                </div>

                {/* Keyframes */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Keyframes</span>
                  {editingLevel === index ? (
                    <input
                      type="number"
                      value={level.keyframesCount}
                      onChange={(e) => updateLevel(index, 'keyframesCount', parseInt(e.target.value))}
                      className="input w-16 text-center"
                      min={1}
                    />
                  ) : (
                    <span className="font-medium">{level.keyframesCount}</span>
                  )}
                </div>

                {/* Video enabled */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Vidéo</span>
                  {editingLevel === index ? (
                    <input
                      type="checkbox"
                      checked={level.videoEnabled}
                      onChange={(e) => updateLevel(index, 'videoEnabled', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  ) : (
                    <span className={`font-medium ${level.videoEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.videoEnabled ? '✓ Oui' : '✗ Non'}
                    </span>
                  )}
                </div>

                {/* Scenes */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Scènes vidéo</span>
                  {editingLevel === index ? (
                    <input
                      type="number"
                      value={level.scenesCount}
                      onChange={(e) => updateLevel(index, 'scenesCount', parseInt(e.target.value))}
                      className="input w-16 text-center"
                      min={1}
                    />
                  ) : (
                    <span className="font-medium">{level.scenesCount}</span>
                  )}
                </div>

                {/* Generations per month */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Générations/mois</span>
                  {editingLevel === index ? (
                    <input
                      type="number"
                      value={level.generationsPerMonth}
                      onChange={(e) => updateLevel(index, 'generationsPerMonth', parseInt(e.target.value))}
                      className="input w-16 text-center"
                      min={-1}
                    />
                  ) : (
                    <span className="font-medium">
                      {level.generationsPerMonth === -1 ? '∞' : level.generationsPerMonth}
                    </span>
                  )}
                </div>

                {/* Subliminal */}
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-gray-600">Subliminal</span>
                  {editingLevel === index ? (
                    <input
                      type="checkbox"
                      checked={level.subliminalEnabled}
                      onChange={(e) => updateLevel(index, 'subliminalEnabled', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  ) : (
                    <span className={`font-medium ${level.subliminalEnabled ? 'text-green-600' : 'text-gray-400'}`}>
                      {level.subliminalEnabled ? '✓ Oui' : '✗ Non'}
                    </span>
                  )}
                </div>

                {/* Enabled */}
                {editingLevel === index && (
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <span className="text-gray-600">Actif</span>
                    <input
                      type="checkbox"
                      checked={level.enabled}
                      onChange={(e) => updateLevel(index, 'enabled', e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </div>
                )}

                {/* Prices */}
                <div className="pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prix mensuel</span>
                    {editingLevel === index ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={level.priceMonthly}
                          onChange={(e) => updateLevel(index, 'priceMonthly', parseFloat(e.target.value))}
                          className="input w-20 text-right"
                          min={0}
                          step={0.01}
                        />
                        <span>€</span>
                      </div>
                    ) : (
                      <span className="text-xl font-bold text-primary-600">{level.priceMonthly} €/mois</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Prix annuel</span>
                    {editingLevel === index ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={level.priceYearly}
                          onChange={(e) => updateLevel(index, 'priceYearly', parseFloat(e.target.value))}
                          className="input w-20 text-right"
                          min={0}
                          step={0.01}
                        />
                        <span>€</span>
                      </div>
                    ) : (
                      <span className="text-lg font-medium text-gray-700">{level.priceYearly} €/an</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
