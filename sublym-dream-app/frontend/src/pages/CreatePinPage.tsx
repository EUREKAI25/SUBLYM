import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Lock, Loader2 } from 'lucide-react';
import { authApi } from '../lib/api';
import { useAuthStore, useSettingsStore } from '../lib/store';

export default function CreatePinPage() {
  const navigate = useNavigate();
  const { pendingAccessCodeId, setToken, setUserId } = useAuthStore();
  const { updateSettings } = useSettingsStore();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!pendingAccessCodeId) {
      navigate('/access');
    }
  }, [pendingAccessCodeId, navigate]);

  const handlePinChange = (index: number, value: string, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;

    const currentPin = isConfirm ? [...confirmPin] : [...pin];
    currentPin[index] = value.slice(-1);

    if (isConfirm) {
      setConfirmPin(currentPin);
    } else {
      setPin(currentPin);
    }

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if PIN is complete
    if (currentPin.every((d) => d !== '')) {
      if (!isConfirm && step === 'create') {
        setTimeout(() => {
          setStep('confirm');
          setError('');
        }, 200);
      } else if (isConfirm && step === 'confirm') {
        handleSubmit(currentPin.join(''));
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent,
    isConfirm = false
  ) => {
    if (e.key === 'Backspace') {
      const currentPin = isConfirm ? [...confirmPin] : [...pin];
      if (!currentPin[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleSubmit = async (confirmedPin: string) => {
    const originalPin = pin.join('');

    if (originalPin !== confirmedPin) {
      setError('Les PINs ne correspondent pas');
      setConfirmPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authApi.createPin(pendingAccessCodeId!, originalPin);

      // Save auth state
      setToken(result.token);
      setUserId(result.user.id);

      // Update settings from server
      updateSettings({
        navigationMode: result.user.navigationMode,
        useDreamTheme: result.user.useDreamTheme,
        themePreference: result.user.themePreference,
      });

      // Navigate to dream definition or dreams list
      navigate('/dream/define');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
      setConfirmPin(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const resetToCreate = () => {
    setStep('create');
    setPin(['', '', '', '', '', '']);
    setConfirmPin(['', '', '', '', '', '']);
    setError('');
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <div className="min-h-screen flex flex-col px-6 py-8 safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Back button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => (step === 'confirm' ? resetToCreate() : navigate('/access'))}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>{step === 'confirm' ? 'Modifier' : 'Retour'}</span>
      </motion.button>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <motion.div
          key={step}
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
            {step === 'create' ? 'Créez votre PIN' : 'Confirmez votre PIN'}
          </h1>
          <p className="text-white/60 text-center mb-8">
            {step === 'create'
              ? 'Ce code protégera l\'accès à vos rêves'
              : 'Saisissez à nouveau votre PIN'}
          </p>

          {/* PIN Input */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={`${step}-${index}`}
                ref={(el) => (inputRefs.current[index] = el)}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={currentPin[index]}
                onChange={(e) =>
                  handlePinChange(index, e.target.value, step === 'confirm')
                }
                onKeyDown={(e) => handleKeyDown(index, e, step === 'confirm')}
                className="pin-digit"
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
              <span>Création en cours...</span>
            </div>
          )}

          {/* Step indicator */}
          <div className="flex justify-center gap-2 mt-8">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                step === 'create' ? 'bg-dream-500' : 'bg-white/20'
              }`}
            />
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                step === 'confirm' ? 'bg-dream-500' : 'bg-white/20'
              }`}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
