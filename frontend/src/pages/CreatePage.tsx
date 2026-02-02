import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Sparkles, Send, Loader2, ArrowLeft, ArrowRight, Camera, Image, User, Calendar, Check, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import {
  Header,
  PhotoUploader,
  ProgressDisplay,
  CameraCapture,
  PaymentChoice,
  CreationPending,
} from '@/components';
import { useAuth, useGeneration, useI18n } from '@/hooks';
import { API_BASE_URL } from '@/lib/config';

type FlowStep = 'photos' | 'dream' | 'payment' | 'register' | 'processing' | 'pending' | 'payment-success' | 'payment-cancelled' | 'payment-error';
type PhotoMode = 'choice' | 'camera' | 'upload';
type SmileConsent = 'country_only' | 'worldwide';

interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other';
  rgpdConsent: boolean;
  marketingConsent: boolean;
}

interface StoredCreationData {
  dream: string;
  rejectText: string;
  photosBase64: { name: string; type: string; data: string }[];
  selectedPlan: string | null;
  billingPeriod: 'monthly' | 'yearly';
  timestamp: number;
}

// Helpers pour convertir File <-> Base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
};

const base64ToFile = (base64: string, filename: string, mimeType: string): File => {
  const arr = base64.split(',');
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mimeType });
};

const STORAGE_KEY = 'sublym_creation_data';

