import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Heart, Check, Crown, Zap, Star, Gift, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/config';
import { useI18n } from '@/hooks';

interface PricingLevel {
  level: number;
  name: string;
  description: string;
  features: {
    photosMin: number;
    photosMax: number;
    keyframesCount: number;
    videoEnabled: boolean;
    scenesCount: number;
    generationsPerMonth: number;
    subliminalEnabled: boolean;
  };
  price: {
    monthly: number;
    yearly: number;
    currency: string;
  };
  badgeText?: string;
}

interface SmileStatus {
  available: boolean;
  premiumLevel: number;
  premiumMonths: number;
  remaining: number;
  reason?: string;
}

type SmileConsent = 'country_only' | 'worldwide';

interface PaymentChoiceProps {
  onSelectPlan: (planId: string, billingPeriod: 'monthly' | 'yearly') => void;
  onChooseSmile: (consent: SmileConsent) => void;
}

const PLAN_ICONS: Record<number, React.ReactNode> = {
  0: <Heart className="w-6 h-6" />,
  1: <Star className="w-6 h-6" />,
  2: <Zap className="w-6 h-6" />,
  3: <Crown className="w-6 h-6" />,
};

export function PaymentChoice({
  onSelectPlan,
  onChooseSmile,
}: PaymentChoiceProps) {
  const { t } = useI18n();
  const [pricingLevels, setPricingLevels] = useState<PricingLevel[]>([]);
  const [smileStatus, setSmileStatus] = useState<SmileStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedPlan, setSelectedPlan] = useState<number | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [smileConsent] = useState<SmileConsent>('worldwide');

  // Charger les données depuis l'API
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Charger pricing et smile status en parallèle
        const [pricingRes, smileRes] = await Promise.all([
          fetch(`${API_BASE_URL}/config/pricing?lang=fr`),
          fetch(`${API_BASE_URL}/smile/status`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
            },
          }).catch(() => null), // Smile peut échouer si pas connecté
        ]);

        if (!pricingRes.ok) {
          throw new Error('Erreur lors du chargement des tarifs');
        }

        const pricingData = await pricingRes.json();
        setPricingLevels(pricingData.levels || []);

        if (smileRes && smileRes.ok) {
          const smileData = await smileRes.json();
          setSmileStatus(smileData);
        } else {
          // Smile non disponible (pas connecté ou erreur)
          setSmileStatus({ available: false, premiumLevel: 3, premiumMonths: 3, remaining: 0 });
        }
      } catch (err: any) {
        console.error('Error loading pricing:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  const handleSelectPlan = (level: number) => {
    setSelectedPlan(level);
  };

  const handleConfirmPlan = () => {
    if (selectedPlan !== null) {
      onSelectPlan(`level_${selectedPlan}`, billingPeriod);
    }
  };

  const handleConfirmSmile = () => {
    onChooseSmile(smileConsent);
  };

  // Trouver le nom du niveau premium pour Smile
  const premiumLevelName = pricingLevels.find(l => l.level === smileStatus?.premiumLevel)?.name || 'Premium';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-wine-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary">
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Title */}
      <div className="text-center">
        <h2 className="font-display text-2xl sm:text-3xl text-charcoal-900 mb-3">
          {t('pricing.title')}
        </h2>
        <p className="text-charcoal-600 max-w-md mx-auto">
          {t('pricing.selectSubtitle')}
        </p>
      </div>

      {/* ============================================ */}
      {/* SMILE OFFER - Compact */}
      {/* ============================================ */}
      {smileStatus && smileStatus.available !== false && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl bg-gradient-to-r from-wine-600 to-blush-500 p-5 sm:p-6"
        >
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-display text-lg text-white">
                  <span dangerouslySetInnerHTML={{ __html: t('pricing.smileTitle', { months: smileStatus.premiumMonths.toString(), level: premiumLevelName }) }} />
                </h3>
                <p className="text-white/80 text-sm mt-1">
                  {t('pricing.smileDescription')}
                </p>
              </div>
            </div>
            <button
              onClick={handleConfirmSmile}
              className="w-full sm:w-auto py-3 px-6 bg-white text-wine-700 font-bold rounded-xl hover:bg-white/90 transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Gift className="w-4 h-4" />
              {t('pricing.chooseSmile')}
            </button>
          </div>
        </motion.div>
      )}

      {/* Separator */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-charcoal-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-charcoal-500">{t('pricing.orChoosePlan')}</span>
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 p-1 bg-charcoal-100 rounded-full">
          <button
            onClick={() => setBillingPeriod('monthly')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              billingPeriod === 'monthly'
                ? "bg-white text-wine-700 shadow-sm"
                : "text-charcoal-600 hover:text-charcoal-800"
            )}
          >
            {t('pricing.monthly')}
          </button>
          <button
            onClick={() => setBillingPeriod('yearly')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              billingPeriod === 'yearly'
                ? "bg-white text-wine-700 shadow-sm"
                : "text-charcoal-600 hover:text-charcoal-800"
            )}
          >
            {t('pricing.yearly')}
            <span className="ml-1 text-xs text-green-600 font-bold">{t('pricing.yearlyDiscount')}</span>
          </button>
        </div>
      </div>

      {/* ============================================ */}
      {/* PRICING PLANS */}
      {/* ============================================ */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {pricingLevels.map((plan) => {
          const price = billingPeriod === 'monthly' ? plan.price.monthly : plan.price.yearly / 12;
          const isPopular = plan.badgeText?.toLowerCase().includes('populaire');
          
          return (
            <motion.button
              key={plan.level}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectPlan(plan.level)}
              className={cn(
                'relative p-5 rounded-2xl border-2 text-left transition-all flex flex-col',
                selectedPlan === plan.level
                  ? 'border-wine-500 bg-wine-50 ring-2 ring-wine-200'
                  : 'border-charcoal-200 bg-white hover:border-wine-300',
                isPopular && 'ring-2 ring-wine-400'
              )}
            >
              {/* Badge */}
              {plan.badgeText && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-wine-600 text-white text-xs font-bold rounded-full whitespace-nowrap">
                  {plan.badgeText}
                </div>
              )}

              {/* Selected indicator */}
              {selectedPlan === plan.level && (
                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-wine-600 flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Icon */}
              <div className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center mb-3',
                isPopular
                  ? 'bg-gradient-romantic text-white'
                  : 'bg-wine-100 text-wine-600'
              )}>
                {PLAN_ICONS[plan.level] || <Star className="w-6 h-6" />}
              </div>

              {/* Name & Description */}
              <h3 className="font-display text-lg text-charcoal-800 mb-1">
                {plan.name}
              </h3>
              <p className="text-sm text-charcoal-500 mb-3 line-clamp-2">
                {plan.description}
              </p>

              {/* Price */}
              <div className="mb-4">
                <span className="text-2xl font-bold text-wine-700">
                  {price.toFixed(2)}€
                </span>
                <span className="text-charcoal-500 text-sm">{t('pricing.perMonth')}</span>
                {billingPeriod === 'yearly' && (
                  <span className="block text-xs text-charcoal-400">
                    {t('pricing.billedYearly', { amount: `${plan.price.yearly.toFixed(2)}€` })}
                  </span>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2 flex-1 text-sm">
                <li className="flex items-center gap-2 text-charcoal-700">
                  <Check className="w-4 h-4 text-wine-500 shrink-0" />
                  {plan.features.generationsPerMonth === -1
                    ? t('pricing.features.unlimitedGenerations')
                    : t('pricing.features.generations', { count: plan.features.generationsPerMonth })
                  }
                </li>
                <li className="flex items-center gap-2 text-charcoal-700">
                  <Check className="w-4 h-4 text-wine-500 shrink-0" />
                  {t('pricing.scenesPerVideo', { count: plan.features.scenesCount })}
                </li>
                <li className="flex items-center gap-2 text-charcoal-700">
                  <Check className="w-4 h-4 text-wine-500 shrink-0" />
                  {t('pricing.upToPhotos', { count: plan.features.photosMax })}
                </li>
                {plan.features.subliminalEnabled && (
                  <li className="flex items-center gap-2 text-charcoal-700">
                    <Check className="w-4 h-4 text-wine-500 shrink-0" />
                    {t('pricing.features.subliminal')}
                  </li>
                )}
              </ul>
            </motion.button>
          );
        })}
      </div>

      {/* CTA for selected plan */}
      {selectedPlan !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center"
        >
          <button
            onClick={handleConfirmPlan}
            className="btn-primary py-4 px-8 text-lg flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5" />
            {t('pricing.continueWith', { name: pricingLevels.find(p => p.level === selectedPlan)?.name || '' })}
          </button>
        </motion.div>
      )}

      {/* Trust badges */}
      <div className="flex flex-wrap justify-center gap-6 text-sm text-charcoal-500 pt-4">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          {t('pricing.securePayment')}
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          {t('pricing.anytimeCancellation')}
        </div>
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          {t('pricing.moneyBackGuarantee')}
        </div>
      </div>
    </div>
  );
}
