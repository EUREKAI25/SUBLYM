import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Download, ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components';
import { useI18n } from '@/hooks';
import { API_ENDPOINTS } from '@/lib/config';

interface LegalDoc {
  type: string;
  version: string;
  filename: string;
  createdAt: string;
  downloadUrl: string;
}

export function TermsPage() {
  const { t } = useI18n();
  const [doc, setDoc] = useState<LegalDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchTerms();
  }, []);

  async function fetchTerms() {
    try {
      const res = await fetch(API_ENDPOINTS.legalDocument('terms'));
      if (res.ok) {
        const data = await res.json();
        setDoc(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-white">
      <Header />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-wine-500" />
            </div>
          ) : notFound || !doc ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="card">
                <FileText className="w-16 h-16 text-charcoal-300 mx-auto mb-6" />
                <h1 className="font-display text-2xl text-charcoal-800 mb-3">
                  {t('terms.title')}
                </h1>
                <p className="text-charcoal-500 mb-8">
                  {t('terms.comingSoon')}
                </p>
                <Link to="/" className="btn-primary inline-flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  {t('terms.backToHome')}
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
                  {t('terms.title')}
                </h1>
                <p className="text-charcoal-500 text-sm">
                  {t('terms.version', { version: doc.version })} &mdash; {t('terms.publishedOn', { date: formatDate(doc.createdAt) })}
                </p>
              </div>

              <div className="card">
                {/* PDF embed */}
                <div className="w-full aspect-[3/4] rounded-lg overflow-hidden border border-charcoal-200 mb-6">
                  <iframe
                    src={API_ENDPOINTS.legalDocumentDownload('terms')}
                    className="w-full h-full"
                    title={t('terms.title')}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Link to="/" className="text-sm text-charcoal-500 hover:text-wine-600 transition-colors inline-flex items-center gap-1">
                    <ArrowLeft className="w-4 h-4" />
                    {t('terms.backToHome')}
                  </Link>
                  <a
                    href={API_ENDPOINTS.legalDocumentDownload('terms')}
                    download
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t('terms.download')}
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
