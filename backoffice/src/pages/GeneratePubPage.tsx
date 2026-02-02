import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Clapperboard, Search, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const API_URL = 'http://localhost:8000/api/v1';

interface UserOption {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  photosCount: number;
}

export function GeneratePubPage() {
  const { fetchWithAuth } = useAuth();

  // Form state
  const [selectedUser, setSelectedUser] = useState<UserOption | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<UserOption[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [dreamDescription, setDreamDescription] = useState('');
  const [dailyContext, setDailyContext] = useState('');
  const [scenesCount, setScenesCount] = useState(7);
  const [rejectText, setRejectText] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; traceId?: string; error?: string } | null>(null);

  // Search users
  useEffect(() => {
    if (userSearch.length < 2) {
      setUserResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingUsers(true);
      try {
        const res = await fetchWithAuth(`${API_URL}/admin/users?email=${encodeURIComponent(userSearch)}&perPage=10`);
        if (res.ok) {
          const data = await res.json();
          setUserResults(data.users.map((u: any) => ({
            id: u.id,
            email: u.email,
            firstName: u.firstName || '',
            lastName: u.lastName || '',
            photosCount: u.photosCount || 0,
          })));
        }
      } catch {
        // Ignore
      } finally {
        setSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch]);

  const handleSubmit = async () => {
    if (!selectedUser || !dreamDescription.trim() || !dailyContext.trim()) return;

    setSubmitting(true);
    setResult(null);

    try {
      const reject = rejectText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetchWithAuth(`${API_URL}/admin/generate-pub`, {
        method: 'POST',
        body: JSON.stringify({
          userId: selectedUser.id,
          dreamDescription: dreamDescription.trim(),
          dailyContext: dailyContext.trim(),
          scenesCount,
          ...(reject.length > 0 && { reject }),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setResult({ success: true, traceId: data.run?.traceId });
      } else {
        setResult({ success: false, error: data.error || 'Erreur inconnue' });
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Erreur de connexion' });
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = selectedUser && selectedUser.photosCount > 0 && dreamDescription.trim().length >= 10 && dailyContext.trim().length >= 5;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Spot Pub</h1>
        <p className="text-gray-500 mt-1">
          Lancer une generation en mode scenario_pub (transition quotidien &rarr; reve)
        </p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <Clapperboard className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Nouvelle generation pub</h2>
        </div>

        {/* User selection */}
        <div className="mb-6">
          <label className="label">Utilisateur</label>
          {selectedUser ? (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <p className="font-medium text-gray-900">
                  {selectedUser.firstName} {selectedUser.lastName}
                </p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
                <p className="text-xs text-gray-400">{selectedUser.photosCount} photo(s)</p>
              </div>
              <button
                onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Changer
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher par email..."
                className="input pl-10"
              />
              {searchingUsers && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
              )}
              {userResults.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {userResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setUserSearch('');
                        setUserResults([]);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                    >
                      <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                      <p className="text-sm text-gray-500">{u.email} &middot; {u.photosCount} photo(s)</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {selectedUser && selectedUser.photosCount === 0 && (
            <p className="text-sm text-red-600 mt-1">Cet utilisateur n'a pas de photos.</p>
          )}
        </div>

        {/* Dream description */}
        <div className="mb-6">
          <label className="label">Description du reve</label>
          <textarea
            value={dreamDescription}
            onChange={(e) => setDreamDescription(e.target.value)}
            placeholder="Ex: Devenir chef cuisinier dans un grand restaurant parisien..."
            className="input min-h-[100px]"
            rows={4}
          />
          <p className="text-xs text-gray-500 mt-1">Le reve que le personnage va vivre (min 10 caracteres)</p>
        </div>

        {/* Daily context */}
        <div className="mb-6">
          <label className="label">Contexte quotidien (l'ennui a fuir)</label>
          <textarea
            value={dailyContext}
            onChange={(e) => setDailyContext(e.target.value)}
            placeholder="Ex: Employe de bureau dans un open space gris, travail repetitif devant un ecran..."
            className="input min-h-[80px]"
            rows={3}
          />
          <p className="text-xs text-gray-500 mt-1">
            L'environnement quotidien ennuyeux d'ou le personnage s'echappe (scene 1A)
          </p>
        </div>

        {/* Scenes count + reject */}
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="label">Nombre de scenes de reve</label>
            <input
              type="number"
              value={scenesCount}
              onChange={(e) => setScenesCount(Math.max(3, Math.min(10, parseInt(e.target.value) || 7)))}
              className="input"
              min={3}
              max={10}
            />
            <p className="text-xs text-gray-500 mt-1">
              + 2 scenes de transition (1A + 1B) = {scenesCount + 2} scenes au total
            </p>
          </div>
          <div>
            <label className="label">Elements a exclure (optionnel)</label>
            <input
              type="text"
              value={rejectText}
              onChange={(e) => setRejectText(e.target.value)}
              placeholder="Ex: pas de robe, pas de plage..."
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">Separes par des virgules</p>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="btn btn-primary flex items-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Lancement en cours...
              </>
            ) : (
              <>
                <Clapperboard className="w-4 h-4" />
                Lancer la generation pub
              </>
            )}
          </button>

          {result && (
            <div className={`flex items-center gap-2 text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}>
              {result.success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Generation lancee (trace: {result.traceId})
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  {result.error}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-900 mb-2">Mode scenario_pub</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>&bull; Scene 1A : transition quotidien ennuyeux &rarr; environnement de reve (couleurs desaturees &rarr; vives)</li>
          <li>&bull; Scene 1B : premiers pas dans le reve (keyframe partage avec fin 1A)</li>
          <li>&bull; Scenes 2+ : scenes de reve independantes (same_day=false, tenue variable)</li>
          <li>&bull; Derniere scene : ACCOMPLISSEMENT avec regard camera autorise</li>
        </ul>
      </div>
    </div>
  );
}
