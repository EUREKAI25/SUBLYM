import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  Upload,
  X,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { dreamsApi, assetsApi, ImageAsset } from '../lib/api';

const MAX_PHOTOS = 6;

export default function DreamDefinePage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<'photos' | 'dream' | 'generating'>('photos');
  const [photos, setPhotos] = useState<ImageAsset[]>([]);
  const [dreamText, setDreamText] = useState('');
  const [rejectText, setRejectText] = useState('');
  const [error, setError] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > MAX_PHOTOS) {
      setError(`Maximum ${MAX_PHOTOS} photos. Supprimez-en d'abord.`);
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      for (const file of Array.from(files)) {
        if (photos.length >= MAX_PHOTOS) break;

        const result = await assetsApi.upload(file, undefined, 'user_photo', 'upload');
        setPhotos((prev) => [...prev, result.asset]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async (assetId: string) => {
    try {
      await assetsApi.delete(assetId);
      setPhotos((prev) => prev.filter((p) => p.id !== assetId));
    } catch (err) {
      setError('Erreur lors de la suppression');
    }
  };

  const handleContinue = () => {
    if (photos.length === 0) {
      setError('Ajoutez au moins une photo de vous');
      return;
    }
    setStep('dream');
    setError('');
  };

  const handleCreateDream = async () => {
    if (!dreamText.trim()) {
      setError('Décrivez votre rêve');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // Create dream
      const dreamResult = await dreamsApi.create({
        description: dreamText.trim(),
        rejectText: rejectText.trim() || undefined,
      });

      // Associate photos with dream
      for (const photo of photos) {
        await assetsApi.update(photo.id, { isEnabled: true });
      }

      // Trigger generation
      await dreamsApi.generate(dreamResult.dream.id);

      setStep('generating');

      // Navigate to viewer after a short delay
      setTimeout(() => {
        navigate(`/dream/${dreamResult.dream.id}`);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4">
        <button
          onClick={() => (step === 'dream' ? setStep('photos') : navigate('/dreams'))}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </button>
        <h1 className="flex-1 text-lg font-semibold text-center">
          {step === 'photos' ? 'Vos photos' : step === 'dream' ? 'Votre rêve' : 'Génération'}
        </h1>
        <div className="w-16" />
      </header>

      {/* Content */}
      <main className="flex-1 px-6 pb-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          {step === 'photos' && (
            <motion.div
              key="photos"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <p className="text-white/60">
                  Ajoutez jusqu'à {MAX_PHOTOS} photos de vous pour personnaliser vos images
                </p>
              </div>

              {/* Photo grid */}
              <div className="grid grid-cols-3 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-square">
                    <img
                      src={photo.url}
                      alt="Photo"
                      className="w-full h-full object-cover rounded-xl"
                    />
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}

                {/* Add photo button */}
                {photos.length < MAX_PHOTOS && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="aspect-square border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-dream-500/50 transition-colors disabled:opacity-50"
                  >
                    {isUploading ? (
                      <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
                    ) : (
                      <>
                        <Upload className="w-6 h-6 text-white/40" />
                        <span className="text-xs text-white/40">Ajouter</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Photo count */}
              <p className="text-center text-sm text-white/40">
                {photos.length} / {MAX_PHOTOS} photos
              </p>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Continue button */}
              <button
                onClick={handleContinue}
                disabled={photos.length === 0}
                className="gradient-button w-full py-4 font-semibold disabled:opacity-50"
              >
                Continuer
              </button>
            </motion.div>
          )}

          {step === 'dream' && (
            <motion.div
              key="dream"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="text-center mb-8">
                <p className="text-white/60">
                  Décrivez le rêve que vous souhaitez visualiser
                </p>
              </div>

              {/* Dream input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">
                  Mon rêve
                </label>
                <textarea
                  value={dreamText}
                  onChange={(e) => setDreamText(e.target.value)}
                  placeholder="Décrivez votre vie idéale, vos objectifs, ce que vous voulez manifester..."
                  className="input-glass min-h-[150px] resize-none"
                  maxLength={2000}
                />
                <p className="text-xs text-white/40 text-right">
                  {dreamText.length} / 2000
                </p>
              </div>

              {/* Reject input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/80">
                  Éléments à éviter (optionnel)
                </label>
                <textarea
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                  placeholder="Situations ou éléments que vous ne voulez pas voir..."
                  className="input-glass min-h-[80px] resize-none"
                  maxLength={1000}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm justify-center">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              {/* Create button */}
              <button
                onClick={handleCreateDream}
                disabled={!dreamText.trim() || isCreating}
                className="gradient-button w-full py-4 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Création...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Créer mon rêve</span>
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 'generating' && (
            <motion.div
              key="generating"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center min-h-[60vh]"
            >
              <div className="w-20 h-20 rounded-2xl bg-gradient-dream flex items-center justify-center mb-8 animate-pulse-soft">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-xl font-display font-bold mb-2">
                Création en cours
              </h2>
              <p className="text-white/60 text-center">
                Vos images sont en cours de génération...
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
