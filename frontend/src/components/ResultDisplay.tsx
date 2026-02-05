import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, ChevronLeft, ChevronRight, Share2, Heart } from 'lucide-react';
import { useI18n } from '@/hooks';
import type { GenerationResult } from '@/types';

interface ResultDisplayProps {
  result: GenerationResult;
  onNewCreation?: () => void;
}

export function ResultDisplay({ result, onNewCreation }: ResultDisplayProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { t } = useI18n();

  const allMedia = [
    ...(result.video_url ? [{ type: 'video' as const, url: result.video_url }] : []),
    ...(result.keyframes?.map((url) => ({ type: 'image' as const, url })) || []),
    ...(result.images?.map((img) => ({ type: 'image' as const, url: img.url, scene: img.scene })) || []),
  ];

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxIndex === null) return;
    const newIndex =
      direction === 'prev'
        ? (lightboxIndex - 1 + allMedia.length) % allMedia.length
        : (lightboxIndex + 1) % allMedia.length;
    setLightboxIndex(newIndex);
  };

  return (
    <div className="space-y-8">
      {/* Video */}
      {result.video_url && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card overflow-hidden"
        >
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-gray-950">
            <video
              src={result.video_url}
              controls
              className="w-full h-full object-contain"
              poster={result.keyframes?.[0]}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mt-6">
            <a href={result.video_url} download className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center">
              <Download className="w-4 h-4" />
              {t('common.download')}
            </a>
            <button className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center">
              <Share2 className="w-4 h-4" />
              {t('common.share')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Scenario */}
      {result.scenario && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card"
        >
          <h3 className="font-display text-xl text-teal-800 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 fill-teal-200" />
            {t('result.storyTitle')}
          </h3>
          <p className="text-gray-700 leading-relaxed whitespace-pre-line">
            {result.scenario}
          </p>
        </motion.div>
      )}

      {/* Gallery */}
      {allMedia.length > (result.video_url ? 1 : 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-display text-xl text-teal-800 mb-4">
            {t('result.keyMoments')}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
            {allMedia.slice(result.video_url ? 1 : 0).map((media, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 * index }}
                onClick={() => openLightbox(result.video_url ? index + 1 : index)}
                className="relative aspect-square rounded-xl overflow-hidden group"
              >
                <img
                  src={media.url}
                  alt={media.scene || `Image ${index + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  {media.scene && (
                    <p className="text-white text-sm line-clamp-2">{media.scene}</p>
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* New creation button */}
      {onNewCreation && (
        <div className="text-center pt-4">
          <button onClick={onNewCreation} className="btn-secondary">
            {t('result.newCreation')}
          </button>
        </div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && allMedia[lightboxIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2 text-white/70 hover:text-white transition-colors"
            >
              <X className="w-6 h-6 sm:w-8 sm:h-8" />
            </button>

            {allMedia.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('prev'); }}
                  className="absolute left-2 sm:left-4 p-2 sm:p-3 text-white/70 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); navigateLightbox('next'); }}
                  className="absolute right-2 sm:right-4 p-2 sm:p-3 text-white/70 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
                </button>
              </>
            )}

            <div className="max-w-5xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
              {allMedia[lightboxIndex].type === 'video' ? (
                <video
                  src={allMedia[lightboxIndex].url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[80vh] rounded-lg"
                />
              ) : (
                <img
                  src={allMedia[lightboxIndex].url}
                  alt=""
                  className="max-w-full max-h-[80vh] object-contain rounded-lg"
                />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
