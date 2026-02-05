import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ArrowLeft, Heart, MessageSquare, Send, Check } from 'lucide-react';
import { Header, SmileRecording } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth, fetchUpload } from '@/lib/config';

interface RunData {
  status: string;
  videoUrl?: string;
  teaserUrl?: string;
  keyframesUrls?: string[];
}

interface SmileStatus {
  available: boolean;
  hasStarted: boolean;
  status?: string;
  premiumGranted: boolean;
  premiumUntil?: string;
  premiumLevel?: number;
  premiumMonths?: number;
}

type PageState = 'loading' | 'smile-recording' | 'uploading' | 'watching' | 'error' | 'not-ready';

export function WatchPage() {
  const { traceId } = useParams<{ traceId: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [run, setRun] = useState<RunData | null>(null);
  const [smileStatus, setSmileStatus] = useState<SmileStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Comment state
  const [comment, setComment] = useState('');
  const [commentSaved, setCommentSaved] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);

  // Country-only consent checkbox
  const [excludeCountry, setExcludeCountry] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);

  useEffect(() => {
    if (!user || !traceId) {
      navigate('/login');
      return;
    }

    async function fetchData() {
      try {
        const [runRes, smileRes] = await Promise.all([
          fetchWithAuth(API_ENDPOINTS.runStatus(traceId!)),
          fetchWithAuth(API_ENDPOINTS.smileStatus),
        ]);

        if (!runRes.ok) {
          setError(t('watch.videoNotFound'));
          setPageState('error');
          return;
        }

        const runData = await runRes.json();
        setRun(runData);

        if (runData.status !== 'completed') {
          setPageState('not-ready');
          return;
        }

        // Check smile status
        if (smileRes.ok) {
          const smileData = await smileRes.json();
          setSmileStatus(smileData);

          // Show recording if user has a pending smile (not yet uploaded)
          if (smileData.hasStarted && smileData.status === 'pending') {
            setPageState('smile-recording');
            return;
          }
        }

        setPageState('watching');
      } catch {
        setError(t('watch.connectionError'));
        setPageState('error');
      }
    }

    fetchData();
  }, [user, traceId, navigate]);

  const handleSmileComplete = useCallback(async (blob: Blob) => {
    setPageState('uploading');

    try {
      const formData = new FormData();
      formData.append('video', blob, 'reaction.webm');

      const response = await fetchUpload(API_ENDPOINTS.uploadReaction, formData);

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || err.error || 'Upload failed');
      }

      // Refresh smile status
      const smileRes = await fetchWithAuth(API_ENDPOINTS.smileStatus);
      if (smileRes.ok) {
        setSmileStatus(await smileRes.json());
      }

      setPageState('watching');
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPageState('error');
    }
  }, []);

  const handleSmileSkip = useCallback(() => {
    setPageState('watching');
  }, []);

  const handleConsentChange = useCallback(async (checked: boolean) => {
    setExcludeCountry(checked);
    setConsentSaving(true);
    try {
      await fetchWithAuth(API_ENDPOINTS.smileComment, {
        method: 'POST',
        body: JSON.stringify({
          smileConsent: checked ? 'country_only' : 'worldwide',
        }),
      });
    } catch (err) {
      console.error('Consent update error:', err);
    } finally {
      setConsentSaving(false);
    }
  }, []);

  const handleCommentSubmit = useCallback(async () => {
    if (!comment.trim() || comment.trim().length < 5) return;

    setCommentSaving(true);
    try {
      const res = await fetchWithAuth(API_ENDPOINTS.smileComment, {
        method: 'POST',
        body: JSON.stringify({ comment: comment.trim() }),
      });

      if (res.ok) {
        setCommentSaved(true);
      }
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setCommentSaving(false);
    }
  }, [comment]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Back button */}
          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-teal-700 mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.back')}
          </Link>

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          )}

          {/* Not ready */}
          {pageState === 'not-ready' && (
            <div className="card text-center py-12">
              <Loader2 className="w-12 h-12 text-teal-400 mx-auto mb-4 animate-spin" />
              <h2 className="font-display text-xl text-dark mb-2">
                {t('watch.notReady')}
              </h2>
              <p className="text-gray-600">
                {t('watch.notReadyHint')}
              </p>
            </div>
          )}

          {/* Error */}
          {pageState === 'error' && (
            <div className="card text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Link to="/gallery" className="text-teal-600 hover:text-teal-800 font-medium">
                {t('common.back')}
              </Link>
            </div>
          )}

          {/* Smile Recording */}
          {pageState === 'smile-recording' && run?.videoUrl && (
            <SmileRecording
              videoUrl={run.videoUrl}
              thumbnailUrl={run.keyframesUrls && run.keyframesUrls.length > 0 ? run.keyframesUrls[run.keyframesUrls.length - 1] : undefined}
              onComplete={handleSmileComplete}
              onSkip={handleSmileSkip}
              premiumMonths={smileStatus?.premiumMonths || 3}
              premiumLevelName={smileStatus?.premiumLevel ? `Premium ${smileStatus.premiumLevel === 3 ? 'Gold' : smileStatus.premiumLevel === 2 ? 'Silver' : 'Bronze'}` : 'Premium'}
            />
          )}

          {/* Uploading */}
          {pageState === 'uploading' && (
            <div className="card text-center py-12">
              <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto mb-4" />
              <h2 className="font-display text-xl text-dark mb-2">
                {t('watch.uploadingReaction')}
              </h2>
              <p className="text-gray-600">{t('watch.uploadingHint')}</p>
            </div>
          )}

          {/* Watching */}
          {pageState === 'watching' && run?.videoUrl && (
            <div className="space-y-6">
              {/* Premium granted banner */}
              {smileStatus?.premiumGranted && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card bg-gradient-to-r from-teal-50 to-blush-50 border-teal-200"
                >
                  <div className="flex items-center gap-3">
                    <Heart className="w-6 h-6 text-teal-600 fill-teal-500" />
                    <div>
                      <p className="font-medium text-teal-800">
                        {t('watch.premiumActive')}
                      </p>
                      <p className="text-teal-600 text-sm">
                        {t('watch.premiumActiveHint')}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Video player */}
              <div className="rounded-2xl overflow-hidden bg-gray-900 shadow-xl">
                <video
                  src={run.videoUrl}
                  controls
                  autoPlay
                  className="w-full aspect-video"
                />
              </div>

              {/* Country exclusion checkbox (for Smile users) */}
              {smileStatus?.hasStarted && (
                <div className="card">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeCountry}
                      onChange={(e) => handleConsentChange(e.target.checked)}
                      disabled={consentSaving}
                      className="mt-1 accent-teal-600 w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">
                      {t('watch.excludeCountry')}
                    </span>
                  </label>
                </div>
              )}

              {/* Comment section (for Smile users) */}
              {smileStatus?.hasStarted && (
                <div className="card">
                  <h3 className="font-display text-lg text-dark mb-3 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-teal-600" />
                    {t('watch.commentTitle')}
                  </h3>
                  {commentSaved ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-5 h-5" />
                      {t('watch.commentSaved')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('watch.commentPlaceholder')}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-dark placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-200 outline-none resize-none transition-colors"
                        maxLength={1000}
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-400">
                          {comment.length}/1000
                        </span>
                        <button
                          onClick={handleCommentSubmit}
                          disabled={comment.trim().length < 5 || commentSaving}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 text-white font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {commentSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          {t('watch.commentSend')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
