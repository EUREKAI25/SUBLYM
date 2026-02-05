import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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
import { API_BASE_URL, API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

type FlowStep = 'photos' | 'dream' | 'payment' | 'register' | 'processing' | 'pending' | 'payment-success' | 'payment-cancelled' | 'payment-error';
type PhotoMode = 'choice' | 'camera' | 'upload';
type SmileConsent = 'country_only' | 'worldwide';

interface RegisterData {
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender?: 'male' | 'female' | 'other';
  country: string;
  rgpdConsent: boolean;
  marketingConsent: boolean;
}

interface StoredCreationData {
  dream: string;
  rejectText: string;
  photosBase64: { name: string; type: string; data: string }[];
  selectedPlan: string | null;
  billingPeriod: 'monthly' | 'yearly';
  useExistingPhotos?: boolean;
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

  // Existing user photos (from profile)
  const [existingPhotos, setExistingPhotos] = useState<{ id: string; path: string; verified: boolean }[]>([]);
  const [useExisting, setUseExisting] = useState(false);
  const [registerData, setRegisterData] = useState<RegisterData>({
    email: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    gender: undefined,
    country: '',
    rgpdConsent: false,
    marketingConsent: false,
  });

  // Auto-detect country from browser locale
  useEffect(() => {
    const detectCountry = () => {
      const lang = navigator.language || 'fr';
      const parts = lang.split('-');
      // If format is 'fr-FR', take the country part
      if (parts.length > 1) return parts[1].toUpperCase();
      // Otherwise map language to most common country
      const langToCountry: Record<string, string> = {
        fr: 'FR', en: 'GB', de: 'DE', es: 'ES', it: 'IT',
        pt: 'PT', nl: 'NL', pl: 'PL', sv: 'SE', da: 'DK',
        fi: 'FI', no: 'NO', ja: 'JP', ko: 'KR', zh: 'CN',
      };
      return langToCountry[parts[0]] || 'FR';
    };
    if (!registerData.country) {
      setRegisterData(prev => ({ ...prev, country: detectCountry() }));
    }
  }, []);

  const [registerError, setRegisterError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');

  // Pricing config: dynamic photo limits from backend
  const [pricingLimits, setPricingLimits] = useState({ photosMin: 3, photosMax: 10 });

  useEffect(() => {
    fetch(`${API_BASE_URL}/config/pricing`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.levels?.length) {
          const levels = data.levels as Array<{ features: { photosMin: number; photosMax: number } }>;
          const minPhotos = Math.min(...levels.map(l => l.features.photosMin));
          const maxPhotos = Math.max(...levels.map(l => l.features.photosMax));
          setPricingLimits({
            photosMin: minPhotos > 0 ? minPhotos : 1,
            photosMax: maxPhotos > 0 ? maxPhotos : 10,
          });
        }
      })
      .catch(() => {}); // fallback to defaults
  }, []);

  // Fetch existing user photos when logged in
  useEffect(() => {
    if (token) {
      fetchWithAuth(API_ENDPOINTS.photos)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.photos) setExistingPhotos(data.photos);
        })
        .catch(() => {});
    }
  }, [token]);

  const verifiedExistingCount = existingPhotos.filter(p => p.verified).length;
  const hasEnoughExisting = verifiedExistingCount >= pricingLimits.photosMin;
  const hasEnoughPhotos = useExisting ? hasEnoughExisting : photosUser.length >= pricingLimits.photosMin;
  const isValid = dream.trim().length >= 20 && hasEnoughPhotos;
  const isProcessing = isSubmitting || isPolling;

  // ============================================
  // STORAGE HELPERS
  // ============================================

  const saveDataBeforeStripe = async () => {
    try {
      const photosBase64 = useExisting ? [] : await Promise.all(
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
        useExistingPhotos: useExisting,
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
      setUseExisting(data.useExistingPhotos || false);

      // Convertir les photos base64 en Files (sauf si on utilise les photos existantes)
      if (!data.useExistingPhotos && data.photosBase64.length > 0) {
        const files = data.photosBase64.map((p) => base64ToFile(p.data, p.name, p.type));
        setPhotosUser(files);
      }

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
      const sessionId = searchParams.get('session_id');

      if (paymentStatus === 'success') {
        paymentProcessedRef.current = true;
        setStep('payment-success');
        setPaymentMessage(t('create.paymentSuccessMsg'));

        // Charger les données sauvegardées
        const hasData = await loadDataAfterStripe();

        // Nettoyer l'URL
        setSearchParams({});

        // Si on a les données, lancer la génération automatiquement après 2s
        if (hasData && token && sessionId) {
          setTimeout(async () => {
            try {
              // Activer l'abonnement manuellement (fallback si webhook pas arrivé)
              const completeRes = await fetchWithAuth(`${API_BASE_URL}/payment/complete-checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId }),
              });

              if (!completeRes.ok) {
                const errData = await completeRes.json();
                console.error('Complete checkout error:', errData);
                setStep('payment-error');
                setPaymentMessage(errData.error || t('create.subscriptionActivationError'));
                return;
              }

              // Abonnement activé, lancer la génération
              setStep('processing');
              await submitGenerationFromStorage();
            } catch (err) {
              console.error('Payment completion error:', err);
              setStep('payment-error');
              setPaymentMessage(t('create.subscriptionActivationError'));
            }
          }, 2000);
        } else if (hasData && token) {
          // Pas de sessionId (ancien lien ou erreur), tenter quand même
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
      const isExisting = data.useExistingPhotos || false;
      const files = isExisting ? [] : data.photosBase64.map((p) => base64ToFile(p.data, p.name, p.type));

      const reject = data.rejectText
        ? data.rejectText.split(',').map((s: string) => s.trim()).filter(Boolean)
        : undefined;

      await generate({
        dream: data.dream,
        reject,
        photosUser: isExisting ? undefined : files,
        useExistingPhotos: isExisting,
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
    if (photos.length >= pricingLimits.photosMin) {
      setStep('dream');
    } else {
      // Not enough photos from camera, switch to upload to add more
      setPhotoMode('upload');
    }
  }, [pricingLimits.photosMin]);

  const handleDreamSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setStep('payment');
  }, [isValid]);

  const parseReject = (text: string): string[] =>
    text.split(',').map(s => s.trim()).filter(Boolean);

  const submitGeneration = useCallback(async (plan?: string, consent?: SmileConsent) => {
    const effectivePlan = plan || selectedPlan || undefined;
    console.log('[CREATE] submitGeneration called:', { plan: effectivePlan, consent: consent || smileConsent, dream: dream.substring(0, 30), photosCount: photosUser.length, useExisting, user: !!user });
    try {
      setStep('processing');
      await generate({
        dream,
        reject: parseReject(rejectText),
        photosUser: useExisting ? undefined : photosUser,
        useExistingPhotos: useExisting,
        plan: effectivePlan,
        smileConsent: consent || smileConsent || undefined,
      });
      console.log('[CREATE] Generation started successfully');
      setStep('pending');
    } catch (err) {
      console.error('[CREATE] Generation error:', err);
      setStep('payment');
    }
  }, [dream, rejectText, photosUser, useExisting, selectedPlan, smileConsent, generate, user]);

  const handleSelectPlan = useCallback((planId: string, period: 'monthly' | 'yearly') => {
    console.log('[CREATE] handleSelectPlan:', { planId, period, user: !!user });
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
    console.log('[CREATE] handleChooseSmile:', { consent, user: !!user, dream: dream.substring(0, 30) });
    setSelectedPlan('smile');
    setSmileConsent(consent);

    if (user) {
      // Utilisateur existant avec Smile - lancer génération directement
      console.log('[CREATE] User exists, calling submitGeneration(smile)');
      submitGeneration('smile', consent);
    } else {
      // Nouvel utilisateur - aller à l'inscription
      console.log('[CREATE] No user, going to register step');
      setStep('register');
    }
  }, [user, submitGeneration, dream]);

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
          successUrl: `${window.location.origin}/create?payment=success&session_id={CHECKOUT_SESSION_ID}`,
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
            successUrl: `${window.location.origin}/create?payment=success&session_id={CHECKOUT_SESSION_ID}`,
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

  const handleNewCreation = useCallback(() => {
    reset();
    clearStoredData();
    paymentProcessedRef.current = false;
    setStep('photos');
    setPhotoMode('choice');
    setDream('');
    setRejectText('');
    setPhotosUser([]);
    setUseExisting(false);
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
        {/* Video Background */}
        <div className="video-background">
          <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
            <source src="/background.mp4" type="video/mp4" />
          </video>
        </div>
        <Header />
        <div className="h-[85px] sm:h-[100px]" />
        <main className="relative bg-white/90 min-h-screen pt-12 sm:pt-16 pb-16 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <ProgressDisplay status={status} error={error} onRetry={handleNewCreation} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Video Background */}
      <div className="video-background">
        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover">
          <source src="/background.mp4" type="video/mp4" />
        </video>
      </div>
      <Header />
      {/* Spacer - shows video through gap */}
      <div className="h-[85px] sm:h-[100px]" />
      {/* White content area */}
      <main className="relative bg-white/90 min-h-screen pt-12 sm:pt-16 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {/* STEP: PHOTOS */}
            {step === 'photos' && (
              <motion.div key="photos" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-6">
                    <Sparkles className="w-4 h-4" />
                    {t('create.badge')}
                  </div>
                  <h1 className="font-serif text-3xl sm:text-4xl text-dark mb-4">{t('create.photoStepTitle')}</h1>
                  <p className="text-gray-600 max-w-lg mx-auto">{t('create.photoStepSubtitle')}</p>
                  <p className="text-gray-500 text-sm mt-2">{t('create.photosRequired', { min: pricingLimits.photosMin, max: pricingLimits.photosMax })}</p>
                </div>

                {/* Webcam recommendation */}
                <div className="mb-6 p-4 rounded-xl bg-teal-50 border border-teal-200 text-sm text-teal-800 flex items-start gap-3">
                  <Camera className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{t('create.webcamRecommended')}</p>
                    <p className="text-teal-700 mt-1">{t('create.webcamRecommendedDesc')}</p>
                  </div>
                </div>

                {photoMode === 'choice' && (
                  <div className="card">
                    <h2 className="font-serif text-xl text-dark text-center mb-6">
                      {t('create.howToAddPhotos')}
                    </h2>

                    <div className={`grid gap-4 ${token && hasEnoughExisting ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                      {/* Option: Use existing profile photos */}
                      {token && hasEnoughExisting && (
                        <button
                          onClick={() => { setUseExisting(true); setStep('dream'); }}
                          className="group relative p-6 rounded-2xl border-2 border-gray-200 hover:border-teal-300 hover:shadow-lg transition-all text-left"
                        >
                          <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
                            <CheckCircle className="w-7 h-7 text-teal-600" />
                          </div>
                          <h3 className="font-display text-lg text-dark mb-2">
                            {t('create.useExistingPhotos')}
                          </h3>
                          <p className="text-sm text-gray-600 mb-3">
                            {t('create.existingPhotosDesc')}
                          </p>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 text-xs font-medium">
                            <Check className="w-3 h-3" />
                            {t('create.existingPhotosCount', { count: verifiedExistingCount })}
                          </span>
                        </button>
                      )}

                      <button
                        onClick={() => { setUseExisting(false); setPhotoMode('camera'); }}
                        className="group relative p-6 rounded-2xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-blush-50 hover:border-teal-400 hover:shadow-lg transition-all text-left"
                      >
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-teal-600 text-white text-xs font-medium">
                          {t('common.recommended')}
                        </div>
                        <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mb-4 group-hover:bg-teal-200 transition-colors">
                          <Camera className="w-7 h-7 text-teal-600" />
                        </div>
                        <h3 className="font-display text-lg text-dark mb-2">
                          {t('create.takePhotos')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {t('create.takePhotosDesc')}
                        </p>
                      </button>

                      <button
                        onClick={() => { setUseExisting(false); setPhotoMode('upload'); }}
                        className="group p-6 rounded-2xl border-2 border-gray-200 hover:border-teal-300 hover:shadow-lg transition-all text-left"
                      >
                        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4 group-hover:bg-teal-100 transition-colors">
                          <Image className="w-7 h-7 text-gray-600 group-hover:text-teal-600 transition-colors" />
                        </div>
                        <h3 className="font-display text-lg text-dark mb-2">
                          {t('create.importPhotos')}
                        </h3>
                        <p className="text-sm text-gray-600">
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
                      className="flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-4"
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
                      className="flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-4"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('common.back')}
                    </button>
                    <div className="space-y-6">
                      <PhotoUploader
                        label=""
                        photos={photosUser}
                        onChange={setPhotosUser}
                        max={pricingLimits.photosMax}
                        min={pricingLimits.photosMin}
                        type="character"
                      />
                      {photosUser.length > 0 && photosUser.length < pricingLimits.photosMin && (
                        <p className="text-center text-teal-600 text-sm">
                          {t('create.photosMinRequired', { count: pricingLimits.photosMin })} ({photosUser.length}/{pricingLimits.photosMin})
                        </p>
                      )}
                      {photosUser.length >= pricingLimits.photosMin && (
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
                      
                      <div className="text-center pt-4 border-t border-gray-100">
                        <button
                          onClick={() => setPhotoMode('camera')}
                          className="text-teal-600 hover:text-teal-800 text-sm font-medium inline-flex items-center gap-2"
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
                <button onClick={() => setStep('photos')} className="flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-6">
                  <ArrowLeft className="w-4 h-4" />
                  {t('common.back')}
                </button>
                <div className="text-center mb-10">
                  <h1 className="font-display text-3xl sm:text-4xl text-dark mb-4">{t('create.dreamStepTitle')}</h1>
                  <p className="text-gray-600 max-w-lg mx-auto">{t('create.dreamStepSubtitle')}</p>
                </div>
                <form onSubmit={handleDreamSubmit} className="space-y-6">
                  <div className="card">
                    <label className="flex items-center gap-2 font-display text-lg text-dark mb-3">
                      <Heart className="w-5 h-5 text-teal-600 fill-teal-200" />
                      {t('create.dreamLabel')}
                      <span className="text-teal-500">*</span>
                    </label>
                    <p className="text-sm text-gray-500 mb-4">{t('create.dreamHelp')}</p>
                    <textarea
                      value={dream}
                      onChange={(e) => setDream(e.target.value)}
                      placeholder={t('create.dreamPlaceholder')}
                      rows={5}
                      className="input-romantic resize-none"
                      minLength={20}
                    />
                    <div className="flex justify-between mt-2 text-sm">
                      <span className={dream.length < 20 ? 'text-teal-500' : 'text-gray-400'}>
                        {t('common.minCharacters', { count: '20' })}
                      </span>
                      <span className="text-gray-400">{dream.length} {t('common.characters')}</span>
                    </div>
                  </div>

                  <div className="card">
                    <label className="block font-display text-lg text-dark mb-2">
                      {t('create.rejectLabel')}
                    </label>
                    <p className="text-sm text-gray-500 mb-3">
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
                  
                  <div className="flex flex-col items-end gap-2">
                    {dream.trim().length > 0 && dream.trim().length < 20 && (
                      <p className="text-teal-500 text-sm">{t('common.minCharacters', { count: '20' })} ({dream.trim().length}/20)</p>
                    )}
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
                <button onClick={() => setStep('dream')} className="flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-6">
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
                {/* Message about creation time */}
                <div className="max-w-md mx-auto mb-8 p-4 rounded-xl bg-teal-50 border border-teal-200">
                  <p className="text-teal-800 text-sm">
                    {t('create.creationTimeInfo')}
                  </p>
                </div>

                <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto mb-6" />

                <h2 className="font-display text-xl text-dark mb-6">
                  {status?.currentStep
                    ? `${t(`create.steps.${status.currentStep}`) || status.currentStep} ${status?.progress || 0}%`
                    : t('create.preparingVisualization')}
                </h2>

                {/* Progress bar */}
                <div className="max-w-sm mx-auto">
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-teal-500 to-teal-600"
                      initial={{ width: 0 }}
                      animate={{ width: `${status?.progress || 0}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <p className="text-gray-500 text-sm mt-4">{t('create.takesAFewMoments')}</p>
              </motion.div>
            )}

            {/* STEP: PENDING */}
            {step === 'pending' && (
              <motion.div key="pending" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <CreationPending email={registerData.email || user?.email || ''} onCreateAnother={handleNewCreation} />
              </motion.div>
            )}

            {/* STEP: PAYMENT SUCCESS */}
            {step === 'payment-success' && (
              <motion.div key="payment-success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-lg mx-auto">
                <div className="card text-center">
                  <div className="w-20 h-20 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-teal-600" />
                  </div>
                  <h2 className="font-display text-2xl text-dark mb-3">
                    {t('create.paymentValidated')}
                  </h2>
                  <p className="text-gray-600 mb-2">
                    {paymentMessage}
                  </p>
                  <p className="text-gray-500 text-sm mb-6">
                    {t('create.subscriptionActive')}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-teal-600">
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
                  <h2 className="font-display text-2xl text-dark mb-3">
                    {t('create.paymentCancelled')}
                  </h2>
                  <p className="text-gray-600 mb-6">
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
                  <h2 className="font-display text-2xl text-dark mb-3">
                    {t('create.paymentDeclined')}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {paymentMessage || t('create.paymentErrorMsg')}
                  </p>
                  <button
                    onClick={handleRetryPayment}
                    className="btn-primary inline-flex items-center justify-center gap-2"
                  >
                    {t('common.retry')}
                  </button>
                  <p className="text-sm text-gray-500 mt-4">
                    <button
                      onClick={handleNewCreation}
                      className="text-teal-600 hover:text-teal-800 underline"
                    >
                      {t('create.createNewVisualization')}
                    </button>
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-8 px-4 sm:px-6" style={{ background: 'rgba(3, 40, 36, 0.9)' }}>
        <div className="max-w-5xl mx-auto text-center space-y-3">
          <div className="flex justify-center gap-6 text-sm">
            <Link to="/contact" className="text-white/60 hover:text-white transition-colors">
              {t('contact.title')}
            </Link>
            <Link to="/terms" className="text-white/60 hover:text-white transition-colors">
              {t('terms.title')}
            </Link>
          </div>
          <p className="text-white/30" style={{ fontSize: '0.75rem' }}>
            {t('landing.copyright', { year: new Date().getFullYear().toString() })}
          </p>
        </div>
      </footer>
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
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-6">
        <ArrowLeft className="w-4 h-4" />
        {t('common.back')}
      </button>

      <div className="card">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-gradient-teal flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-white" />
          </div>
          <h2 className="font-display text-2xl text-dark mb-2">
            {t('create.createAccount')}
          </h2>
          <p className="text-gray-600">
            {t('create.toAccessVisualizations')}
          </p>
          {selectedPlan && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 text-sm font-medium">
              <Check className="w-4 h-4" />
              {getPlanLabel()}
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('form.email')} <span className="text-teal-500">*</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('form.firstName')} <span className="text-teal-500">*</span>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('form.lastName')} <span className="text-teal-500">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('form.birthDate')}
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="date"
                value={data.birthDate}
                onChange={(e) => updateField('birthDate', e.target.value)}
                className="input-romantic with-icon-left"
                max={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>

          {/* Genre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('form.gender')} <span className="text-gray-400 text-xs">({t('form.optional')})</span>
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
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-600 hover:border-teal-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pays */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('form.country')} <span className="text-gray-400 text-xs">({t('form.optional')})</span>
            </label>
            <select
              value={data.country}
              onChange={(e) => updateField('country', e.target.value)}
              className="input-romantic"
            >
              <option value="">--</option>
              <option value="FR">🇫🇷 France</option>
              <option value="DE">🇩🇪 Deutschland</option>
              <option value="ES">🇪🇸 España</option>
              <option value="IT">🇮🇹 Italia</option>
              <option value="GB">🇬🇧 United Kingdom</option>
              <option value="BE">🇧🇪 Belgique</option>
              <option value="CH">🇨🇭 Suisse</option>
              <option value="LU">🇱🇺 Luxembourg</option>
              <option value="AT">🇦🇹 Österreich</option>
              <option value="NL">🇳🇱 Nederland</option>
              <option value="PT">🇵🇹 Portugal</option>
              <option value="US">🇺🇸 United States</option>
              <option value="CA">🇨🇦 Canada</option>
            </select>
          </div>

          {/* Consentements */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.rgpdConsent}
                onChange={(e) => updateField('rgpdConsent', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                required
              />
              <span className="text-sm text-gray-600">
                {t('form.acceptTermsPre')}<a href="/terms" className="text-teal-600 underline" target="_blank">{t('form.termsOfService')}</a>{t('form.acceptTermsMid')}<a href="/privacy" className="text-teal-600 underline" target="_blank">{t('form.privacyPolicy')}</a> <span className="text-teal-500">*</span>
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={data.marketingConsent}
                onChange={(e) => updateField('marketingConsent', e.target.checked)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm text-gray-600">
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

          {/* Lien "J'ai deja un compte" */}
          <p className="text-center text-sm text-gray-600 mt-6">
            {t('login.alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-teal-600 hover:text-teal-800 font-medium underline underline-offset-4">
              {t('login.loginHere')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
