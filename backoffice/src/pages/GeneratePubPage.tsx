import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Clapperboard, Loader2, CheckCircle, AlertCircle, Upload, X,
  Plus, GripVertical, Trash2, Eye, ArrowLeftRight, Sparkles, Film
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// Types de scènes disponibles
type SceneType = 'transition_awakening' | 'transition_action' | 'free' | 'pov' | 'accomplishment';

interface SceneConfig {
  id: string;
  type: SceneType;
  description?: string;
  allowsCameraLook?: boolean;
}

const SCENE_TYPE_INFO: Record<SceneType, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  transition_awakening: {
    label: 'Transition Avant/Après',
    icon: <ArrowLeftRight className="w-4 h-4" />,
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    description: 'Passage du quotidien au rêve (couleurs désaturées → vives)',
  },
  transition_action: {
    label: 'Transition Action',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    description: 'Premiers pas dans le rêve (keyframe partagée avec fin transition)',
  },
  free: {
    label: 'Scène Libre',
    icon: <Film className="w-4 h-4" />,
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    description: 'Scène de rêve indépendante (action, interaction, immersion)',
  },
  pov: {
    label: 'Scène POV',
    icon: <Eye className="w-4 h-4" />,
    color: 'bg-teal-100 text-teal-700 border-teal-200',
    description: 'Vue subjective (ce que voit le personnage en marchant)',
  },
  accomplishment: {
    label: 'Accomplissement',
    icon: <CheckCircle className="w-4 h-4" />,
    color: 'bg-green-100 text-green-700 border-green-200',
    description: 'Scène finale, regard caméra autorisé, rêve réalisé',
  },
};

let sceneIdCounter = 0;
function generateSceneId(): string {
  return `scene_${++sceneIdCounter}_${Date.now()}`;
}

