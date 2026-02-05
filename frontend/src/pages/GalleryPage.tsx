import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Plus, Play, Image as ImageIcon, Loader2, Calendar, Video, Eye } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

type Tab = 'dreams' | 'runs' | 'photos';
const SEEN_RUNS_KEY = 'sublym_seen_runs';

interface Dream {
  id: number;
  description: string;
  style: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
}

interface Run {
  id: number;
  dreamId: number;
  traceId: string;
  status: string;
  progress: number;
  videoUrl: string | null;
  teaserUrl: string | null;
  keyframesUrls: string[];
  createdAt: string;
  completedAt: string | null;
  dream?: Dream;
}

interface GeneratedPhoto {
  id: string;
  url: string;
  runId: number;
  createdAt: string;
}

export function GalleryPage() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dreams');
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [generatedPhotos, setGeneratedPhotos] = useState<GeneratedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [dreamsRes, runsRes] = await Promise.all([
          fetchWithAuth(API_ENDPOINTS.dreams),
          fetchWithAuth(API_ENDPOINTS.runs),
        ]);

        if (dreamsRes.ok) {
          const data = await dreamsRes.json();
          // Filter out drafts and failed
          const filteredDreams = (data.dreams || []).filter(
            (d: Dream) => d.status !== 'draft' && d.status !== 'failed'
          );
          setDreams(filteredDreams);
        }
        if (runsRes.ok) {
          const data = await runsRes.json();
          const runsData = data.runs || [];
          // Filter out failed runs
          const filteredRuns = runsData.filter((r: Run) => r.status !== 'failed');
          setRuns(filteredRuns);

          // Extract generated photos from keyframes
          const photos: GeneratedPhoto[] = [];
          runsData.forEach((run: Run) => {
            if (run.keyframesUrls && run.keyframesUrls.length > 0) {
              run.keyframesUrls.forEach((url, idx) => {
                photos.push({
                  id: `${run.id}-${idx}`,
                  url,
                  runId: run.id,
                  createdAt: run.createdAt,
                });
              });
            }
          });
          setGeneratedPhotos(photos);

          // Mark completed runs as seen
          const completedIds = runsData.filter((r: Run) => r.status === 'completed').map((r: Run) => r.id);
          if (completedIds.length > 0) {
            const existing = JSON.parse(localStorage.getItem(SEEN_RUNS_KEY) || '[]');
            const merged = [...new Set([...existing, ...completedIds])];
            localStorage.setItem(SEEN_RUNS_KEY, JSON.stringify(merged));
          }
        }
      } catch (err) {
        console.error('Error fetching gallery data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: t('gallery.statusPending'),
      processing: t('gallery.statusProcessing'),
      completed: t('gallery.statusCompleted'),
      failed: t('gallery.statusFailed'),
      cancelled: t('gallery.statusCancelled'),
      draft: t('gallery.statusDraft'),
      ready: t('gallery.statusReady'),
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-blush-100 text-gray-600',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-teal-100 text-teal-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      draft: 'bg-gray-100 text-gray-700',
      ready: 'bg-teal-100 text-teal-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'dreams', label: t('gallery.tabDreams'), icon: <Heart className="w-4 h-4" />, count: dreams.length },
    { key: 'runs', label: t('gallery.tabVideos'), icon: <Video className="w-4 h-4" />, count: runs.length },
    { key: 'photos', label: t('gallery.tabPhotos'), icon: <ImageIcon className="w-4 h-4" />, count: generatedPhotos.length },
  ];

  if (!user) return null;

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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl text-dark mb-2">
                {t('gallery.title')}
              </h1>
              <p className="text-dark/70">{t('gallery.subtitle')}</p>
            </div>
            <Link to="/create" className="btn-primary flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              {t('gallery.newCreation')}
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full font-medium whitespace-nowrap transition-all text-sm ${
                  activeTab === tab.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-teal-50 hover:text-teal-700'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-teal-500 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'dreams' && (
                <div className="space-y-6">
                  {dreams.length === 0 ? (
                    <EmptyState
                      icon={<Heart className="w-12 h-12 text-teal-300" />}
                      title={t('gallery.emptyDreams')}
                      description={t('gallery.emptyDreamsDesc')}
                      action={<Link to="/create" className="btn-primary">{t('gallery.createDream')}</Link>}
                    />
                  ) : (
                    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                      {dreams.map((dream, index) => (
                        <motion.div
                          key={dream.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="card"
                        >
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(dream.status)}`}>
                              {dream.status === 'processing'
                                ? (() => {
                                    const associatedRun = runs.find(r => r.dreamId === dream.id && r.status === 'processing');
                                    return associatedRun
                                      ? `${getStatusLabel(dream.status)} ${associatedRun.progress}%`
                                      : getStatusLabel(dream.status);
                                  })()
                                : getStatusLabel(dream.status)}
                            </div>
                            {dream.isActive && (
                              <span className="text-xs text-teal-600 font-medium">{t('gallery.active')}</span>
                            )}
                          </div>
                          <p className="text-dark line-clamp-3 mb-4">{dream.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-dark/60">
                              <Calendar className="w-4 h-4" />
                              {formatDate(dream.createdAt)}
                            </div>
                            {dream.style && (
                              <span className="text-xs text-dark/40">{dream.style}</span>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'runs' && (
                <div className="space-y-6">
                  {runs.length === 0 ? (
                    <EmptyState
                      icon={<Video className="w-12 h-12 text-teal-300" />}
                      title={t('gallery.emptyVideos')}
                      description={t('gallery.emptyVideosDesc')}
                    />
                  ) : (
                    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                      {runs.map((run, index) => {
                        const isClickable = run.traceId && run.status === 'completed';
                        const isProcessing = run.status === 'processing' || run.status === 'pending';
                        // Use last keyframe (end keyframe) as thumbnail
                        const thumbnailUrl = run.keyframesUrls && run.keyframesUrls.length > 0
                          ? run.keyframesUrls[run.keyframesUrls.length - 1]
                          : null;
                        // Dream title (truncated)
                        const dreamTitle = run.dream?.description
                          ? run.dream.description.length > 60
                            ? run.dream.description.slice(0, 60) + '...'
                            : run.dream.description
                          : null;

                        const ThumbnailWrapper = isClickable ? Link : 'div';
                        const thumbnailProps = isClickable ? { to: `/watch/${run.traceId}` } : {};

                        return (
                          <motion.div
                            key={run.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="card group"
                          >
                            <ThumbnailWrapper
                              {...thumbnailProps}
                              className={`relative aspect-video rounded-xl overflow-hidden bg-gray-100 mb-4 block ${isClickable ? 'cursor-pointer' : ''}`}
                            >
                              {thumbnailUrl ? (
                                <img
                                  src={thumbnailUrl}
                                  alt=""
                                  className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${isProcessing ? 'blur-sm' : 'blur-md'}`}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  {isProcessing ? (
                                    <Loader2 className="w-12 h-12 text-teal-500 animate-spin" />
                                  ) : (
                                    <Play className="w-12 h-12 text-gray-300" />
                                  )}
                                </div>
                              )}
                              {/* Play icon overlay for completed videos */}
                              {isClickable && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-teal-600 ml-1" />
                                  </div>
                                </div>
                              )}
                              <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                                {isProcessing
                                  ? `${getStatusLabel(run.status)} ${run.progress}%`
                                  : getStatusLabel(run.status)}
                              </div>
                              {isProcessing && (
                                <div className="absolute bottom-3 left-3 right-3">
                                  <div className="bg-black/50 rounded-full h-2">
                                    <div
                                      className="bg-teal-500 h-2 rounded-full transition-all"
                                      style={{ width: `${run.progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </ThumbnailWrapper>

                            {/* Dream title - clickable */}
                            {dreamTitle && (
                              isClickable ? (
                                <Link
                                  to={`/watch/${run.traceId}`}
                                  className="block text-sm text-dark/80 hover:text-teal-700 mb-2 line-clamp-2 transition-colors"
                                >
                                  {dreamTitle}
                                </Link>
                              ) : (
                                <p className="text-sm text-dark/60 mb-2 line-clamp-2">{dreamTitle}</p>
                              )
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-sm text-dark/60">
                                <Calendar className="w-4 h-4" />
                                {formatDate(run.createdAt)}
                              </div>
                              {isClickable && (
                                <Link
                                  to={`/watch/${run.traceId}`}
                                  className="flex items-center gap-1 text-sm text-teal-600 hover:text-teal-800"
                                >
                                  <Eye className="w-4 h-4" />
                                  {t('gallery.view')}
                                </Link>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'photos' && (
                <div>
                  {generatedPhotos.length === 0 ? (
                    <EmptyState
                      icon={<ImageIcon className="w-12 h-12 text-teal-300" />}
                      title={t('gallery.emptyPhotos')}
                      description={t('gallery.emptyPhotosDesc')}
                    />
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-4">
                      {generatedPhotos.map((photo, index) => (
                        <motion.div
                          key={photo.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="relative aspect-square rounded-xl overflow-hidden group"
                        >
                          <img
                            src={photo.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
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

function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card text-center py-12 sm:py-16">
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-50 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-serif text-xl text-dark mb-2">{title}</h3>
      <p className="text-dark/70 mb-6">{description}</p>
      {action}
    </div>
  );
}
