import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Hand,
  Scroll,
  Palette,
  Moon,
  Sun,
  Monitor,
  Lock,
  LogOut,
  Trash2,
  Download,
  ChevronRight,
} from 'lucide-react';
import { usersApi, authApi } from '../lib/api';
import { useSettingsStore, useAuthStore } from '../lib/store';

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    navigationMode,
    gestureSensitivity,
    useDreamTheme,
    themePreference,
    setNavigationMode,
    setGestureSensitivity,
    setUseDreamTheme,
    setThemePreference,
  } = useSettingsStore();
  const { logout } = useAuthStore();

  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleNavigationModeChange = async (mode: 'scroll' | 'swipe') => {
    setNavigationMode(mode);
    try {
      await usersApi.updateSettings({ navigationMode: mode });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleSensitivityChange = async (value: number) => {
    setGestureSensitivity(value);
    try {
      await usersApi.updateSettings({ gestureSensitivity: value });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleDreamThemeChange = async (value: boolean) => {
    setUseDreamTheme(value);
    try {
      await usersApi.updateSettings({ useDreamTheme: value });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleThemeChange = async (pref: 'system' | 'light' | 'dark') => {
    setThemePreference(pref);
    try {
      await usersApi.updateSettings({ themePreference: pref });
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleExportData = async () => {
    try {
      const data = await usersApi.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sublym-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col safe-area-inset">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-dream-950 via-system-carbon-400 to-dream-900 -z-10" />

      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-display font-bold">Réglages</h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 pb-8 overflow-y-auto space-y-6">
        {/* Navigation section */}
        <section className="glass-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Navigation
          </h2>

          <div className="space-y-3">
            <p className="text-sm text-white/80">Mode de navigation</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleNavigationModeChange('scroll')}
                className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-colors ${
                  navigationMode === 'scroll'
                    ? 'bg-dream-500/20 border border-dream-500'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <Scroll className="w-6 h-6" />
                <span className="text-sm">Scroll</span>
              </button>
              <button
                onClick={() => handleNavigationModeChange('swipe')}
                className={`p-4 rounded-xl flex flex-col items-center gap-2 transition-colors ${
                  navigationMode === 'swipe'
                    ? 'bg-dream-500/20 border border-dream-500'
                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                }`}
              >
                <Hand className="w-6 h-6" />
                <span className="text-sm">Swipe</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-sm text-white/80">Sensibilité</p>
              <span className="text-sm text-white/40">
                {Math.round(gestureSensitivity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={gestureSensitivity}
              onChange={(e) => handleSensitivityChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-dream-500 [&::-webkit-slider-thumb]:rounded-full"
            />
          </div>
        </section>

        {/* Appearance section */}
        <section className="glass-card p-4 space-y-4">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider">
            Apparence
          </h2>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-white/60" />
              <span className="text-sm">Thème du rêve</span>
            </div>
            <button
              onClick={() => handleDreamThemeChange(!useDreamTheme)}
              className={`w-12 h-7 rounded-full relative transition-colors ${
                useDreamTheme ? 'bg-dream-500' : 'bg-white/20'
              }`}
            >
              <motion.div
                animate={{ x: useDreamTheme ? 22 : 2 }}
                className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
              />
            </button>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-white/80">Thème de l'interface</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'system', icon: Monitor, label: 'Auto' },
                { key: 'light', icon: Sun, label: 'Clair' },
                { key: 'dark', icon: Moon, label: 'Sombre' },
              ].map((theme) => (
                <button
                  key={theme.key}
                  onClick={() => handleThemeChange(theme.key as typeof themePreference)}
                  className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-colors ${
                    themePreference === theme.key
                      ? 'bg-dream-500/20 border border-dream-500'
                      : 'bg-white/5 border border-transparent hover:bg-white/10'
                  }`}
                >
                  <theme.icon className="w-5 h-5" />
                  <span className="text-xs">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Security section */}
        <section className="glass-card p-4 space-y-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Sécurité
          </h2>

          <button
            onClick={() => setShowChangePinModal(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-white/60" />
              <span className="text-sm">Modifier le PIN</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <LogOut className="w-5 h-5 text-white/60" />
              <span className="text-sm">Se déconnecter</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>
        </section>

        {/* Data section */}
        <section className="glass-card p-4 space-y-1">
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-3">
            Données
          </h2>

          <button
            onClick={handleExportData}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Download className="w-5 h-5 text-white/60" />
              <span className="text-sm">Exporter mes données</span>
            </div>
            <ChevronRight className="w-5 h-5 text-white/40" />
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-red-500/10 transition-colors text-red-400"
          >
            <div className="flex items-center gap-3">
              <Trash2 className="w-5 h-5" />
              <span className="text-sm">Supprimer mon compte</span>
            </div>
            <ChevronRight className="w-5 h-5 opacity-40" />
          </button>
        </section>

        {/* Version */}
        <p className="text-center text-xs text-white/30 pb-4">
          Sublym Dream v1.0.0
        </p>
      </main>
    </div>
  );
}
