import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Smartphone, Share, Plus, ArrowRight } from 'lucide-react';

export default function InstallPromptPage() {
  const navigate = useNavigate();
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        window.dataLayer?.push({ event: 'installed' });
        navigate('/dreams');
      }

      setDeferredPrompt(null);
    }
  };

  const handleSkip = () => {
    navigate('/dreams');
  };

  if (isStandalone) {
    // Already installed, redirect
    navigate('/dreams');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm text-center"
      >
        {/* Icon */}
        <div className="flex justify-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-gradient-dream flex items-center justify-center">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-display font-bold mb-4">
          Installez Sublym
        </h1>
        <p className="text-white/60 mb-8">
          Ajoutez Sublym à votre écran d'accueil pour une expérience optimale
        </p>

        {isIOS ? (
          /* iOS instructions */
          <div className="glass-card p-6 mb-8 text-left">
            <h2 className="font-semibold mb-4">Comment installer :</h2>
            <ol className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dream-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-dream-400">1</span>
                </div>
                <div>
                  <p className="text-sm">
                    Appuyez sur le bouton{' '}
                    <Share className="w-4 h-4 inline text-dream-400" /> Partager
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dream-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-dream-400">2</span>
                </div>
                <div>
                  <p className="text-sm">
                    Faites défiler et appuyez sur{' '}
                    <Plus className="w-4 h-4 inline text-dream-400" />{' '}
                    <strong>Sur l'écran d'accueil</strong>
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-dream-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-sm font-bold text-dream-400">3</span>
                </div>
                <div>
                  <p className="text-sm">Appuyez sur <strong>Ajouter</strong></p>
                </div>
              </li>
            </ol>
          </div>
        ) : deferredPrompt ? (
          /* Android/Chrome install button */
          <button
            onClick={handleInstall}
            className="gradient-button w-full py-4 font-semibold mb-4"
          >
            Installer l'application
          </button>
        ) : (
          /* Generic instructions */
          <div className="glass-card p-6 mb-8 text-left">
            <p className="text-sm text-white/60">
              Pour installer l'application, utilisez le menu de votre navigateur
              et sélectionnez "Ajouter à l'écran d'accueil" ou "Installer l'application".
            </p>
          </div>
        )}

        {/* Skip button */}
        <button
          onClick={handleSkip}
          className="flex items-center justify-center gap-2 text-white/60 hover:text-white transition-colors mx-auto"
        >
          <span>Continuer sur le web</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    </div>
  );
}
