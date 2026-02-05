import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  Home,
  Library,
  Settings,
  Lock,
  Eye,
  EyeOff,
  Heart,
  Download,
  ChevronUp,
} from 'lucide-react';
import { dreamsApi, assetsApi, ViewerData } from '../lib/api';
import { useSettingsStore, useViewerStore, useAuthStore } from '../lib/store';

export default function DreamViewerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { navigationMode, gestureSensitivity } = useSettingsStore();
  const { setCurrentDream, currentImageIndex, setCurrentImageIndex, nextImage, previousImage, isBottomBarVisible, toggleBottomBar, hideBottomBar } = useViewerStore();
  const { lock } = useAuthStore();

  const [viewerData, setViewerData] = useState<ViewerData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Motion values for swipe
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-200, 0, 200], [0.5, 1, 0.5]);

  useEffect(() => {
    if (id) {
      loadViewer(id);
    }
  }, [id]);

  const loadViewer = async (dreamId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const data = await dreamsApi.getViewer(dreamId);
      setViewerData(data);
      setCurrentDream(dreamId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwipe = useCallback(
    (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (!viewerData) return;

      const threshold = 100 * (1 - gestureSensitivity);

      if (info.offset.x < -threshold) {
        nextImage(viewerData.images.length);
      } else if (info.offset.x > threshold) {
        previousImage(viewerData.images.length);
      }
    },
    [viewerData, gestureSensitivity, nextImage, previousImage]
  );

  const handleScroll = useCallback(
    (e: React.WheelEvent) => {
      if (!viewerData || navigationMode !== 'scroll') return;

      if (e.deltaY > 0) {
        nextImage(viewerData.images.length);
      } else {
        previousImage(viewerData.images.length);
      }
    },
    [viewerData, navigationMode, nextImage, previousImage]
  );

  const handleTap = () => {
    toggleBottomBar();
  };

  const handleLock = async () => {
    lock();
    navigate('/lock');
  };

  const handleToggleEnabled = async () => {
    if (!viewerData) return;
    const currentImage = viewerData.images[currentImageIndex];
    if (!currentImage) return;

    try {
      await assetsApi.update(currentImage.id, {
        isEnabled: false,
      });
      // Reload viewer
      loadViewer(viewerData.id);
    } catch (err) {
      console.error('Failed to toggle enabled:', err);
    }
  };

  const handleToggleFavorite = async () => {
    if (!viewerData) return;
    const currentImage = viewerData.images[currentImageIndex];
    if (!currentImage) return;

    try {
      await assetsApi.update(currentImage.id, {
        isFavorite: !currentImage.isFavorite,
      });
      // Update local state
      setViewerData((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          images: prev.images.map((img, i) =>
            i === currentImageIndex ? { ...img, isFavorite: !img.isFavorite } : img
          ),
        };
      });
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDownloadWallpaper = async () => {
    if (!viewerData) return;
    const currentImage = viewerData.images[currentImageIndex];
    if (!currentImage) return;

    try {
      const result = await assetsApi.getWallpaper(currentImage.id);
      window.open(result.url, '_blank');
    } catch (err) {
      console.error('Failed to get wallpaper:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-dream-500/30 border-t-dream-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !viewerData || viewerData.images.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black px-6">
        <p className="text-white/60 text-center mb-4">
          {error || 'Aucune image disponible'}
        </p>
        <button
          onClick={() => navigate('/dreams')}
          className="text-dream-400 hover:text-dream-300"
        >
          Retour aux rêves
        </button>
      </div>
    );
  }

  const currentImage = viewerData.images[currentImageIndex];

  return (
    <div
      className="viewer-fullscreen bg-black"
      onWheel={handleScroll}
      onClick={handleTap}
    >
      {/* Images */}
      <AnimatePresence mode="wait">
        {navigationMode === 'swipe' ? (
          <motion.div
            key={currentImageIndex}
            className="absolute inset-0"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={handleSwipe}
            style={{ x, opacity }}
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={currentImage.url}
              alt="Dream"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </motion.div>
        ) : (
          <motion.div
            key={currentImageIndex}
            className="absolute inset-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={currentImage.url}
              alt="Dream"
              className="w-full h-full object-cover"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image indicator */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {viewerData.images.map((_, index) => (
          <button
            key={index}
            onClick={(e) => {
              e.stopPropagation();
              setCurrentImageIndex(index);
            }}
            className={`w-2 h-2 rounded-full transition-all ${
              index === currentImageIndex
                ? 'bg-white w-6'
                : 'bg-white/30 hover:bg-white/50'
            }`}
          />
        ))}
      </div>

      {/* Favorite indicator */}
      {currentImage.isFavorite && (
        <div className="absolute top-8 right-6 z-10">
          <Heart className="w-5 h-5 text-dream-500 fill-dream-500" />
        </div>
      )}

      {/* Bottom action bar trigger */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 flex items-end justify-center pb-4 z-20"
        onClick={(e) => {
          e.stopPropagation();
          toggleBottomBar();
        }}
      >
        <motion.div
          animate={{ y: isBottomBarVisible ? 10 : 0 }}
          className="w-10 h-1 bg-white/30 rounded-full"
        />
      </div>

      {/* Bottom action bar */}
      <AnimatePresence>
        {isBottomBarVisible && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bottom-action-bar z-30"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              {/* Handle */}
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => hideBottomBar()}
                  className="w-10 h-1 bg-white/30 rounded-full hover:bg-white/50 transition-colors"
                />
              </div>

              {/* Navigation icons */}
              <div className="flex justify-around mb-6">
                <button
                  onClick={() => navigate('/')}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <Home className="w-6 h-6" />
                  <span className="text-xs">Accueil</span>
                </button>
                <button
                  onClick={() => navigate('/dreams')}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <Library className="w-6 h-6" />
                  <span className="text-xs">Rêves</span>
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <Settings className="w-6 h-6" />
                  <span className="text-xs">Réglages</span>
                </button>
                <button
                  onClick={handleLock}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <Lock className="w-6 h-6" />
                  <span className="text-xs">Verrouiller</span>
                </button>
              </div>

              {/* Divider */}
              <div className="h-px bg-white/10 mb-6" />

              {/* Image actions */}
              <div className="flex justify-around">
                <button
                  onClick={handleToggleEnabled}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <EyeOff className="w-5 h-5" />
                  <span className="text-xs">Masquer</span>
                </button>
                <button
                  onClick={handleToggleFavorite}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    currentImage.isFavorite ? 'text-dream-500' : 'text-white/60 hover:text-white'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${currentImage.isFavorite ? 'fill-current' : ''}`} />
                  <span className="text-xs">Favori</span>
                </button>
                <button
                  onClick={handleDownloadWallpaper}
                  className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition-colors"
                >
                  <Download className="w-5 h-5" />
                  <span className="text-xs">Fond</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
