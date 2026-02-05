import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore, useSettingsStore } from '../lib/store';

export default function VerifyPinPage() {
  const navigate = useNavigate();
  const { pendingUserId, setToken, setUserId } = useAuthStore();
  const { updateSettings } = useSettingsStore();

  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!pendingUserId) {
      navigate('/access');
    }
  }, [pendingUserId, navigate]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if PIN is complete
    if (newPin.every((d) => d !== '')) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (enteredPin: string) => {
    setIsLoading(true);
    setError('');

    try {
      const result = await authApi.verifyPin(pendingUserId!, enteredPin);

      // Save auth state
      setToken(result.token);
      setUserId(result.user.id);

      // Update settings from server
      updateSettings({
        navigationMode: result.user.navigationMode,
        useDreamTheme: result.user.useDreamTheme,
        themePreference: result.user.themePreference,
      });

      // Navigate to dreams
      navigate('/dreams');
    } catch (err) {
      setAttempts((prev) => prev + 1);
      setError(err instanceof Error ? err.message : 'PIN incorrect');
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();

      // Block after too many attempts
      if (attempts >= 4) {
        setError('Trop de tentatives. Veuillez réessayer plus tard.');
      }
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
        onClick={() => navigate('/access')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Autre code</span>
      </motion.button>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-dream flex items-center justify-center">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-display font-bold text-center mb-2">
            Entrez votre PIN
          </h1>
          <p className="text-white/60 text-center mb-8">
            Saisissez votre code à 6 chiffres
          </p>

          {/* PIN Input */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={pin[index]}
                onChange={(e) => handlePinChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="pin-digit"
                disabled={isLoading || attempts >= 5}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-sm text-center mb-4"
            >
              {error}
            </motion.p>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 text-white/60">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Vérification...</span>
            </div>
          )}

          {/* Forgot PIN link */}
          <p className="text-white/40 text-sm text-center mt-8">
            PIN oublié ?{' '}
            <a
              href="mailto:support@sublym.org"
              className="text-dream-400 hover:text-dream-300 transition-colors"
            >
              Contactez le support
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
