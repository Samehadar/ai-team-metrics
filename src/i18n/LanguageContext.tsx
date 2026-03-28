import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { translations, type Locale } from './translations';

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, ...args: (string | number)[]) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const saved = localStorage.getItem('ai-metrics-lang');
      if (saved === 'ru' || saved === 'en') return saved;
    } catch {}
    return 'en';
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem('ai-metrics-lang', l); } catch {}
  }, []);

  const t = useCallback((key: string, ...args: (string | number)[]) => {
    let str = translations[locale]?.[key] ?? translations.en[key] ?? key;
    for (let i = 0; i < args.length; i++) {
      str = str.replace(`{${i}}`, String(args[i]));
    }
    return str;
  }, [locale]);

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  return useContext(LanguageContext);
}
