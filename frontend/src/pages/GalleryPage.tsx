import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Plus, Play, Image as ImageIcon, Loader2, Trash2, Calendar, Video, Eye } from 'lucide-react';
import { Header } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { API_ENDPOINTS, fetchWithAuth } from '@/lib/config';

type Tab = 'dreams' | 'runs' | 'photos';

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

interface Photo {
  id: number;
  filename: string;
  path: string;
  type: string;
  characterName: string | null;
  order: number;
  createdAt: string;
}

export function GalleryPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dreams');
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [dreamsRes, runsRes, photosRes] = await Promise.all([
          fetchWithAuth(API_ENDPOINTS.dreams),
          fetchWithAuth(API_ENDPOINTS.runs),
          fetchWithAuth(API_ENDPOINTS.photos),
        ]);
        
        if (dreamsRes.ok) {
          const data = await dreamsRes.json();
          setDreams(data.dreams || []);
        }
        if (runsRes.ok) {
          const data = await runsRes.json();
          setRuns(data.runs || []);
        }
        if (photosRes.ok) {
          const data = await photosRes.json();
          setPhotos(data.photos || []);
        }
      } catch (err) {
        console.error('Error fetching gallery data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    if (user) fetchData();
  }, [user]);

  const deletePhoto = async (photoId: number) => {
    if (!confirm('Supprimer cette photo ?')) return;
    
    try {
      const response = await fetchWithAuth(API_ENDPOINTS.photo(photoId.toString()), {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setPhotos(prev => prev.filter(p => p.id !== photoId));
      }
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'En attente',
      processing: 'En cours',
      completed: 'Terminé',
      failed: 'Échoué',
      cancelled: 'Annulé',
      draft: 'Brouillon',
      ready: 'Prêt',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      processing: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      draft: 'bg-gray-100 text-gray-700',
      ready: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'dreams', label: 'Mes rêves', icon: <Heart className="w-4 h-4" />, count: dreams.length },
    { key: 'runs', label: 'Mes vidéos', icon: <Video className="w-4 h-4" />, count: runs.length },
    { key: 'photos', label: 'Mes photos', icon: <ImageIcon className="w-4 h-4" />, count: photos.length },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <Header />

      <main className="pt-24 sm:pt-28 pb-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl text-charcoal-900 mb-2">
                Ma galerie
              </h1>
              <p className="text-charcoal-600">Retrouvez toutes vos créations</p>
            </div>
            <Link to="/create" className="btn-primary flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle création
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
                    ? 'bg-wine-600 text-white'
                    : 'bg-white text-charcoal-600 hover:bg-wine-50 hover:text-wine-700'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-charcoal-100 text-charcoal-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-wine-500 animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'dreams' && (
                <div className="space-y-6">
                  {dreams.length === 0 ? (
                    <EmptyState
                      icon={<Heart className="w-12 h-12 text-wine-300" />}
                      title="Aucun rêve créé"
                      description="Commencez par créer votre premier rêve"
                      action={<Link to="/create" className="btn-primary">Créer un rêve</Link>}
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
                              {getStatusLabel(dream.status)}
                            </div>
                            {dream.isActive && (
                              <span className="text-xs text-green-600 font-medium">Actif</span>
                            )}
                          </div>
                          <p className="text-charcoal-800 line-clamp-3 mb-4">{dream.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-charcoal-500">
                              <Calendar className="w-4 h-4" />
                              {formatDate(dream.createdAt)}
                            </div>
                            {dream.style && (
                              <span className="text-xs text-charcoal-400">{dream.style}</span>
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
                      icon={<Video className="w-12 h-12 text-wine-300" />}
                      title="Aucune vidéo générée"
                      description="Vos vidéos apparaîtront ici après génération"
                    />
                  ) : (
                    <div className="grid gap-4 sm:gap-6 sm:grid-cols-2">
                      {runs.map((run, index) => (
                        <motion.div
                          key={run.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="card group"
                        >
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-charcoal-100 mb-4">
                            {run.keyframesUrls && run.keyframesUrls.length > 0 ? (
                              <img
                                src={run.keyframesUrls[0]}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Play className="w-12 h-12 text-charcoal-300" />
                              </div>
                            )}
                            <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}>
                              {getStatusLabel(run.status)}
                            </div>
                            {run.status === 'processing' && (
                              <div className="absolute bottom-3 left-3 right-3">
                                <div className="bg-black/50 rounded-full h-2">
                                  <div 
                                    className="bg-wine-500 h-2 rounded-full transition-all"
                                    style={{ width: `${run.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-charcoal-500">
                              <Calendar className="w-4 h-4" />
                              {formatDate(run.createdAt)}
                            </div>
                            {run.traceId && run.status === 'completed' && (
                              <Link
                                to={`/watch/${run.traceId}`}
                                className="flex items-center gap-1 text-sm text-wine-600 hover:text-wine-800"
                              >
                                <Eye className="w-4 h-4" />
                                Voir
                              </Link>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'photos' && (
                <div>
                  {photos.length === 0 ? (
                    <EmptyState
                      icon={<ImageIcon className="w-12 h-12 text-wine-300" />}
                      title="Aucune photo"
                      description="Vos photos apparaîtront ici"
                    />
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-4">
                      {photos.map((photo, index) => (
                        <motion.div
                          key={photo.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.05 }}
                          className="relative aspect-square rounded-xl overflow-hidden group"
                        >
                          <img 
                            src={`/storage/${photo.path}`} 
                            alt={photo.filename} 
                            className="w-full h-full object-cover" 
                          />
                          {photo.characterName && (
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                              <p className="text-white text-xs truncate">{photo.characterName}</p>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={() => deletePhoto(photo.id)}
                              className="p-2 bg-white/90 rounded-full text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
      <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-wine-50 flex items-center justify-center">
        {icon}
      </div>
      <h3 className="font-display text-xl text-charcoal-800 mb-2">{title}</h3>
      <p className="text-charcoal-600 mb-6">{description}</p>
      {action}
    </div>
  );
}
