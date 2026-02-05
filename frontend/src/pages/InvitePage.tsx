import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gift, Loader2, AlertCircle, ArrowRight, Mail, UserPlus } from 'lucide-react';
import { Logo } from '@/components';
import { useAuth, useI18n } from '@/hooks';
import { API_BASE_URL, fetchWithAuth } from '@/lib/config';

interface InvitationData {
  valid: boolean;
  reason?: string;
  freeGenerations?: number;
  expiresAt?: string;
  usesRemaining?: number;
}

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;

    fetch(`${API_BASE_URL}/invitations/${code.toUpperCase()}`)
      .then(res => res.json())
      .then(data => {
        setInvitation(data);
        // Track the view
        fetch(`${API_BASE_URL}/invitations/${code.toUpperCase()}/view`, { method: 'POST' });
      })
      .catch(() => setInvitation({ valid: false, reason: 'error' }))
      .finally(() => setIsLoading(false));
  }, [code]);

  const handleApply = async () => {
    if (!code) return;
    setIsApplying(true);
    setError('');

    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/invitations/${code.toUpperCase()}/apply`, {
        method: 'POST',
      });
      const data = await res.json();

      if (data.success) {
        setApplied(true);
        localStorage.removeItem('pendingInvite');
      } else if (data.redirectTo) {
        navigate(`/login`);
      } else {
        setError(data.message || 'Erreur');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setIsApplying(false);
    }
  };

  const reasonLabels: Record<string, string> = {
    not_found: "Ce code d'invitation n'existe pas.",
    disabled: "Cette invitation n'est plus active.",
    expired: 'Cette invitation a expiré.',
    limit_reached: "Cette invitation a atteint sa limite d'utilisation.",
    error: 'Impossible de vérifier cette invitation.',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-64 h-64 bg-teal-100 rounded-full opacity-30 blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blush-100 rounded-full opacity-40 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="card text-center">
          <div className="flex justify-center mb-8">
            <Logo size="xl" />
          </div>

          {/* Invalid invitation */}
          {invitation && !invitation.valid && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="font-display text-2xl text-dark mb-3">Invitation invalide</h1>
              <p className="text-gray-600 mb-6">
                {reasonLabels[invitation.reason || 'error']}
              </p>
              <Link to="/" className="btn-primary inline-flex items-center gap-2">
                Retour à l'accueil
              </Link>
            </>
          )}

          {/* Valid invitation - already applied */}
          {invitation?.valid && applied && (
            <>
              <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-teal-50 flex items-center justify-center">
                <Gift className="w-8 h-8 text-teal-600" />
              </div>
              <h1 className="font-display text-2xl text-dark mb-3">Cadeau activé !</h1>
              <p className="text-gray-600 mb-6">
                Vous avez reçu <strong className="text-teal-700">{invitation.freeGenerations} génération{(invitation.freeGenerations || 0) > 1 ? 's' : ''} gratuite{(invitation.freeGenerations || 0) > 1 ? 's' : ''}</strong>.
              </p>
              <button onClick={() => navigate('/create')} className="btn-primary inline-flex items-center gap-2">
                Créer ma vidéo
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Valid invitation - show offer */}
          {invitation?.valid && !applied && (
            <>
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-teal-50 flex items-center justify-center">
                <Gift className="w-10 h-10 text-teal-600" />
              </div>
              <h1 className="font-display text-2xl text-dark mb-3">
                Vous êtes invité(e) !
              </h1>
              <p className="text-gray-600 mb-6">
                Quelqu'un souhaite partager avec vous une expérience unique : visualiser vos rêves grâce à l'intelligence artificielle.
              </p>

              <div className="bg-teal-50 rounded-2xl p-5 mb-6">
                <p className="text-teal-800 text-lg font-bold">
                  🎁 {invitation.freeGenerations} génération{(invitation.freeGenerations || 0) > 1 ? 's' : ''} offerte{(invitation.freeGenerations || 0) > 1 ? 's' : ''}
                </p>
              </div>

              {error && (
                <div className="flex items-center justify-center gap-2 text-red-600 text-sm mb-4">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {user ? (
                <button
                  onClick={handleApply}
                  disabled={isApplying}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {isApplying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Accepter l'invitation
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-4">
                  <Link
                    to={`/create?invite=${code}`}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    Créer mon compte
                  </Link>
                  <Link
                    to={`/login?invite=${code}`}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-teal-600 text-teal-700 rounded-full font-medium hover:bg-teal-50 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    J'ai déjà un compte
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
