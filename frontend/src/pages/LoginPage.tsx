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
  const [devLoginUrl, setDevLoginUrl] = useState('');
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
      if (result.devLoginUrl) {
        setDevLoginUrl(result.devLoginUrl);
      }
    } else {
      setError(result.error || t('common.error'));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-teal-100 rounded-full opacity-30 blur-3xl" />
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
          className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-800 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('common.back')}
        </Link>

        <div className="card">
          {/* Logo */}
          <div className="flex justify-center mb-16">
            <Logo size="xl" />
          </div>

          {/* Step: Email input */}
          {step === 'email' && (
            <>
              <h1 className="font-display text-2xl text-center text-gray-900 mb-2">
                {t('login.title')}
              </h1>
              <p className="text-center text-gray-600 mb-8">
                {t('login.subtitle')}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className="input-romantic with-icon-left"
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

            </>
          )}

          {/* Step: Email sent */}
          {step === 'sent' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-50 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-teal-600" />
              </div>
              <h2 className="font-display text-2xl text-gray-900 mb-4">
                {t('login.emailSentTitle')}
              </h2>
              <p
                className="text-gray-600 mb-6"
                dangerouslySetInnerHTML={{
                  __html: t('login.emailSentMessage', { email }),
                }}
              />
              {devLoginUrl && (
                <a
                  href={devLoginUrl}
                  className="block mb-4 px-4 py-3 bg-blush-100 border border-blush-300 rounded-lg text-sm text-gray-700 hover:bg-blush-200 transition-colors"
                >
                  [DEV] Cliquez ici pour vous connecter
                </a>
              )}
              <button
                onClick={() => setStep('email')}
                className="text-teal-600 hover:text-teal-800 font-medium underline underline-offset-4"
              >
                {t('login.useAnotherEmail')}
              </button>
            </div>
          )}

          {/* Step: Verifying */}
          {step === 'verifying' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
              <h2 className="font-display text-xl text-gray-900">
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
              <h2 className="font-display text-2xl text-gray-900 mb-4">
                {t('login.invalidLink')}
              </h2>
              <p className="text-gray-600 mb-6">{error}</p>
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
        <p className="text-center text-sm text-gray-500 mt-6">
          {t('login.noPassword')}
        </p>
      </motion.div>
    </div>
  );
}
