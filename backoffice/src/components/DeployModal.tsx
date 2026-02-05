import { useState, useEffect, useCallback } from 'react';
import { Rocket, X, Loader2, CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

interface RunInfo {
  id: number;
  status: string;
  conclusion: string | null;
  createdAt: string;
  updatedAt: string;
  htmlUrl: string;
  triggeredBy: string;
}

interface DeployModalProps {
  open: boolean;
  onClose: () => void;
  target: 'preprod' | 'prod';
}

export function DeployModal({ open, onClose, target }: DeployModalProps) {
  const { fetchWithAuth } = useAuth();
  const [phase, setPhase] = useState<'confirm' | 'triggering' | 'polling' | 'done'>('confirm');
  const [lastRun, setLastRun] = useState<RunInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/deploy/status`);
      if (res.ok) {
        const data = await res.json();
        const run = data[target] as RunInfo | null;
        setLastRun(run);
        return run;
      }
    } catch {
      // silently ignore
    }
    return null;
  }, [fetchWithAuth, target]);

  // Fetch status on open
  useEffect(() => {
    if (open) {
      setPhase('confirm');
      setError(null);
      fetchStatus();
    }
  }, [open, fetchStatus]);

  // Poll while in polling phase
  useEffect(() => {
    if (phase !== 'polling') return;
    const interval = setInterval(async () => {
      const run = await fetchStatus();
      if (run && run.status === 'completed') {
        setPhase('done');
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [phase, fetchStatus]);

  const triggerDeploy = async () => {
    setPhase('triggering');
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_URL}/admin/deploy`, {
        method: 'POST',
        body: JSON.stringify({ target }),
      });
      if (res.ok) {
        setPhase('polling');
        // Attendre que GitHub enregistre le run avant de commencer le polling
        setTimeout(fetchStatus, 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || `Erreur ${res.status}`);
        setPhase('confirm');
      }
    } catch {
      setError('Erreur reseau');
      setPhase('confirm');
    }
  };

  if (!open) return null;

  const isProd = target === 'prod';
  const accentColor = isProd ? 'red' : 'orange';
  const targetLabel = isProd ? 'Production' : 'Preprod';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${
          isProd ? 'bg-red-600' : 'bg-orange-500'
        } text-white`}>
          <div className="flex items-center gap-3">
            <Rocket className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Deploy {targetLabel}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Confirm phase */}
          {phase === 'confirm' && (
            <>
              {isProd && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">
                    <strong>Attention :</strong> Ce deploiement affecte la production. Les utilisateurs verront les changements immediatement.
                  </p>
                </div>
              )}

              <p className="text-sm text-gray-600">
                {isProd
                  ? <>Cela va <strong>merger preprod dans main</strong> et deployer en production.</>
                  : <>Cela va <strong>pusher le code local</strong> sur la branche preprod et deployer sur le serveur.</>
                }
              </p>

              {/* Last deploy info */}
              {lastRun && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-gray-700">Dernier deploiement :</p>
                  <div className="flex items-center gap-2">
                    {lastRun.conclusion === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : lastRun.conclusion === 'failure' ? (
                      <XCircle className="w-4 h-4 text-red-600" />
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    )}
                    <span className={
                      lastRun.conclusion === 'success' ? 'text-green-700' :
                      lastRun.conclusion === 'failure' ? 'text-red-700' :
                      'text-blue-700'
                    }>
                      {lastRun.conclusion === 'success' ? 'Succes' :
                       lastRun.conclusion === 'failure' ? 'Echec' :
                       lastRun.status === 'in_progress' ? 'En cours...' :
                       lastRun.status}
                    </span>
                    <span className="text-gray-500">
                      {new Date(lastRun.updatedAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  onClick={triggerDeploy}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2 ${
                    isProd
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  <Rocket className="w-4 h-4" />
                  Deployer
                </button>
              </div>
            </>
          )}

          {/* Triggering phase */}
          {phase === 'triggering' && (
            <div className="flex flex-col items-center py-6 gap-3">
              <Loader2 className={`w-8 h-8 animate-spin text-${accentColor}-500`} />
              <p className="text-sm text-gray-600">Declenchement du deploiement...</p>
            </div>
          )}

          {/* Polling phase */}
          {phase === 'polling' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 gap-3">
                <Loader2 className={`w-8 h-8 animate-spin text-${accentColor}-500`} />
                <p className="text-sm font-medium text-gray-700">Deploiement en cours...</p>
                <p className="text-xs text-gray-500">
                  {lastRun?.status === 'queued' && 'En attente dans la file...'}
                  {lastRun?.status === 'in_progress' && 'Build et deploiement en cours...'}
                  {!lastRun && 'Demarrage du workflow...'}
                </p>
              </div>

              {lastRun?.htmlUrl && (
                <a
                  href={lastRun.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Voir sur GitHub Actions
                </a>
              )}

              <button
                onClick={onClose}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
              >
                Fermer (le deploiement continue)
              </button>
            </div>
          )}

          {/* Done phase */}
          {phase === 'done' && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-4 gap-3">
                {lastRun?.conclusion === 'success' ? (
                  <>
                    <CheckCircle className="w-10 h-10 text-green-500" />
                    <p className="text-sm font-medium text-green-700">Deploiement reussi !</p>
                  </>
                ) : (
                  <>
                    <XCircle className="w-10 h-10 text-red-500" />
                    <p className="text-sm font-medium text-red-700">Le deploiement a echoue</p>
                  </>
                )}
              </div>

              {lastRun?.htmlUrl && (
                <a
                  href={lastRun.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Voir les details sur GitHub
                </a>
              )}

              <button
                onClick={onClose}
                className={`w-full px-4 py-2.5 rounded-lg text-sm font-medium text-white ${
                  lastRun?.conclusion === 'success' ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
