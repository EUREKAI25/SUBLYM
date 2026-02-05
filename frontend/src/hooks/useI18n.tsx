import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import fr from '@/locales/fr.json';
import en from '@/locales/en.json';
import it from '@/locales/it.json';
import de from '@/locales/de.json';
import es from '@/locales/es.json';

type Locale = 'fr' | 'en' | 'it' | 'de' | 'es';
type Translations = typeof fr;

const translations: Record<Locale, Translations> = { fr, en, it, de, es };

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

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

const SUPPORTED_LOCALES: Locale[] = ['fr', 'en', 'it', 'de', 'es'];

// Détecter la langue du navigateur (priorité 1)
function detectBrowserLocale(): Locale {
  // Essayer navigator.language puis navigator.languages
  const languages = [navigator.language, ...(navigator.languages || [])];
  for (const lang of languages) {
    const code = lang.split('-')[0] as Locale;
    if (SUPPORTED_LOCALES.includes(code)) {
      return code;
    }
  }
  return 'fr'; // Défaut français
}

// La langue du navigateur a toujours la priorité
// localStorage ne sert que si l'utilisateur change manuellement la langue
function getInitialLocale(): Locale {
  // Toujours utiliser la langue du navigateur par défaut
  const browserLocale = detectBrowserLocale();

  // Ne garder le localStorage que si l'utilisateur a explicitement choisi une autre langue
  const saved = localStorage.getItem('locale') as Locale | null;
  const userExplicitlyChanged = localStorage.getItem('locale_explicit') === 'true';

  if (saved && userExplicitlyChanged && SUPPORTED_LOCALES.includes(saved)) {
    return saved;
  }

  // Sinon utiliser la langue du navigateur et la sauvegarder
  localStorage.setItem('locale', browserLocale);
  localStorage.removeItem('locale_explicit');
  return browserLocale;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
  const [apiTexts, setApiTexts] = useState<Record<string, string>>({});

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
    localStorage.setItem('locale_explicit', 'true'); // Marquer que l'utilisateur a choisi
    document.documentElement.lang = newLocale;
  }, []);

  // Fetch texts from API when locale changes
  useEffect(() => {
    const fetchTexts = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/config/texts/${locale}`);
        if (res.ok) {
          const data = await res.json();
          setApiTexts(data);
        }
      } catch {
        // Silently fall back to local JSON
      }
    };
    fetchTexts();
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      // First try API texts (flat keys like "landing.title")
      if (apiTexts[key]) {
        return interpolate(apiTexts[key], params);
      }
      // Fallback to local JSON
      const text = getNestedValue(translations[locale] as unknown as Record<string, unknown>, key);
      return interpolate(text, params);
    },
    [locale, apiTexts]
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t,
        availableLocales: SUPPORTED_LOCALES,
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
      className={className || 'px-2 py-1 rounded border border-gray-200 text-sm bg-white'}
    >
      {availableLocales.map((loc) => (
        <option key={loc} value={loc}>
          {{ fr: '🇫🇷 FR', en: '🇬🇧 EN', it: '🇮🇹 IT', de: '🇩🇪 DE', es: '🇪🇸 ES' }[loc]}
        </option>
      ))}
    </select>
  );
}
