import React, { useState, useRef } from 'react';
import { 
  X, 
  Palette, 
  Globe, 
  SlidersHorizontal, 
  ShieldCheck, 
  HardDriveDownload, 
  Info, 
  Check, 
  RotateCcw, 
  Upload, 
  Download,
  AlertTriangle,
  Sun,
  Moon,
  Search,
  Sparkles,
  Copy,
  Sliders,
  Eye,
  CheckCheck
} from 'lucide-react';
import { ThemeConfig } from '../services/themeService';
import { Language } from '../services/i18n';
import { useThemeLanguage } from '../contexts/ThemeLanguageContext';
import { 
  exportFullSystemConfiguration, 
  importFullSystemConfiguration, 
  resetAllToFactoryDefaults 
} from '../services/systemBackupService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onThemeChanged?: (theme: ThemeConfig) => void;
  onLanguageChanged?: (lang: Language) => void;
  onOpenButtonsModal?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenButtonsModal,
}) => {
  const { theme: currentTheme, setTheme, presetThemes, updateCustomTheme, language: currentLang, setLanguage, t } = useThemeLanguage();
  const [activeTab, setActiveTab] = useState<'appearance' | 'language' | 'safety' | 'backup' | 'about'>('appearance');
  const [themeFilterCategory, setThemeFilterCategory] = useState<'all' | 'minimal' | 'classic' | 'light' | 'contrast'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCustomBuilder, setShowCustomBuilder] = useState<boolean>(false);
  const [copiedJson, setCopiedJson] = useState<boolean>(false);

  const [customTheme, setCustomTheme] = useState<ThemeConfig>(() => {
    return currentTheme.id === 'custom' ? currentTheme : {
      ...currentTheme,
      id: 'custom',
      name: 'Eigenes Design',
      category: 'minimal',
      tag: 'Custom',
      description: 'Individuell konfiguriertes Farbschema'
    };
  });
  const [demoSliderVal, setDemoSliderVal] = useState<number>(65);
  const [toast, setToast] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const themeFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelectPresetTheme = (thm: ThemeConfig) => {
    setTheme(thm);
    showNotification(`Theme gewechselt zu: ${thm.name}`);
  };

  const handleApplyCustomTheme = (thm: ThemeConfig) => {
    const cTheme: ThemeConfig = { 
      ...thm, 
      id: 'custom', 
      name: 'Eigenes Design (Benutzerdefiniert)',
      category: thm.isDark ? 'minimal' : 'light'
    };
    updateCustomTheme(cTheme);
    showNotification('Eigenes Design erfolgreich angewendet!');
  };

  const handleApplyQuickStarter = (templateId: string) => {
    const found = presetThemes.find(p => p.id === templateId);
    if (found) {
      setCustomTheme({
        ...found,
        id: 'custom',
        name: 'Eigenes Design (' + found.name.split('(')[0].trim() + ' Basis)',
      });
      showNotification(`Vorlage geladen: ${found.name}`);
    }
  };

  const handleCopyThemeJson = () => {
    navigator.clipboard.writeText(JSON.stringify(customTheme, null, 2));
    setCopiedJson(true);
    showNotification('Farb-Schema in Zwischenablage kopiert!');
    setTimeout(() => setCopiedJson(false), 2500);
  };

  const handleExportThemeJson = () => {
    const jsonStr = JSON.stringify(customTheme, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plottercnc_theme_${customTheme.name.toLowerCase().replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('Farbpalette exportiert!');
  };

  const handleImportThemeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as ThemeConfig;
        if (parsed.bgTone && parsed.surfaceTone && parsed.accentColor) {
          const importedTheme: ThemeConfig = {
            ...parsed,
            id: 'custom',
            name: parsed.name || 'Importiertes Design',
          };
          setCustomTheme(importedTheme);
          updateCustomTheme(importedTheme);
          showNotification(`Farb-Schema "${importedTheme.name}" erfolgreich importiert und aktiviert!`);
        } else {
          alert('Ungültiges Farbschema-Format: Grundfarben fehlen.');
        }
      } catch (err: any) {
        alert('Fehler beim Einlesen der Theme-Datei: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSelectLanguage = (lang: Language) => {
    setLanguage(lang);
    showNotification(lang === 'de' ? 'Sprache auf Deutsch gesetzt' : 'Language set to English');
  };

  const handleExportBackup = () => {
    const jsonStr = exportFullSystemConfiguration();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plottercnc_full_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification(t.backupSuccess || 'Konfiguration erfolgreich exportiert!');
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = importFullSystemConfiguration(text);
        showNotification(
          `Backup erfolgreich! ${result.profileCount} Profile, ${result.laserCount} Materialien, ${result.buttonCount} Buttons importiert.`
        );
        setTimeout(() => {
          window.location.reload();
        }, 1200);
      } catch (err: any) {
        alert(err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetFactory = () => {
    if (confirm(t.confirmResetFactory || 'Möchtest du wirklich alle Profile und Einstellungen auf Werkseinstellungen zurücksetzen?')) {
      resetAllToFactoryDefaults();
      showNotification('Auf Werkseinstellungen zurückgesetzt! Seite lädt neu...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  // Filtered preset themes
  const filteredThemes = presetThemes.filter(thm => {
    const matchesCat = themeFilterCategory === 'all' || thm.category === themeFilterCategory;
    const matchesSearch = !searchQuery.trim() || 
      thm.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (thm.tag && thm.tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (thm.description && thm.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-indigo-400" />
            <h2 className="font-bold text-base text-slate-100">{t.settingsTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-4 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setActiveTab('appearance')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'appearance'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>{t.settingsAppearance || 'Erscheinungsbild & Themes'}</span>
          </button>

          <button
            onClick={() => setActiveTab('language')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'language'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{t.settingsLanguage || 'Sprache & Einheiten'}</span>
          </button>

          <button
            onClick={() => setActiveTab('safety')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'safety'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{t.settingsSafety || 'Sicherheit & Steuerung'}</span>
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'backup'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>{t.settingsBackup || 'Vollsicherung & Reset'}</span>
          </button>

          <button
            onClick={() => setActiveTab('about')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'about'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>{t.settingsAbout || 'Über PlotterCNC'}</span>
          </button>
        </div>

        {toast && (
          <div className="bg-emerald-950/90 border-b border-emerald-800 px-4 py-2 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>{toast}</span>
          </div>
        )}

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 text-slate-200 text-xs">
          {/* TAB 1: APPEARANCE & THEMES */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Category Filter Pills & Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setThemeFilterCategory('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilterCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {t.themeCategoryAll || 'Alle Designs'} ({presetThemes.length})
                  </button>
                  <button
                    onClick={() => setThemeFilterCategory('minimal')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilterCategory === 'minimal'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    🌱 {t.themeCategoryMinimal || 'Schlicht & Minimal'} (4)
                  </button>
                  <button
                    onClick={() => setThemeFilterCategory('light')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilterCategory === 'light'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ☀️ {t.themeCategoryLight || 'Helle Modi'} (2)
                  </button>
                  <button
                    onClick={() => setThemeFilterCategory('classic')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilterCategory === 'classic'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ⚙️ {t.themeCategoryClassic || 'Klassisch & CAD'} (3)
                  </button>
                  <button
                    onClick={() => setThemeFilterCategory('contrast')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      themeFilterCategory === 'contrast'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    ⚡ {t.themeCategoryContrast || 'Spezial & Kontrast'} (3)
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-44">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Design suchen..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <button
                    onClick={() => setShowCustomBuilder(!showCustomBuilder)}
                    className={`px-3 py-1 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all ${
                      showCustomBuilder
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{showCustomBuilder ? 'Editor schließen' : 'Farben anpassen'}</span>
                  </button>
                </div>
              </div>

              {/* Theme Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {filteredThemes.map((thm) => {
                  const isSelected = currentTheme.id === thm.id;
                  return (
                    <div
                      key={thm.id}
                      onClick={() => handleSelectPresetTheme(thm)}
                      className={`group relative p-3 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-slate-800/90 shadow-lg'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div>
                        {/* Header: Title & Tag */}
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-xs text-slate-200 truncate">{thm.name}</span>
                            {thm.isDark ? (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">Dunkel</span>
                            ) : (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/50 text-amber-300 border border-amber-800/60 shrink-0">Hell</span>
                            )}
                          </div>
                          {isSelected && (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-700/60 shrink-0">
                              <Check className="w-3.5 h-3.5" />
                              <span>Aktiv</span>
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        {thm.description && (
                          <p className="text-[11px] text-slate-400 leading-snug line-clamp-2 mb-2.5">
                            {thm.description}
                          </p>
                        )}

                        {/* Mini Live UI Mockup Preview */}
                        <div 
                          className="w-full h-16 rounded-lg p-2 mb-2.5 flex flex-col justify-between border relative overflow-hidden select-none"
                          style={{
                            backgroundColor: thm.bgTone,
                            borderColor: thm.borderTone,
                            color: thm.textMain
                          }}
                        >
                          {/* Mock Title Bar */}
                          <div 
                            className="flex items-center justify-between px-1.5 py-0.5 rounded border text-[9px] font-mono"
                            style={{
                              backgroundColor: thm.surfaceTone,
                              borderColor: thm.borderTone,
                              color: thm.textMuted
                            }}
                          >
                            <span className="font-bold truncate" style={{ color: thm.textMain }}>PlotterCNC</span>
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: thm.accentColor }} />
                          </div>

                          {/* Mock Visualizer Bed with Cut & Rapid strokes */}
                          <div className="relative w-full h-7 rounded border flex items-center justify-center overflow-hidden"
                            style={{
                              backgroundColor: thm.surfaceTone,
                              borderColor: thm.borderTone,
                            }}
                          >
                            <svg className="w-full h-full" viewBox="0 0 100 28">
                              {/* Grid lines */}
                              <line x1="10" y1="0" x2="10" y2="28" stroke={thm.borderTone} strokeWidth="0.6" strokeDasharray="1,2" />
                              <line x1="30" y1="0" x2="30" y2="28" stroke={thm.borderTone} strokeWidth="0.6" strokeDasharray="1,2" />
                              <line x1="50" y1="0" x2="50" y2="28" stroke={thm.borderTone} strokeWidth="0.6" strokeDasharray="1,2" />
                              <line x1="70" y1="0" x2="70" y2="28" stroke={thm.borderTone} strokeWidth="0.6" strokeDasharray="1,2" />
                              <line x1="90" y1="0" x2="90" y2="28" stroke={thm.borderTone} strokeWidth="0.6" strokeDasharray="1,2" />
                              
                              {/* Rapid Air Move (G0) */}
                              <path d="M 5 22 L 25 8" stroke={thm.rapidLineColor} strokeWidth="1.2" strokeDasharray="2,2" />
                              
                              {/* Cutting Vector Stroke (G1) */}
                              <path d="M 25 8 L 48 8 L 62 20 L 85 12" stroke={thm.cutLineColor} strokeWidth="2.0" fill="none" strokeLinecap="round" />
                              
                              {/* Toolhead Dot */}
                              <circle cx="85" cy="12" r="2.2" fill={thm.accentColor} />
                            </svg>
                          </div>

                          {/* Live Mini Button & Slider Preview Line */}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <div 
                              className="h-1 flex-1 rounded-full relative"
                              style={{ backgroundColor: thm.borderTone }}
                            >
                              <div 
                                className="h-1 w-1/2 rounded-full"
                                style={{ backgroundColor: thm.accentColor }}
                              />
                              <div 
                                className="w-2.5 h-2.5 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-xs"
                                style={{ backgroundColor: thm.accentColor, border: `1.5px solid ${thm.surfaceTone}` }}
                              />
                            </div>
                            <div 
                              className="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0"
                              style={{ 
                                backgroundColor: thm.accentColor,
                                color: thm.isDark && thm.accentColor !== '#e4e4e7' && thm.accentColor !== '#f5f5f7' ? '#ffffff' : '#09090b'
                              }}
                            >
                              Button
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Color Swatches Bar */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                        <div className="flex items-center gap-1">
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.bgTone }} title="Hintergrund" />
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.surfaceTone }} title="Oberfläche" />
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.borderTone }} title="Rahmen" />
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.accentColor }} title="Akzent" />
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.cutLineColor }} title="Schnittbahn (G1)" />
                          <div className="w-4 h-4 rounded-full border border-slate-700/80 shadow-xs" style={{ backgroundColor: thm.rapidLineColor }} title="Eilgang (G0)" />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono group-hover:text-slate-300 transition-colors">
                          {thm.tag || 'Design'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Theme Builder (Expandable) */}
              {showCustomBuilder && (
                <div className="p-4 sm:p-5 bg-slate-950/90 border border-amber-900/50 rounded-2xl space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-amber-400" />
                      <h3 className="font-bold text-sm text-slate-100">
                        {t.customThemeBuilder || 'Eigenes Farbschema zusammenstellen'}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-slate-400 text-[11px]">Schnellvorlage:</span>
                      <button
                        onClick={() => handleApplyQuickStarter('monochrome_minimal')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]"
                      >
                        Monochrom
                      </button>
                      <button
                        onClick={() => handleApplyQuickStarter('graphite_matte')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]"
                      >
                        Graphit
                      </button>
                      <button
                        onClick={() => handleApplyQuickStarter('minimal_paper')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]"
                      >
                        Hell / Papier
                      </button>
                      <button
                        onClick={() => handleApplyQuickStarter('slate_industrial')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px]"
                      >
                        Industrial
                      </button>
                    </div>
                  </div>

                  {/* Mode & Live Preview Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    {/* Controls Column */}
                    <div className="lg:col-span-7 space-y-3">
                      {/* Dark / Light Toggle */}
                      <div className="flex items-center gap-3 bg-slate-900/90 p-2.5 rounded-xl border border-slate-800">
                        <span className="text-slate-300 font-medium text-xs">Grundmodus:</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setCustomTheme({ ...customTheme, isDark: true })}
                            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs transition-colors ${
                              customTheme.isDark
                                ? 'bg-indigo-600 text-white font-semibold'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Moon className="w-3.5 h-3.5" />
                            <span>Dunkel</span>
                          </button>
                          <button
                            onClick={() => setCustomTheme({ ...customTheme, isDark: false })}
                            className={`px-3 py-1 rounded-lg flex items-center gap-1.5 text-xs transition-colors ${
                              !customTheme.isDark
                                ? 'bg-amber-600 text-white font-semibold'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            <Sun className="w-3.5 h-3.5" />
                            <span>Hell</span>
                          </button>
                        </div>
                      </div>

                      {/* Color Pickers Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {/* Primary Accent */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.primaryAccent || 'Akzentfarbe'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.accentColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, accentColor: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.accentColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, accentColor: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Background Tone */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.backgroundTone || 'Hintergrund'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.bgTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, bgTone: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.bgTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, bgTone: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Surface Tone */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.surfaceTone || 'Oberfläche / Panele'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.surfaceTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, surfaceTone: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.surfaceTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, surfaceTone: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Border Tone */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.borderTone || 'Rahmen / Linien'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.borderTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, borderTone: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.borderTone}
                              onChange={(e) => setCustomTheme({ ...customTheme, borderTone: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Cut Line G1 */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.cutLineG1Color || 'Schnittbahn G1'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.cutLineColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, cutLineColor: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.cutLineColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, cutLineColor: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>

                        {/* Rapid Line G0 */}
                        <div className="p-2 bg-slate-900 rounded-lg border border-slate-800">
                          <label className="block text-slate-400 text-[11px] mb-1 truncate">{t.rapidLineG0Color || 'Eilgang G0'}</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={customTheme.rapidLineColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, rapidLineColor: e.target.value })}
                              className="w-7 h-7 rounded border border-slate-700 cursor-pointer bg-transparent"
                            />
                            <input
                              type="text"
                              value={customTheme.rapidLineColor}
                              onChange={(e) => setCustomTheme({ ...customTheme, rapidLineColor: e.target.value })}
                              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 font-mono text-[10px] text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Preview Box */}
                    <div className="lg:col-span-5 flex flex-col justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-xs text-slate-300 flex items-center gap-1.5">
                            <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            <span>{t.themeLivePreview || 'Live-Vorschau'}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">100% Dynamisch</span>
                        </div>

                        {/* Interactive UI Mockup Box */}
                        <div 
                          className="w-full h-36 rounded-lg p-2.5 border flex flex-col justify-between relative shadow-inner"
                          style={{
                            backgroundColor: customTheme.bgTone,
                            borderColor: customTheme.borderTone,
                            color: customTheme.textMain
                          }}
                        >
                          {/* Mock App Header */}
                          <div 
                            className="flex items-center justify-between px-2 py-1 rounded border text-[10px]"
                            style={{
                              backgroundColor: customTheme.surfaceTone,
                              borderColor: customTheme.borderTone,
                              color: customTheme.textMuted
                            }}
                          >
                            <span className="font-bold" style={{ color: customTheme.textMain }}>PlotterCNC Studio</span>
                            <div className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: customTheme.accentColor }} />
                              <span className="text-[9px]" style={{ color: customTheme.accentColor }}>BEREIT</span>
                            </div>
                          </div>

                          {/* Mock Workspace Canvas */}
                          <div 
                            className="relative w-full h-16 rounded border p-1 overflow-hidden"
                            style={{
                              backgroundColor: customTheme.surfaceTone,
                              borderColor: customTheme.borderTone,
                            }}
                          >
                            <svg className="w-full h-full" viewBox="0 0 160 45">
                              {/* Background grid */}
                              <line x1="20" y1="0" x2="20" y2="45" stroke={customTheme.borderTone} strokeWidth="0.8" strokeDasharray="2,2" />
                              <line x1="50" y1="0" x2="50" y2="45" stroke={customTheme.borderTone} strokeWidth="0.8" strokeDasharray="2,2" />
                              <line x1="80" y1="0" x2="80" y2="45" stroke={customTheme.borderTone} strokeWidth="0.8" strokeDasharray="2,2" />
                              <line x1="110" y1="0" x2="110" y2="45" stroke={customTheme.borderTone} strokeWidth="0.8" strokeDasharray="2,2" />
                              <line x1="140" y1="0" x2="140" y2="45" stroke={customTheme.borderTone} strokeWidth="0.8" strokeDasharray="2,2" />

                              {/* G0 Rapid Air Travel Line */}
                              <path d="M 10 35 L 40 12" stroke={customTheme.rapidLineColor} strokeWidth="1.4" strokeDasharray="3,3" />

                              {/* G1 Cut Vector Path */}
                              <path d="M 40 12 L 85 12 L 110 32 L 145 18" stroke={customTheme.cutLineColor} strokeWidth="2.4" fill="none" strokeLinecap="round" />

                              {/* Toolhead */}
                              <circle cx="145" cy="18" r="3.2" fill={customTheme.accentColor} />
                            </svg>
                          </div>

                          {/* Live Buttons & Slider Sample Controls */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between text-[9px]">
                              <span style={{ color: customTheme.textMuted }}>Slider / Regler ({demoSliderVal}%):</span>
                              <span className="font-mono font-bold" style={{ color: customTheme.accentColor }}>{demoSliderVal} mm/s</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="100"
                                value={demoSliderVal}
                                onChange={(e) => setDemoSliderVal(Number(e.target.value))}
                                className="flex-1 h-1.5 rounded-lg cursor-pointer"
                                style={{ accentColor: customTheme.accentColor }}
                              />
                            </div>

                            <div className="flex items-center gap-1.5 pt-0.5">
                              <button
                                type="button"
                                className="flex-1 py-1 rounded text-[10px] font-bold shadow-xs transition-transform active:scale-95"
                                style={{
                                  backgroundColor: customTheme.accentColor,
                                  color: customTheme.isDark && customTheme.accentColor !== '#e4e4e7' && customTheme.accentColor !== '#f5f5f7' ? '#ffffff' : '#09090b'
                                }}
                              >
                                Primär-Button
                              </button>
                              <button
                                type="button"
                                className="px-2.5 py-1 rounded text-[10px] border transition-transform active:scale-95"
                                style={{
                                  backgroundColor: customTheme.surfaceTone,
                                  borderColor: customTheme.borderTone,
                                  color: customTheme.textMain
                                }}
                              >
                                Sekundär
                              </button>
                              <div
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold border"
                                style={{
                                  borderColor: customTheme.accentColor,
                                  color: customTheme.accentColor,
                                  backgroundColor: 'rgba(0,0,0,0.1)'
                                }}
                              >
                                Aktiv
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800/80 mt-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={handleCopyThemeJson}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1"
                            title="JSON kopieren"
                          >
                            {copiedJson ? <CheckCheck className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={handleExportThemeJson}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1"
                            title="Als Datei exportieren"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <input
                            type="file"
                            ref={themeFileInputRef}
                            onChange={handleImportThemeFile}
                            accept=".json"
                            className="hidden"
                          />

                          <button
                            onClick={() => themeFileInputRef.current?.click()}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 text-xs flex items-center gap-1"
                            title="Palette importieren"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <button
                          onClick={() => handleApplyCustomTheme(customTheme)}
                          className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-bold transition-colors shadow-md flex items-center gap-1.5 text-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Design Anwenden</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LANGUAGE & UNITS */}
          {activeTab === 'language' && (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-sm text-slate-100 mb-2">Sprache / Language</h3>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    onClick={() => handleSelectLanguage('de')}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      currentLang === 'de'
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-slate-800'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🇩🇪</span>
                      <span className="font-semibold text-xs text-slate-200">Deutsch</span>
                    </div>
                    {currentLang === 'de' && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>

                  <button
                    onClick={() => handleSelectLanguage('en')}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                      currentLang === 'en'
                        ? 'border-indigo-500 ring-2 ring-indigo-500/40 bg-slate-800'
                        : 'border-slate-800 bg-slate-950/60 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">🇬🇧</span>
                      <span className="font-semibold text-xs text-slate-200">English</span>
                    </div>
                    {currentLang === 'en' && <Check className="w-4 h-4 text-indigo-400" />}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <h4 className="font-semibold text-xs text-slate-200">Maßeinheiten</h4>
                <p className="text-[11px] text-slate-400">
                  Standardmäßig verwendet die Steuerung metrische Einheiten (Millimeter / mm, G21) gemäß CNC- und GRBL-Standard.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: SAFETY & CONTROLS */}
          {activeTab === 'safety' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Sicherheits- & Controller-Optionen</span>
                </h3>

                <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Sicherheitsabfrage vor Hochleistungs-Lasertests</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Soft-Limits beim manuellen Fahren (Jogging) prüfen</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                  />
                  <span>Status-Abfrageintervall (GRBL Realtime Status '?' alle 200ms)</span>
                </label>
              </div>

              {onOpenButtonsModal && (
                <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-xs text-slate-200">Benutzerdefinierte Schnell-Buttons</h4>
                    <p className="text-[11px] text-slate-400">Verwalte Makros, Framing und Tool-Tasten.</p>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenButtonsModal();
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Buttons Öffnen</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: BACKUP & RESTORE */}
          {activeTab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <HardDriveDownload className="w-4 h-4 text-indigo-400" />
                  <span>{t.fullBackupTitle || 'Komplett-Backup & System-Export'}</span>
                </h3>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  {t.fullBackupDesc || 'Exportiere alle Maschinenkonfigurationen, Parameterdatenbanken, Materialbibliotheken und Custom Buttons in eine einzige Datei.'}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleExportBackup}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium flex items-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t.btnExportFullConfig || 'Gesamte Konfiguration exportieren (.json)'}</span>
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImportBackupFile}
                    accept=".json"
                    className="hidden"
                  />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium flex items-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t.btnImportFullConfig || 'Konfiguration importieren'}</span>
                  </button>
                </div>
              </div>

              {/* Factory Reset */}
              <div className="p-4 bg-rose-950/30 border border-rose-900/60 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                  <h4 className="font-bold text-xs">Werkseinstellungen</h4>
                </div>
                <p className="text-rose-300/80 text-[11px]">
                  Setzt alle gespeicherten Maschinenprofile, Laser-Materialdaten und benutzerdefinierten Einstellungen zurück.
                </p>
                <div className="pt-1">
                  <button
                    onClick={handleResetFactory}
                    className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t.btnFactoryReset || 'Auf Werkseinstellungen zurücksetzen'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: ABOUT & DIAGNOSTICS */}
          {activeTab === 'about' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                <h3 className="font-bold text-sm text-slate-100">PlotterCNC Studio</h3>
                <p className="text-slate-400 text-[11px]">
                  Professionelle Open-Source GRBL 1.1h Steuersoftware mit Stift-Plotter, Schleppmesser-Kompensation und Laser-Cutter Generator.
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-mono text-slate-400">
                  <div>Protokoll: GRBL 1.1h / 1.1f</div>
                  <div>Verbindung: WebSerial API (115200 Baud)</div>
                  <div>Planer-Puffer: 15 Blöcke (128 Bytes RX)</div>
                  <div>Vektor-Formate: DXF, SVG, G-Code (.nc, .gcode)</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex justify-end text-xs">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};

