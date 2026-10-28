import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language } from '../types';

interface LanguageOption {
  code: Language;
  label: string;
  native: string;
}

export const availableLanguages: LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
  { code: 'es', label: 'Spanish', native: 'Español' },
];

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  isTelugu: boolean;
  isSpanish: boolean;
  isEnglish: boolean;
  availableLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'el_nino_ready_world_lang';

function getBrowserLanguage(): Language {
  const browserLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const candidate of browserLanguages) {
    const languageCode = candidate.split('-')[0].toLowerCase();
    if (languageCode === 'te' || languageCode === 'es' || languageCode === 'en') {
      return languageCode;
    }
  }
  return 'en';
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'te' || saved === 'en' || saved === 'es') {
        return saved;
      }
    } catch {
      // LocalStorage might be unavailable
    }
    return getBrowserLanguage();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Ignore storage errors
    }
    // Update document element lang attribute for accessibility and styling
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const isTelugu = language === 'te';
  const isSpanish = language === 'es';
  const isEnglish = language === 'en';

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isTelugu,
        isSpanish,
        isEnglish,
        availableLanguages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
