import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';

type Locale = 'fr' | 'en';
type Translations = typeof fr;

const translations: Record<Locale, Translations> = { fr, en };

// Fonction pour récupérer une valeur imbriquée par chemin (ex: "landing.title")
function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let result: unknown = obj;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path; // Retourne la clé si non trouvée
    }
  }
  
  return typeof result === 'string' ? result : path;
}

// Fonction pour remplacer les placeholders {{variable}}
function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  availableLocales: Locale[];
}

const I18nContext = createContext<I18nContextType | null>(null);

// Détecter la langue du navigateur
function detectBrowserLocale(): Locale {
  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'fr' ? 'fr' : 'en';
}

// Récupérer la langue sauvegardée ou détecter
function getInitialLocale(): Locale {
  const saved = localStorage.getItem('locale') as Locale | null;
  if (saved && (saved === 'fr' || saved === 'en')) {
    return saved;
  }
  return detectBrowserLocale();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    document.documentElement.lang = newLocale;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const text = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
      return interpolate(text, params);
    },
    [locale]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        availableLocales: ['fr', 'en'],
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

// Composant pour le sélecteur de langue
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, availableLocales } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      className={className || 'px-2 py-1 rounded border border-charcoal-200 text-sm bg-white'}
    >
      {availableLocales.map((loc) => (
        <option key={loc} value={loc}>
          {loc === 'fr' ? '🇫🇷 FR' : '🇬🇧 EN'}
        </option>
      ))}
    </select>
  );
}
