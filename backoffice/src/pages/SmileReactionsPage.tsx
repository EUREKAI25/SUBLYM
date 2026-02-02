import { useState, useEffect } from 'react';
import { Play, Download, Star, Loader2, CheckCircle, Clock, XCircle, MessageSquare, ShieldX } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface SmileReaction {
  id: number;
  userId: number;
  videoPath: string | null;
  videoSize: number | null;
  comment: string | null;
  commentedAt: string | null;
  status: string;
  premiumLevel: number | null;
  premiumGranted: boolean;
  premiumUntil: string | null;
  uploadedAt: string | null;
  grantedAt: string | null;
  createdAt: string;
  user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface SmileConfig {
  id: number;
  country: string;
  threshold: number;
  currentCount: number;
  premiumLevel: number;
  premiumMonths: number;
  isActive: boolean;
}

export function SmileReactionsPage() {
  const { token } = useAuth();
  const [reactions, setReactions] = useState<SmileReaction[]>([]);
  const [configs, setConfigs] = useState<SmileConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'uploaded' | 'rejected'>('all');
  const [playingId, setPlayingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    if (!token) return;

    try {
      setLoading(true);

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [reactionsRes, configsRes] = await Promise.all([
        fetch(`${API_URL}/admin/smile-reactions`, { headers }),
        fetch(`${API_URL}/admin/smile-configs`, { headers }),
      ]);

      if (reactionsRes.ok) {
        const data = await reactionsRes.json();
        setReactions(data.reactions || []);
      }

      if (configsRes.ok) {
        const data = await configsRes.json();
        setConfigs(data.configs || []);
      }
    } catch (err) {
      console.error('Error fetching smile data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(reactionId: number) {
    if (!token) return;
    const reason = prompt('Raison de la révocation (optionnel) :');
    if (reason === null) return; // cancelled

    try {
      const res = await fetch(`${API_URL}/admin/smile-reactions/${reactionId}/revoke`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: reason || undefined }),
      });

      if (res.ok) {
        await fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Erreur lors de la révocation');
      }
    } catch (err) {
      console.error('Error revoking:', err);
      alert('Erreur lors de la révocation');
    }
  }

  const filteredReactions = filter === 'all'
    ? reactions
    : reactions.filter(r => r.status === filter);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
            <Clock className="w-3 h-3" /> En attente
          </span>
        );
      case 'uploaded':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" /> Uploadé + Premium
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" /> Révoqué
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Réactions Smile</h1>
          <p className="text-gray-600 mt-1">Vidéos de réaction des utilisateurs (avec consentement)</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{reactions.length} réactions</span>
        </div>
      </div>

      {/* Smile Config Status */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuration Smile</h2>
        {configs.length === 0 ? (
          <p className="text-gray-500">Aucune configuration</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {configs.map((config) => (
              <div key={config.id} className="p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">
                    {config.country === 'ALL' ? 'Global' : config.country}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    config.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {config.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {config.currentCount} / {config.threshold}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${Math.min((config.currentCount / config.threshold) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Niveau {config.premiumLevel} pendant {config.premiumMonths} mois
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'Toutes' },
          { key: 'pending', label: 'En attente' },
          { key: 'uploaded', label: 'Uploadées' },
          { key: 'rejected', label: 'Révoquées' },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key as typeof filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {filteredReactions.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          Aucune réaction Smile {filter !== 'all' ? 'dans cette catégorie' : 'pour le moment'}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReactions.map((reaction) => (
            <div key={reaction.id} className="card p-0 overflow-hidden">
              {/* Video preview */}
              <div className="relative aspect-video bg-gray-900">
                {reaction.videoPath ? (
                  playingId === reaction.id ? (
                    <video
                      src={`/storage/${reaction.videoPath}`}
                      autoPlay
                      controls
                      className="w-full h-full object-cover"
                      onEnded={() => setPlayingId(null)}
                    />
                  ) : (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button
                          onClick={() => setPlayingId(reaction.id)}
                          className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center hover:bg-white transition-colors"
                        >
                          <Play className="w-8 h-8 text-gray-900 ml-1" />
                        </button>
                      </div>
                      {reaction.videoSize && (
                        <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-xs rounded">
                          {(reaction.videoSize / 1024 / 1024).toFixed(1)} MB
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                    Pas de vidéo
                  </div>
                )}

                {/* Premium badge */}
                {reaction.premiumGranted && (
                  <div className="absolute top-2 left-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-medium text-gray-900">
                      {reaction.user.firstName} {reaction.user.lastName}
                    </span>
                    <p className="text-sm text-gray-500">{reaction.user.email}</p>
                  </div>
                  {getStatusBadge(reaction.status)}
                </div>

                <div className="text-xs text-gray-500 mb-3">
                  Créé le {new Date(reaction.createdAt).toLocaleDateString('fr-FR')}
                  {reaction.uploadedAt && (
                    <> · Uploadé le {new Date(reaction.uploadedAt).toLocaleDateString('fr-FR')}</>
                  )}
                </div>

                {/* Comment */}
                {reaction.comment && (
                  <div className="mb-3 p-3 bg-gray-50 rounded-lg border-l-3 border-primary-400">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                      <MessageSquare className="w-3 h-3" />
                      Commentaire
                    </div>
                    <p className="text-sm text-gray-700 italic">"{reaction.comment}"</p>
                  </div>
                )}

                {reaction.premiumGranted && reaction.premiumUntil && (
                  <div className="text-sm text-green-600 mb-3">
                    Premium jusqu'au {new Date(reaction.premiumUntil).toLocaleDateString('fr-FR')}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {reaction.videoPath && (
                    <a
                      href={`/storage/${reaction.videoPath}`}
                      download
                      className="p-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                      title="Télécharger"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                  {reaction.premiumGranted && reaction.status !== 'rejected' && (
                    <button
                      onClick={() => handleRevoke(reaction.id)}
                      className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                      title="Révoquer le premium"
                    >
                      <ShieldX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
