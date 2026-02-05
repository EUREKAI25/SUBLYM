import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, Loader2 } from 'lucide-react';
import { Header } from '@/components';
import { useI18n } from '@/hooks';
import { API_ENDPOINTS } from '@/lib/config';

interface PageContent {
  slug: string;
  title: string;
  content: string;
  version: number;
  updatedAt: string;
}

function renderMarkdown(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/\n\n/gim, '</p><p class="mb-3">')
    .replace(/\n/gim, '<br/>')
    .replace(/^(.+)$/gim, '<p class="mb-3">$1</p>')
    .replace(/<p class="mb-3"><h/gim, '<h')
    .replace(/<\/h([1-3])><\/p>/gim, '</h$1>')
    .replace(/<p class="mb-3"><\/p>/gim, '');
}

export function TermsPage() {
  const { t, locale } = useI18n();
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    async function fetchTerms() {
      try {
        const res = await fetch(API_ENDPOINTS.staticPage('conditions', locale));
        if (res.ok) {
          const data = await res.json();
          setPage(data);
          setNotFound(false);
        } else {
          setNotFound(true);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchTerms();
  }, [locale]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-white">
      <Header />

      <main className="pt-24 pb-16 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
            </div>
          ) : notFound || !page ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <div className="card">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                <h1 className="font-display text-2xl text-dark mb-3">
                  {t('terms.title')}
                </h1>
                <p className="text-gray-500 mb-8">
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
              <div className="mb-4">
                <Link to="/" className="text-sm text-gray-500 hover:text-teal-600 transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="w-4 h-4" />
                  {t('terms.backToHome')}
                </Link>
              </div>

              <div className="card">
                <h1 className="font-display text-3xl sm:text-4xl text-teal-900 mb-6 text-center">
                  {page.title}
                </h1>
                <div
                  className="prose prose-gray max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content) }}
                />
                {page.version && page.updatedAt && (
                  <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100 text-center">
                    v{page.version} &mdash; {new Date(page.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