export function GeneratePubPage() {
  const { fetchWithAuth } = useAuth();

  // Form state
  const [dreamDescription, setDreamDescription] = useState('');
  const [dailyContext, setDailyContext] = useState('');
  const [rejectText, setRejectText] = useState('');

  // Scenes configuration
  const [scenes, setScenes] = useState<SceneConfig[]>([
    { id: generateSceneId(), type: 'transition_awakening' },
    { id: generateSceneId(), type: 'transition_action' },
    { id: generateSceneId(), type: 'free' },
    { id: generateSceneId(), type: 'free' },
    { id: generateSceneId(), type: 'free' },
    { id: generateSceneId(), type: 'accomplishment', allowsCameraLook: true },
  ]);

  // Photo state
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state for scenes
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; traceId?: string; error?: string } | null>(null);

  // Photo handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    setPhotoFiles(prev => [...prev, ...files].slice(0, 10));
  }, []);

  const handlePhotoFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    setPhotoFiles(prev => [...prev, ...files].slice(0, 10));
  }, []);

  const removePhotoFile = useCallback((index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Scene handlers
  const addScene = (type: SceneType) => {
    const newScene: SceneConfig = {
      id: generateSceneId(),
      type,
      allowsCameraLook: type === 'accomplishment',
    };
    setScenes(prev => [...prev, newScene]);
  };

  const removeScene = (index: number) => {
    setScenes(prev => prev.filter((_, i) => i !== index));
  };

  const updateScene = (index: number, updates: Partial<SceneConfig>) => {
    setScenes(prev => prev.map((s, i) => i === index ? { ...s, ...updates } : s));
  };

  // Drag and drop for scenes
  const handleSceneDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleSceneDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newScenes = [...scenes];
    const [draggedScene] = newScenes.splice(draggedIndex, 1);
    newScenes.splice(index, 0, draggedScene);
    setScenes(newScenes);
    setDraggedIndex(index);
  };

  const handleSceneDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSubmit = async () => {
    if (photoFiles.length === 0 || !dreamDescription.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const formData = new FormData();
      for (const file of photoFiles) {
        formData.append('photos', file);
      }
      formData.append('dreamDescription', dreamDescription.trim());
      if (dailyContext.trim()) {
        formData.append('dailyContext', dailyContext.trim());
      }
      formData.append('scenesConfig', JSON.stringify(scenes));
      formData.append('scenesCount', scenes.filter(s => !s.type.startsWith('transition')).length.toString());
      if (rejectText.trim()) {
        formData.append('reject', rejectText.trim());
      }

      const res = await fetch(`${API_URL}/admin/generate-pub`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}` },
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, traceId: data.run?.traceId });
      } else {
        setResult({ success: false, error: data.error || 'Erreur inconnue' });
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Erreur de connexion' });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = photoFiles.length >= 3 && dreamDescription.trim().length >= 10 && scenes.length >= 1;

  // Count scene types
  const hasTransition = scenes.some(s => s.type === 'transition_awakening');
  const freeCount = scenes.filter(s => s.type === 'free').length;
  const povCount = scenes.filter(s => s.type === 'pov').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Composer un scénario</h1>
        <p className="text-gray-500 mt-1">
          Assemblez les scènes selon vos besoins : transitions, scènes libres, POV...
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Photos du personnage */}
          <div className="card">
            <label className="label">Photos du personnage</label>
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => document.getElementById('pub-photo-input')?.click()}
            >
              <input
                id="pub-photo-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoFileSelect}
              />
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Glissez 3 à 10 photos ici</p>
            </div>

            {photoFiles.length > 0 && (
              <div className="mt-3">
                <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                  {photoFiles.map((file, i) => (
                    <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img src={URL.createObjectURL(file)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => { e.stopPropagation(); removePhotoFile(i); }}
                        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">{photoFiles.length} photo(s)</p>
              </div>
            )}
          </div>

          {/* Dream description */}
          <div className="card">
            <label className="label">Description du rêve</label>
            <textarea
              value={dreamDescription}
              onChange={(e) => setDreamDescription(e.target.value)}
              placeholder="Ex: Devenir chef cuisinier dans un grand restaurant parisien..."
              className="input min-h-[100px]"
              rows={4}
            />
          </div>

          {/* Daily context (optional) */}
          <div className="card">
            <label className="label">
              Contexte quotidien <span className="text-gray-400 font-normal">(optionnel, pour transitions avant/après)</span>
            </label>
            <textarea
              value={dailyContext}
              onChange={(e) => setDailyContext(e.target.value)}
              placeholder="Ex: Employé de bureau dans un open space gris..."
              className="input min-h-[60px]"
              rows={2}
            />
          </div>

          {/* Reject */}
          <div className="card">
            <label className="label">Éléments à exclure <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input
              type="text"
              value={rejectText}
              onChange={(e) => setRejectText(e.target.value)}
              placeholder="Ex: pas de robe, pas de plage..."
              className="input"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="btn btn-primary flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Lancement...
                </>
              ) : (
                <>
                  <Clapperboard className="w-4 h-4" />
                  Lancer la génération
                </>
              )}
            </button>

            {result && (
              <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
                {result.success ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Lancé (trace: {result.traceId})
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4" />
                    {result.error}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Scene composer */}
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Scènes ({scenes.length})</h2>
            </div>

            {/* Add scene buttons */}
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-gray-100">
              {(Object.keys(SCENE_TYPE_INFO) as SceneType[]).map((type) => {
                const info = SCENE_TYPE_INFO[type];
                return (
                  <button
                    key={type}
                    onClick={() => addScene(type)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:opacity-80 ${info.color}`}
                    title={info.description}
                  >
                    {info.icon}
                    <Plus className="w-3 h-3" />
                  </button>
                );
              })}
            </div>

            {/* Scene list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {scenes.map((scene, index) => {
                const info = SCENE_TYPE_INFO[scene.type];
                return (
                  <div
                    key={scene.id}
                    draggable
                    onDragStart={() => handleSceneDragStart(index)}
                    onDragOver={(e) => handleSceneDragOver(e, index)}
                    onDragEnd={handleSceneDragEnd}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-move transition-all ${
                      draggedIndex === index ? 'opacity-50 scale-95' : ''
                    } ${info.color}`}
                  >
                    <GripVertical className="w-4 h-4 opacity-50 flex-shrink-0" />
                    <span className="flex items-center gap-1.5 text-xs font-medium flex-1">
                      {info.icon}
                      <span className="truncate">{info.label}</span>
                    </span>
                    <span className="text-[10px] opacity-60 flex-shrink-0">#{index + 1}</span>
                    <button
                      onClick={() => removeScene(index)}
                      className="p-1 hover:bg-white/50 rounded opacity-60 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {scenes.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Aucune scène. Ajoutez-en avec les boutons ci-dessus.
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="card bg-gray-50 text-sm">
            <h3 className="font-medium text-gray-700 mb-2">Résumé</h3>
            <ul className="space-y-1 text-gray-600">
              {hasTransition && <li>• Transition quotidien → rêve</li>}
              {freeCount > 0 && <li>• {freeCount} scène(s) libre(s)</li>}
              {povCount > 0 && <li>• {povCount} scène(s) POV</li>}
              {scenes.some(s => s.type === 'accomplishment') && (
                <li>• Accomplissement final (regard caméra)</li>
              )}
            </ul>
          </div>

          {/* Legend */}
          <div className="card text-xs space-y-2">
            <h3 className="font-medium text-gray-700 mb-2">Légende</h3>
            {(Object.entries(SCENE_TYPE_INFO) as [SceneType, typeof SCENE_TYPE_INFO[SceneType]][]).map(([type, info]) => (
              <div key={type} className="flex items-start gap-2">
                <span className={`flex-shrink-0 p-1 rounded ${info.color}`}>{info.icon}</span>
                <div>
                  <span className="font-medium">{info.label}</span>
                  <p className="text-gray-500">{info.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
