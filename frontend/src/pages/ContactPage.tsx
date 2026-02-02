import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Send, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components';
import { useI18n } from '@/hooks';
import { API_ENDPOINTS } from '@/lib/config';

export function ContactPage() {
  const { t } = useI18n();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const res = await fetch(API_ENDPOINTS.contact, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setStatus('success');
      } else if (res.status === 429) {
        setErrorMessage(t('contact.rateLimitError'));
        setStatus('error');
      } else {
        setErrorMessage(t('contact.error'));
        setStatus('error');
      }
    } catch {
      setErrorMessage(t('contact.error'));
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-white">
      <Header />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-xl mx-auto">

          {status === 'success' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="card bg-gradient-to-br from-wine-50 to-blush-50 border-wine-100">
                <CheckCircle className="w-16 h-16 text-wine-500 mx-auto mb-6" />
                <h1 className="font-display text-2xl text-wine-900 mb-3">
                  {t('contact.successTitle')}
                </h1>
                <p className="text-wine-700 mb-8">
                  {t('contact.successMessage')}
                </p>
                <Link to="/" className="btn-primary inline-flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t('contact.backToHome')}
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="text-center mb-8">
                <h1 className="font-display text-3xl sm:text-4xl text-wine-900 mb-3">
                  {t('contact.title')}
                </h1>
                <p className="text-charcoal-600">
                  {t('contact.subtitle')}
                </p>
              </div>

              <div className="card">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-charcoal-700 mb-1">
                      {t('contact.nameLabel')}
                    </label>
                    <input
                      id="name"
                      name="name"
                      type="text"
                      value={form.name}
                      onChange={handleChange}
                      placeholder={t('contact.namePlaceholder')}
                      className="input-romantic w-full"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-charcoal-700 mb-1">
                      {t('contact.emailLabel')} *
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder={t('contact.emailPlaceholder')}
                      className="input-romantic w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="subject" className="block text-sm font-medium text-charcoal-700 mb-1">
                      {t('contact.subjectLabel')}
                    </label>
                    <input
                      id="subject"
                      name="subject"
                      type="text"
                      value={form.subject}
                      onChange={handleChange}
                      placeholder={t('contact.subjectPlaceholder')}
                      className="input-romantic w-full"
                      maxLength={200}
                    />
                  </div>

                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-charcoal-700 mb-1">
                      {t('contact.messageLabel')} *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={6}
                      value={form.message}
                      onChange={handleChange}
                      placeholder={t('contact.messagePlaceholder')}
                      className="input-romantic w-full resize-none"
                    />
                  </div>

                  {status === 'error' && errorMessage && (
                    <p className="text-red-600 text-sm">{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === 'sending'}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {t('contact.sending')}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {t('contact.submitButton')}
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
