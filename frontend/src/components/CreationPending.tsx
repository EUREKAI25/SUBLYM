import { motion } from 'framer-motion';
import { Heart, Mail, Sparkles, Clock } from 'lucide-react';
import { useI18n } from '@/hooks';

interface CreationPendingProps {
  email: string;
  onCreateAnother?: () => void;
}

export function CreationPending({ email, onCreateAnother }: CreationPendingProps) {
  const { t } = useI18n();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-lg w-full text-center"
      >
        {/* Animated heart */}
        <div className="relative w-24 h-24 mx-auto mb-8">
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full bg-gradient-teal opacity-20"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Heart className="w-12 h-12 text-teal-600 fill-teal-500 heart-beat" />
          </div>
          
          {/* Sparkles around */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{
                top: `${20 + i * 20}%`,
                left: i % 2 === 0 ? '-10%' : '85%',
              }}
              animate={{
                y: [0, -10, 0],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.5,
              }}
            >
              <Sparkles className="w-5 h-5 text-teal-400" />
            </motion.div>
          ))}
        </div>

        {/* Title */}
        <h1 className="font-display text-2xl sm:text-3xl text-gray-900 mb-4">
          {t('pending.title')}
        </h1>

        {/* Subtitle */}
        <p className="text-gray-600 text-lg mb-8 leading-relaxed">
          {t('pending.subtitle')}
        </p>

        {/* Email notification card */}
        <div className="card bg-gradient-to-br from-teal-50 to-blush-50 border-teal-100 mb-8">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center">
                <Mail className="w-6 h-6 text-teal-600" />
              </div>
            </div>
            <div className="text-left">
              <p className="text-teal-800 font-medium mb-1">
                {t('pending.emailNotice')}
              </p>
              <p className="text-teal-600 text-sm">
                {email}
              </p>
            </div>
          </div>
        </div>

        {/* Time estimate */}
        <div className="flex items-center justify-center gap-2 text-gray-500 mb-8">
          <Clock className="w-4 h-4" />
          <span className="text-sm">{t('pending.timeEstimate')}</span>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-left space-y-3">
          <p className="font-medium text-gray-800 text-sm">
            {t('pending.whileWaiting')}
          </p>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-teal-500">✓</span>
              {t('pending.tip1')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500">✓</span>
              {t('pending.tip2')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-teal-500">✓</span>
              {t('pending.tip3')}
            </li>
          </ul>
        </div>

        {/* Create another */}
        {onCreateAnother && (
          <button
            onClick={onCreateAnother}
            className="mt-4 text-teal-600 hover:text-teal-800 text-sm font-medium"
          >
            {t('pending.createAnother')}
          </button>
        )}
      </motion.div>
    </div>
  );
}
