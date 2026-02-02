import { motion } from 'framer-motion';
import { Heart, Sparkles, Film, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useI18n } from '@/hooks';
import type { RunStatus } from '@/types';

interface ProgressDisplayProps {
  status: RunStatus;
  error?: string | null;
  onRetry?: () => void;
}

export function ProgressDisplay({ status, error, onRetry }: ProgressDisplayProps) {
  const { t } = useI18n();
  const isComplete = status.status === 'done';
  const hasError = status.status === 'error' || !!error;

  const getProgressLabel = (progress: number): string => {
    if (progress < 20) return t('progress.analyzing');
    if (progress < 40) return t('progress.scenario');
    if (progress < 60) return t('progress.generating');
    if (progress < 80) return t('progress.assembling');
    if (progress < 100) return t('progress.finalizing');
    return t('progress.done');
  };

  return (
    <div className="card max-w-lg mx-auto text-center">
      {/* Animation */}
      <div className="mb-6">
        {hasError ? (
          <div className="w-20 h-20 mx-auto rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
        ) : isComplete ? (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-20 h-20 mx-auto rounded-full bg-green-50 flex items-center justify-center"
          >
            <CheckCircle className="w-10 h-10 text-green-500" />
          </motion.div>
        ) : (
          <div className="relative w-20 h-20 mx-auto">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Heart className="w-12 h-12 text-wine-500 fill-wine-500" />
            </motion.div>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="absolute inset-0"
            >
              <Sparkles className="w-4 h-4 text-wine-300 absolute top-0 left-1/2 -translate-x-1/2" />
              <Film className="w-4 h-4 text-wine-300 absolute bottom-0 left-1/2 -translate-x-1/2" />
            </motion.div>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="font-display text-2xl text-charcoal-800 mb-2">
        {hasError
          ? t('progress.error')
          : isComplete
          ? t('result.title')
          : t('progress.creating')}
      </h3>

      {/* Message */}
      <p className="text-charcoal-600 mb-6">
        {hasError
          ? error || status.error || t('progress.errorMessage')
          : isComplete
          ? t('result.subtitle')
          : getProgressLabel(status.progress)}
      </p>

      {/* Progress bar */}
      {!hasError && !isComplete && (
        <div className="space-y-2">
          <div className="progress-bar">
            <motion.div
              className="progress-bar-fill"
              initial={{ width: 0 }}
              animate={{ width: `${status.progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-sm text-charcoal-500">{status.progress}%</p>
        </div>
      )}

      {/* Retry button */}
      {hasError && onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4">
          {t('common.retry')}
        </button>
      )}
    </div>
  );
}
