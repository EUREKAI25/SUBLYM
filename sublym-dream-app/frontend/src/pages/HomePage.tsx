import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../lib/store';

export default function HomePage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLocked } = useAuthStore();

  const handleStart = () => {
    if (isAuthenticated && !isLocked) {
      navigate('/dreams');
    } else if (isAuthenticated && isLocked) {
      navigate('/lock');
    } else {
      navigate('/access');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-area-inset">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Animated orbs */}
      <motion.div
        className="absolute top-20 left-10 w-64 h-64 rounded-full bg-dream-500/20 blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      <motion.div
        className="absolute bottom-20 right-10 w-72 h-72 rounded-full bg-primary-from/20 blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.4, 0.2, 0.4],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-dream mb-6">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-5xl font-display font-bold text-gradient mb-4">
          Sublym
        </h1>
        <p className="text-lg text-white/60 max-w-xs mx-auto">
          Visualisez vos rêves, manifestez votre réalité
        </p>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <button
          onClick={handleStart}
          className="gradient-button flex items-center gap-3 px-8 py-4 text-lg font-semibold"
        >
          <span>Commencer</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </motion.div>

      {/* Version */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute bottom-8 text-sm text-white/30"
      >
        v1.0.0 - Dream Mode
      </motion.p>
    </div>
  );
}
