import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore } from '../lib/store';

export default function AccessCodePage() {
  const navigate = useNavigate();
  const { setPendingAccessCode, setPendingUserId } = useAuthStore();

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authApi.validateAccessCode(code.trim().toUpperCase());

      if (result.status === 'new_user') {
        // First time user - needs to create PIN
        setPendingAccessCode(result.accessCodeId!);
        navigate('/create-pin');
      } else if (result.status === 'existing_user') {
        // Returning user - needs to verify PIN
        setPendingUserId(result.userId!);
        navigate('/verify-pin');
      }

      // Track analytics event
      window.dataLayer?.push({
        event: 'accesscode_submitted',
        status: 'success',
        source: result.source,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code invalide');
      window.dataLayer?.push({
        event: 'accesscode_submitted',
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Retour</span>
      </motion.button>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-dream flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-center mb-2">
            Entrez votre code
          </h1>
          <p className="text-white/60 text-center mb-8">
            Saisissez le code d'accès que vous avez reçu
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                className="input-glass text-center text-xl tracking-widest uppercase"
                maxLength={14}
                disabled={isLoading}
                autoComplete="off"
                autoFocus
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-sm text-center"
              >
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={code.length < 6 || isLoading}
              className="gradient-button w-full py-4 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <span>Continuer</span>
              )}
            </button>
          </form>

          {/* Help text */}
          <p className="text-white/40 text-sm text-center mt-8">
            Vous n'avez pas de code ?{' '}
            <a
              href="https://sublym.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-dream-400 hover:text-dream-300 transition-colors"
            >
              Obtenir un accès
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
