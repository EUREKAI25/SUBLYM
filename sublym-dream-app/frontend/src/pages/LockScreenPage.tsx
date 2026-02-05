import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, Sparkles } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore, useSettingsStore } from '../lib/store';

export default function LockScreenPage() {
  const navigate = useNavigate();
  const { userId, unlock, logout } = useAuthStore();
  const { updateSettings } = useSettingsStore();

  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handlePinChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
    if (!userId) {
      logout();
      navigate('/access');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authApi.verifyPin(userId, enteredPin);

      // Update settings from server
      updateSettings({
        navigationMode: result.user.navigationMode,
        useDreamTheme: result.user.useDreamTheme,
        themePreference: result.user.themePreference,
      });

      unlock();
      navigate('/dreams');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN incorrect');
      setPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors
    }
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-dream flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Lock icon */}
        <div className="flex justify-center mb-8">
          <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-white/60" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-xl font-display font-bold text-center mb-2">
          Session verrouillée
        </h1>
        <p className="text-white/60 text-center mb-8 text-sm">
          Saisissez votre PIN pour continuer
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
              className="pin-digit w-10 h-12 text-xl"
              disabled={isLoading}
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
          </div>
        )}

        {/* Logout link */}
        <button
          onClick={handleLogout}
          className="w-full text-white/40 text-sm text-center mt-8 hover:text-white/60 transition-colors"
        >
          Se déconnecter
        </button>
      </motion.div>
    </div>
  );
}
