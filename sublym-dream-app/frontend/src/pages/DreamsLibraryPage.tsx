import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus,
  Settings,
  Sparkles,
  Check,
  Clock,
  Archive,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { dreamsApi, Dream } from '../lib/api';

export default function DreamsLibraryPage() {
  const navigate = useNavigate();

  const [dreams, setDreams] = useState<Dream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'realized'>('all');

  useEffect(() => {
    loadDreams();
  }, []);

  const loadDreams = async () => {
    setIsLoading(true);
    try {
      const result = await dreamsApi.list();
      setDreams(result.dreams);
    } catch (err) {
      console.error('Failed to load dreams:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkRealized = async (dreamId: string) => {
    try {
      await dreamsApi.update(dreamId, { status: 'realized' });
      loadDreams();
    } catch (err) {
      console.error('Failed to mark realized:', err);
    }
  };

  const handleActivate = async (dreamId: string) => {
    try {
      await dreamsApi.update(dreamId, { status: 'active' });
      loadDreams();
    } catch (err) {
      console.error('Failed to activate:', err);
    }
  };

  const filteredDreams = dreams.filter((dream) => {
    if (filter === 'all') return true;
    if (filter === 'active') return dream.status === 'active' || dream.status === 'inactive';
    if (filter === 'realized') return dream.status === 'realized';
    return true;
  });

  const activeDream = dreams.find((d) => d.isActive);

  return (
    <div className="min-h-screen flex flex-col safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-xl font-display font-bold">Mes rêves</h1>
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      {/* Active dream banner */}
      {activeDream && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-6 mb-4"
        >
          <button
            onClick={() => navigate(`/dream/${activeDream.id}`)}
            className="w-full glass-card p-4 flex items-center gap-4 hover:bg-white/15 transition-colors"
          >
            {activeDream.thumbnailUrl ? (
              <img
                src={activeDream.thumbnailUrl}
                alt=""
                className="w-16 h-16 rounded-xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-gradient-dream flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1 text-left">
              <p className="text-xs text-dream-400 font-medium mb-1">Rêve actif</p>
              <p className="font-semibold line-clamp-1">
                {activeDream.title || activeDream.description.substring(0, 50)}
              </p>
              <p className="text-sm text-white/60">
                {activeDream.imagesCount} images
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>
        </motion.div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 px-6 mb-4">
        {[
          { key: 'all', label: 'Tous' },
          { key: 'active', label: 'En cours' },
          { key: 'realized', label: 'Réalisés' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key as typeof filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === tab.key
                ? 'bg-dream-500 text-white'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dreams list */}
      <main className="flex-1 px-6 pb-24 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-white/40" />
          </div>
        ) : filteredDreams.length === 0 ? (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/60">
              {filter === 'realized'
                ? 'Aucun rêve réalisé pour le moment'
                : 'Aucun rêve créé'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDreams.map((dream, index) => (
              <motion.div
                key={dream.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4"
              >
                <div className="flex gap-4">
                  {dream.thumbnailUrl ? (
                    <img
                      src={dream.thumbnailUrl}
                      alt=""
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-6 h-6 text-white/20" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {dream.status === 'realized' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Réalisé
                        </span>
                      ) : dream.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-dream-500/20 text-dream-400 px-2 py-0.5 rounded-full">
                          <Sparkles className="w-3 h-3" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-white/10 text-white/40 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          En pause
                        </span>
                      )}
                    </div>

                    <p className="font-medium line-clamp-2 mb-2">
                      {dream.title || dream.description.substring(0, 100)}
                    </p>

                    <p className="text-sm text-white/40">
                      {dream.imagesCount} images
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => navigate(`/dream/${dream.id}`)}
                    className="flex-1 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
                  >
                    Voir
                  </button>

                  {dream.status !== 'realized' && (
                    <button
                      onClick={() => handleMarkRealized(dream.id)}
                      className="px-4 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}

                  {dream.status === 'inactive' && (
                    <button
                      onClick={() => handleActivate(dream.id)}
                      className="px-4 py-2 rounded-xl bg-dream-500/20 text-dream-400 text-sm font-medium hover:bg-dream-500/30 transition-colors"
                    >
                      Activer
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => navigate('/dream/define')}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-dream flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