export function CreatePage() {
  const { user, token } = useAuth();
  const { t } = useI18n();
  const { status, isSubmitting, isPolling, error, generate, reset } = useGeneration();
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentProcessedRef = useRef(false);

  // Flow state
  const [step, setStep] = useState<FlowStep>('photos');
  const [photoMode, setPhotoMode] = useState<PhotoMode>('choice');
  
  // Data state
  const [dream, setDream] = useState('');
  const [rejectText, setRejectText] = useState('');
  const [photosUser, setPhotosUser] = useState<File[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [smileConsent, setSmileConsent] = useState<SmileConsent | null>(null);
  const [registerData, setRegisterData] = useState<RegisterData>({
    email: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: undefined,
    rgpdConsent: false,
    marketingConsent: false,
  });
  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  const isValid = dream.trim().length >= 20 && photosUser.length >= 1;
  const isProcessing = isSubmitting || isPolling;

  // ============================================
  // STORAGE HELPERS
  // ============================================

  const saveDataBeforeStripe = async () => {
    try {
      const photosBase64 = await Promise.all(
        photosUser.map(async (file) => ({
          name: file.name,
          type: file.type,
          data: await fileToBase64(file),
        }))
      );

      const data: StoredCreationData = {
        dream,
        rejectText,
        photosBase64,
        selectedPlan,
        billingPeriod,
        timestamp: Date.now(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('Creation data saved before Stripe redirect');
    } catch (err) {
      console.error('Error saving creation data:', err);
    }
  };

  const loadDataAfterStripe = async (): Promise<boolean> => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      const data: StoredCreationData = JSON.parse(stored);
      
      // Vérifier que les données ne sont pas trop vieilles (1 heure max)
      if (Date.now() - data.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem(STORAGE_KEY);
        return false;
      }

      // Restaurer les données
      setDream(data.dream);
      setRejectText(data.rejectText || '');
      setSelectedPlan(data.selectedPlan);
      setBillingPeriod(data.billingPeriod);

      // Convertir les photos base64 en Files
      const files = data.photosBase64.map((p) => base64ToFile(p.data, p.name, p.type));
      setPhotosUser(files);

      console.log('Creation data restored after Stripe return');
      return true;
    } catch (err) {
      console.error('Error loading creation data:', err);
      return false;
    }
  };

  const clearStoredData = () => {
    localStorage.removeItem(STORAGE_KEY);
  };

  // ============================================
  // PAYMENT RETURN HANDLER
  // ============================================

  useEffect(() => {
    const handlePaymentReturn = async () => {
      if (paymentProcessedRef.current) return;
      
      const paymentStatus = searchParams.get('payment');
      
      if (paymentStatus === 'success') {
        paymentProcessedRef.current = true;
        setStep('payment-success');
        setPaymentMessage(t('create.paymentSuccessMsg'));
        
        // Charger les données sauvegardées
        const hasData = await loadDataAfterStripe();
        
        // Nettoyer l'URL
        setSearchParams({});
        
        // Si on a les données, lancer la génération automatiquement après 2s
        if (hasData && token) {
          setTimeout(() => {
            setStep('processing');
            submitGenerationFromStorage();
          }, 2000);
        }
      } else if (paymentStatus === 'cancelled') {
        paymentProcessedRef.current = true;
        setStep('payment-cancelled');
        setPaymentMessage(t('create.paymentCancelledMsg'));
        
        // Restaurer les données pour permettre de réessayer
        await loadDataAfterStripe();
        setSearchParams({});
      }
    };

    handlePaymentReturn();
  }, [searchParams, setSearchParams, token]);

  const submitGenerationFromStorage = async () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setStep('photos');
        return;
      }

      const data: StoredCreationData = JSON.parse(stored);
      const files = data.photosBase64.map((p) => base64ToFile(p.data, p.name, p.type));

      const reject = data.rejectText
        ? data.rejectText.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;

      await generate({
        dream: data.dream,
        reject,
        photosUser: files,
        plan: data.selectedPlan || undefined,
      });
      
      clearStoredData();
      setStep('pending');
    } catch (err) {
      console.error('Generation error:', err);
      setStep('payment-error');
      setPaymentMessage(t('create.generationError'));
    }
  };

  // ============================================
  // HANDLERS
  // ============================================

  const handleCameraPhotosComplete = useCallback((photos: File[]) => {
    setPhotosUser(photos);
    setStep('dream');
  }, []);

  const handleDreamSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setStep('payment');
  }, [isValid]);

  const handleSelectPlan = useCallback((planId: string, period: 'monthly' | 'yearly') => {
    setSelectedPlan(planId);
    setBillingPeriod(period);
    setSmileConsent(null);
    
    if (user) {
      // Utilisateur existant - créer checkout Stripe directement
      createStripeCheckout(planId, period);
    } else {
      // Nouvel utilisateur - aller à l'inscription
      setStep('register');
    }
  }, [user]);

  const handleChooseSmile = useCallback((consent: SmileConsent) => {
    setSelectedPlan('smile');
    setSmileConsent(consent);
    
    if (user) {
      // Utilisateur existant avec Smile - lancer génération directement
      submitGeneration('smile', consent);
    } else {
      // Nouvel utilisateur - aller à l'inscription
      setStep('register');
    }
  }, [user]);

  const createStripeCheckout = async (planId: string, period: 'monthly' | 'yearly') => {
    const level = parseInt(planId.replace('level_', ''));
    
    try {
      // Sauvegarder les données avant la redirection
      await saveDataBeforeStripe();

      const response = await fetch(`${API_BASE_URL}/payment/create-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          level,
          period,
          successUrl: `${window.location.origin}/create?payment=success`,
          cancelUrl: `${window.location.origin}/create?payment=cancelled`,
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || t('create.paymentCreationError'));
      }
    } catch (err: any) {
      console.error('Stripe checkout error:', err);
      setRegisterError(err.message);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError('');
    setIsRegistering(true);

    try {
      if (selectedPlan === 'smile' && smileConsent) {
        // Inscription + Smile
        const response = await fetch(`${API_BASE_URL}/auth/register-and-smile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...registerData,
            smileConsent,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || t('create.registrationError'));
        }

        // Stocker le token et lancer la génération
        localStorage.setItem('auth_token', data.accessToken);
        await submitGeneration('smile', smileConsent);
        
      } else if (selectedPlan) {
        // Sauvegarder les données avant la redirection Stripe
        await saveDataBeforeStripe();

        // Inscription + Stripe checkout
        const level = parseInt(selectedPlan.replace('level_', ''));
        
        const response = await fetch(`${API_BASE_URL}/auth/register-and-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...registerData,
            planLevel: level,
            billingPeriod,
            successUrl: `${window.location.origin}/create?payment=success`,
            cancelUrl: `${window.location.origin}/create?payment=cancelled`,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || t('create.registrationError'));
        }

        // Stocker le token et rediriger vers Stripe
        localStorage.setItem('auth_token', data.accessToken);
        
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        }
      }
    } catch (err: any) {
      console.error('Register error:', err);
      setRegisterError(err.message);
    } finally {
      setIsRegistering(false);
    }
  };

  const parseReject = (text: string): string[] =>
    text.split(',').map(s => s.trim()).filter(Boolean);

  const submitGeneration = useCallback(async (plan?: string, consent?: SmileConsent) => {
    try {
      setStep('processing');
      await generate({
        dream,
        reject: parseReject(rejectText),
        photosUser,
        plan: plan || selectedPlan || undefined,
        smileConsent: consent || smileConsent || undefined,
      });
      setStep('pending');
    } catch (err) {
      console.error('Generation error:', err);
      setStep('payment');
    }
  }, [dream, rejectText, photosUser, selectedPlan, smileConsent, generate]);

  const handleNewCreation = useCallback(() => {
    reset();
    clearStoredData();
    paymentProcessedRef.current = false;
    setStep('photos');
    setPhotoMode('choice');
    setDream('');
    setRejectText('');
    setPhotosUser([]);
    setSelectedPlan(null);
    setSmileConsent(null);
    setPaymentMessage('');
  }, [reset]);

  const handleRetryPayment = useCallback(() => {
    setStep('payment');
    setPaymentMessage('');
  }, []);

  // ============================================
  // RENDER
  // ============================================

  if (isProcessing && status) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <ProgressDisplay status={status} error={error} onRetry={handleNewCreation} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {/* STEP: PHOTOS */}
            {step === 'photos' && (
              <motion.div key="photos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-wine-100 text-wine-700 text-sm font-medium mb-6">
                    <Sparkles className="w-4 h-4" />
                    {t('create.badge')}
                  </div>
                  <h1 className="font-display text-3xl sm:text-4xl text-charcoal-900 mb-4">{t('create.photoStepTitle')}</h1>
                  <p className="text-charcoal-600 max-w-lg mx-auto">{t('create.photoStepSubtitle')}</p>
                </div>

                {photoMode === 'choice' && (
                  <div className="card">
                    <h2 className="font-display text-xl text-charcoal-800 text-center mb-6">
                      {t('create.howToAddPhotos')}
                    </h2>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <button
                        onClick={() => setPhotoMode('camera')}
                        className="group relative p-6 rounded-2xl border-2 border-wine-200 bg-gradient-to-br from-wine-50 to-blush-50 hover:border-wine-400 hover:shadow-lg transition-all text-left"
                      >
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-wine-600 text-white text-xs font-medium">
                          {t('common.recommended')}
                        </div>
                        <div className="w-14 h-14 rounded-full bg-wine-100 flex items-center justify-center mb-4 group-hover:bg-wine-200 transition-colors">
                          <Camera className="w-7 h-7 text-wine-600" />
                        </div>
                        <h3 className="font-display text-lg text-charcoal-900 mb-2">
                          {t('create.takePhotos')}
                        </h3>
                        <p className="text-sm text-charcoal-600">
                          {t('create.takePhotosDesc')}
                        </p>
                      </button>

                      <button
                        onClick={() => setPhotoMode('upload')}
                        className="group p-6 rounded-2xl border-2 border-charcoal-200 hover:border-wine-300 hover:shadow-lg transition-all text-left"
                      >
                        <div className="w-14 h-14 rounded-full bg-charcoal-100 flex items-center justify-center mb-4 group-hover:bg-wine-100 transition-colors">
                          <Image className="w-7 h-7 text-charcoal-600 group-hover:text-wine-600 transition-colors" />
                        </div>
                        <h3 className="font-display text-lg text-charcoal-900 mb-2">
                          {t('create.importPhotos')}
                        </h3>
                        <p className="text-sm text-charcoal-600">
                          {t('create.selectPhotosDesc')}
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {photoMode === 'camera' && (
                  <div className="card">
                    <button
                      onClick={() => setPhotoMode('choice')}
                      className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('common.back')}
                    </button>
                    <CameraCapture
                      onPhotosComplete={handleCameraPhotosComplete}
                      onSwitchToUpload={() => setPhotoMode('upload')}
                    />
                  </div>
                )}

                {photoMode === 'upload' && (
                  <div className="card">
                    <button
                      onClick={() => setPhotoMode('choice')}
                      className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('common.back')}
                    </button>
                    <div className="space-y-6">
                      <PhotoUploader
                        label={t('create.photosYouLabel')}
                        description={t('create.photosYouHelp')}
                        photos={photosUser}
                        onChange={setPhotosUser}
                        max={5}
                        required
                        type="character"
                      />
                      {photosUser.length > 0 && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                          <button
                            onClick={() => setStep('dream')}
                            className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                          >
                            {t('common.next')}
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </motion.div>
                      )}
                      
                      <div className="text-center pt-4 border-t border-charcoal-100">
                        <button
                          onClick={() => setPhotoMode('camera')}
                          className="text-wine-600 hover:text-wine-800 text-sm font-medium inline-flex items-center gap-2"
                        >
                          <Camera className="w-4 h-4" />
                          {t('create.takePhotosWithCamera')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* STEP: DREAM */}
            {step === 'dream' && (
              <motion.div key="dream" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto">
                <button onClick={() => setStep('photos')} className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 mb-6">
                  <ArrowLeft className="w-4 h-4" />
                  {t('common.back')}
                </button>
                <div className="text-center mb-10">
                  <h1 className="font-display text-3xl sm:text-4xl text-charcoal-900 mb-4">{t('create.dreamStepTitle')}</h1>
                  <p className="text-charcoal-600 max-w-lg mx-auto">{t('create.dreamStepSubtitle')}</p>
                </div>
                <form onSubmit={handleDreamSubmit} className="space-y-6">
                  <div className="card">
                    <label className="flex items-center gap-2 font-display text-lg text-charcoal-800 mb-3">
                      <Heart className="w-5 h-5 text-wine-600 fill-wine-200" />
                      {t('create.dreamLabel')}
                      <span className="text-wine-500">*</span>
                    </label>
                    <p className="text-sm text-charcoal-500 mb-4">{t('create.dreamHelp')}</p>
                    <textarea
                      value={dream}
                      onChange={(e) => setDream(e.target.value)}
                      placeholder={t('create.dreamPlaceholder')}
                      rows={5}
                      className="input-romantic resize-none"
                      minLength={20}
                    />
                    <div className="flex justify-between mt-2 text-sm">
                      <span className={dream.length < 20 ? 'text-wine-500' : 'text-charcoal-400'}>
                        {t('common.minCharacters', { count: '20' })}
                      </span>
                      <span className="text-charcoal-400">{dream.length} {t('common.characters')}</span>
                    </div>
                  </div>

                  <div className="card">
                    <label className="block font-display text-lg text-charcoal-800 mb-2">
                      {t('create.rejectLabel')}
                    </label>
                    <p className="text-sm text-charcoal-500 mb-3">
                      {t('create.rejectHelp')}
                    </p>
                    <input
                      type="text"
                      value={rejectText}
                      onChange={(e) => setRejectText(e.target.value)}
                      placeholder={t('create.rejectPlaceholder')}
                      className="input-romantic"
                    />
                  </div>
                  
                  {error && (
                    <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700">{error}</div>
                  )}
                  
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={!isValid}
                      className="btn-primary flex items-center gap-3 px-8 py-4"
                    >
                      <Send className="w-5 h-5" />
                      {t('create.submitButton')}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* STEP: PAYMENT CHOICE */}
            {step === 'payment' && (
              <motion.div key="payment" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <button onClick={() => setStep('dream')} className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 mb-6">
                  <ArrowLeft className="w-4 h-4" />
                  {t('common.back')}
                </button>
                <PaymentChoice 
                  onSelectPlan={handleSelectPlan} 
                  onChooseSmile={handleChooseSmile} 
                />
              </motion.div>
            )}

            {/* STEP: REGISTER (nouveaux utilisateurs) */}
            {step === 'register' && (
              <motion.div key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <RegisterForm
                  data={registerData}
                  onChange={setRegisterData}
                  onSubmit={handleRegisterSubmit}
                  onBack={() => setStep('payment')}
                  isLoading={isRegistering}
                  error={registerError}
                  selectedPlan={selectedPlan}
                  isSmile={selectedPlan === 'smile'}
                />
              </motion.div>
            )}

            {/* STEP: PROCESSING */}
            {step === 'processing' && (
              <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                <Loader2 className="w-12 h-12 text-wine-600 animate-spin mx-auto mb-4" />
                <h2 className="font-display text-2xl text-charcoal-900 mb-2">{t('create.preparingVisualization')}</h2>
                <p className="text-charcoal-600">{t('create.takesAFewMoments')}</p>
              </motion.div>
            )}

            {/* STEP: PENDING */}
            {step === 'pending' && (
              <motion.div key="pending" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CreationPending email={registerData.email || user?.email || ''} traceId={status?.runId} onCreateAnother={handleNewCreation} />
              </motion.div>
            )}

            {/* STEP: PAYMENT SUCCESS */}
            {step === 'payment-success' && (
              <motion.div key="payment-success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
                <div className="card text-center">
                  <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="font-display text-2xl text-charcoal-900 mb-3">
                    {t('create.paymentValidated')}
                  </h2>
                  <p className="text-charcoal-600 mb-2">
                    {paymentMessage}
                  </p>
                  <p className="text-charcoal-500 text-sm mb-6">
                    {t('create.subscriptionActive')}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-wine-600">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t('create.preparing')}</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP: PAYMENT CANCELLED */}
            {step === 'payment-cancelled' && (
              <motion.div key="payment-cancelled" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
                <div className="card text-center">
                  <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-6">
                    <XCircle className="w-10 h-10 text-orange-600" />
                  </div>
                  <h2 className="font-display text-2xl text-charcoal-900 mb-3">
                    {t('create.paymentCancelled')}
                  </h2>
                  <p className="text-charcoal-600 mb-6">
                    {paymentMessage || t('create.paymentCancelledMsg')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleRetryPayment}
                      className="btn-primary inline-flex items-center justify-center gap-2"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('create.choosePlan')}
                    </button>
                    <button
                      onClick={handleNewCreation}
                      className="btn-secondary inline-flex items-center justify-center gap-2"
                    >
                      {t('create.startOver')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP: PAYMENT ERROR */}
            {step === 'payment-error' && (
              <motion.div key="payment-error" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
                <div className="card text-center">
                  <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h2 className="font-display text-2xl text-charcoal-900 mb-3">
                    {t('create.paymentDeclined')}
                  </h2>
                  <p className="text-charcoal-600 mb-6">
                    {paymentMessage || t('create.paymentErrorMsg')}
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={handleRetryPayment}
                      className="btn-primary inline-flex items-center justify-center gap-2"
                    >
                      {t('common.retry')}
                    </button>
                    <button
                      onClick={handleNewCreation}
                      className="btn-secondary inline-flex items-center justify-center gap-2"
                    >
                      {t('create.startOver')}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

// ============================================
// REGISTER FORM COMPONENT
// ============================================

interface RegisterFormProps {
  data: RegisterData;
  onChange: (data: RegisterData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onBack: () => void;
  isLoading: boolean;
  error: string;
  selectedPlan: string | null;
  isSmile: boolean;
}

function RegisterForm({ data, onChange, onSubmit, onBack, isLoading, error, selectedPlan, isSmile }: RegisterFormProps) {
  const { t } = useI18n();

  const updateField = (field: keyof RegisterData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const isFormValid = 
    data.email && 
    data.firstName && 
    data.lastName && 
    data.rgpdConsent &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);

  const getPlanLabel = () => {
    if (isSmile) return t('create.smileOptionFree');
    if (selectedPlan?.startsWith('level_')) {
      const level = selectedPlan.replace('level_', '');
      const names: Record<string, string> = { '1': t('plans.discovery'), '2': t('plans.essential'), '3': t('plans.premium') };
      return names[level] || `${t('plans.level')} ${level}`;
    }
    return selectedPlan;
  };

  return (
    <div className="max-w-lg mx-auto">
      <button onClick={onBack} className="flex items-center gap-2 text-charcoal-600 hover:text-wine-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </button>

      <div className="card">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-romantic flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-2xl text-charcoal-900 mb-2">
            {t('create.createAccount')}
          </h2>
          <p className="text-charcoal-600">
            {t('create.toAccessVisualizations')}
          </p>
          {selectedPlan && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-wine-100 text-wine-700 text-sm font-medium">
              <Check className="w-4 h-4" />
              {getPlanLabel()}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
              {t('form.email')} <span className="text-wine-500">*</span>
            </label>
            <input
              type="email"
              value={data.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="votre@email.com"
              className="input-romantic"
              required
            />
          </div>

          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                {t('form.firstName')} <span className="text-wine-500">*</span>
              </label>
              <input
                type="text"
                value={data.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                placeholder="Marie"
                className="input-romantic"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                {t('form.lastName')} <span className="text-wine-500">*</span>
              </label>
              <input
                type="text"
                value={data.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                placeholder="Dupont"
                className="input-romantic"
                required
              />
            </div>
          </div>

          {/* Date de naissance */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
              {t('form.birthDate')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-400" />
              <input
                type="date"
                value={data.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="input-romantic pl-10"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
              {t('form.gender')} <span className="text-charcoal-400 text-xs">({t('form.optional')})</span>
            </label>
            <div className="flex gap-3">
              {[
                { value: 'female', label: t('form.female') },
                { value: 'male', label: t('form.male') },
                { value: 'other', label: t('form.other') },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField('gender', option.value as any)}
                  className={`flex-1 py-2.5 px-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    data.gender === option.value
                      ? 'border-wine-500 bg-wine-50 text-wine-700'
                      : 'border-charcoal-200 text-charcoal-600 hover:border-wine-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Consentements */}
          <div className="space-y-3 pt-4 border-t border-charcoal-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.rgpdConsent}
                onChange={(e) => updateField('rgpdConsent', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-charcoal-300 text-wine-600 focus:ring-wine-500"
                required
              />
              <span className="text-sm text-charcoal-600">
                {t('form.acceptTermsPre')}<a href="/terms" className="text-wine-600 underline" target="_blank">{t('form.termsOfService')}</a>{t('form.acceptTermsMid')}<a href="/privacy" className="text-wine-600 underline" target="_blank">{t('form.privacyPolicy')}</a> <span className="text-wine-500">*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.marketingConsent}
                onChange={(e) => updateField('marketingConsent', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-charcoal-300 text-wine-600 focus:ring-wine-500"
              />
              <span className="text-sm text-charcoal-600">
                {t('form.marketingConsent')}
              </span>
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="btn-primary w-full py-4 flex items-center justify-center gap-2 mt-6"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {isSmile ? t('create.creatingAccount') : t('create.redirectingToPayment')}
              </>
            ) : (
              <>
                {isSmile ? t('create.createAccount') : t('create.proceedToPayment')}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
