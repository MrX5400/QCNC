import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  ThemeConfig, 
  PRESET_THEMES, 
  getSavedTheme, 
  saveTheme as persistTheme, 
  applyThemeCssVars 
} from '../services/themeService';
import { 
  Language, 
  Translations, 
  translations, 
  getSavedLanguage, 
  saveLanguage as persistLanguage 
} from '../services/i18n';

interface ThemeLanguageContextType {
  // Theme state & actions
  theme: ThemeConfig;
  setTheme: (theme: ThemeConfig) => void;
  presetThemes: ThemeConfig[];
  updateCustomTheme: (partial: Partial<ThemeConfig>) => void;
  
  // UI Scale
  uiScale: number;
  setUiScale: (scale: number) => void;

  // Language state & actions
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const ThemeLanguageContext = createContext<ThemeLanguageContextType | undefined>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeConfig>(() => getSavedTheme());
  const [language, setLanguageState] = useState<Language>(() => getSavedLanguage());
  
  const [uiScale, setUiScaleState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('plottercnc_ui_scale');
      return saved ? parseInt(saved, 10) : 100;
    } catch {
      return 100;
    }
  });

  // Apply theme to document on mount and change
  useEffect(() => {
    applyThemeCssVars(theme);
    const root = document.documentElement;
    if (theme.isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', theme.id);
  }, [theme]);

  // Apply ui scale to document on mount and change
  useEffect(() => {
    // 100% = 16px (default root font size)
    const newFontSize = 16 * (uiScale / 100);
    document.documentElement.style.fontSize = `${newFontSize}px`;
  }, [uiScale]);

  const setTheme = (newTheme: ThemeConfig) => {
    setThemeState(newTheme);
    persistTheme(newTheme);
  };

  const updateCustomTheme = (partial: Partial<ThemeConfig>) => {
    const updated: ThemeConfig = {
      ...theme,
      ...partial,
      id: 'custom',
      name: 'Benutzerdefiniert',
    };
    setTheme(updated);
  };

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
    persistLanguage(newLang);
  };

  const setUiScale = (scale: number) => {
    setUiScaleState(scale);
    try {
      localStorage.setItem('plottercnc_ui_scale', scale.toString());
    } catch {
      // ignore
    }
  };

  const currentTranslations = translations[language] || translations.de;

  return (
    <ThemeLanguageContext.Provider
      value={{
        theme,
        setTheme,
        presetThemes: PRESET_THEMES,
        updateCustomTheme,
        uiScale,
        setUiScale,
        language,
        setLanguage,
        t: currentTranslations,
      }}
    >
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export const useThemeLanguage = (): ThemeLanguageContextType => {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error('useThemeLanguage must be used within a ThemeLanguageProvider');
  }
  return context;
};

export const useTheme = () => {
  const { theme, setTheme, presetThemes, updateCustomTheme, uiScale, setUiScale } = useThemeLanguage();
  return { theme, setTheme, presetThemes, updateCustomTheme, uiScale, setUiScale };
};

export const useI18n = () => {
  const { language, setLanguage, t } = useThemeLanguage();
  return { language, setLanguage, t };
};
