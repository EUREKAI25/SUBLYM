import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Heart, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Logo } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { validateEmail } from '@/lib/utils';

type Step = 'email' | 'sent' | 'verifying' | 'error';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<Step>('email');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const verifyingRef = useRef(false);

  const { user, requestMagicLink, verifyToken } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      navigate('/create');
    }
  }, [user, navigate]);

  useEffect(() => {
    const token = searchParams.get('token');
    if (token && !verifyingRef.current) {
      verifyingRef.current = true;
      setStep('verifying');
      verifyToken(token).then((success) => {
        if (success) {
          navigate('/create');
        } else {
          setStep('error');
          setError(t('login.invalidLinkMessage'));
        }
      });
    }
  }, [searchParams, verifyToken, navigate, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      setError(t('login.invalidEmail'));
      return;
    }

    setIsLoading(true);
    setError('');

    const result = await requestMagicLink(email);

    setIsLoading(false);

    if (result.success) {
      setStep('sent');
    } else {
      setError(result.error || t('common.error'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-wine-100 rounded-full opacity-30 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blush-100 rounded-full opacity-40 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-wine-600 hover:text-wine-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Link>

        <div className="card">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Logo size="md" />
          </div>

          {/* Step: Email input */}
          {step === 'email' && (
            <>
              <h1 className="font-display text-2xl text-center text-charcoal-900 mb-2">
                {t('login.title')}
              </h1>
              <p className="text-center text-charcoal-600 mb-8">
                {t('login.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-2">
                    {t('login.emailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-charcoal-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className="input-romantic pl-12"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t('login.sending')}
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4 fill-white" />
                      {t('login.submitButton')}
                    </>
                  )}
                </button>
              </form>

              {/* Lien "J'ai déjà un compte" */}
              <p className="text-center text-sm text-charcoal-600 mt-6">
                {t('login.alreadyHaveAccount')}{' '}
                <button
                  type="button"
                  onClick={() => document.querySelector('input[type="email"]')?.focus()}
                  className="text-wine-600 hover:text-wine-800 font-medium underline underline-offset-4"
                >
                  {t('login.loginHere')}
                </button>
              </p>
            </>
          )}

          {/* Step: Email sent */}
          {step === 'sent' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="font-display text-2xl text-charcoal-900 mb-4">
                {t('login.emailSentTitle')}
              </h2>
              <p
                className="text-charcoal-600 mb-6"
                dangerouslySetInnerHTML={{
                  __html: t('login.emailSentMessage', { email }),
                }}
              />
              <button
                onClick={() => setStep('email')}
                className="text-wine-600 hover:text-wine-800 font-medium underline underline-offset-4"
              >
                {t('login.useAnotherEmail')}
              </button>
            </div>
          )}

          {/* Step: Verifying */}
          {step === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-wine-500 animate-spin mx-auto mb-4" />
              <h2 className="font-display text-xl text-charcoal-900">
                {t('login.verifying')}
              </h2>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="font-display text-2xl text-charcoal-900 mb-4">
                {t('login.invalidLink')}
              </h2>
              <p className="text-charcoal-600 mb-6">{error}</p>
              <button
                onClick={() => {
                  setStep('email');
                  setError('');
                  verifyingRef.current = false;
                }}
                className="btn-primary"
              >
                {t('common.retry')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-charcoal-500 mt-6">
          {t('login.noPassword')}
        </p>
      </motion.div>
    </div>
  );
}
