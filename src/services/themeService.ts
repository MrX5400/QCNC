export interface ThemeConfig {
  id: string;
  name: string;
  description?: string;
  category?: 'minimal' | 'classic' | 'light' | 'contrast';
  tag?: string;
  isDark: boolean;
  accentColor: string; // Hex e.g. #6366f1
  bgTone: string; // e.g. #090d16
  surfaceTone: string; // e.g. #0f172a
  borderTone: string; // e.g. #1e293b
  textMain: string;
  textMuted: string;
  cutLineColor: string;
  rapidLineColor: string;
  gridColor: string;
}

export const PRESET_THEMES: ThemeConfig[] = [
  // --- SCHLICHT & MINIMALISTISCH ---
  {
    id: 'monochrome_minimal',
    name: 'Monochrom Minimal (Schwarz-Weiß)',
    description: 'Reine Schwarz-, Grau- und Weißtöne ohne bunte Ablenkung für absolute Ruhe & Konzentration.',
    category: 'minimal',
    tag: 'Monochrom',
    isDark: true,
    accentColor: '#e4e4e7',
    bgTone: '#101114',
    surfaceTone: '#18191e',
    borderTone: '#272830',
    textMain: '#fafafa',
    textMuted: '#a1a1aa',
    cutLineColor: '#f4f4f5',
    rapidLineColor: '#71717a',
    gridColor: 'rgba(63, 63, 70, 0.4)',
  },
  {
    id: 'graphite_matte',
    name: 'Graphit Studio (Matter Anthrazit)',
    description: 'Matter, dunkler Graphit-Look mit sanftem Smaragd-Schnitt für ermüdungsfreies Arbeiten.',
    category: 'minimal',
    tag: 'Schlicht',
    isDark: true,
    accentColor: '#64748b',
    bgTone: '#14161a',
    surfaceTone: '#1c2026',
    borderTone: '#2c323d',
    textMain: '#f1f5f9',
    textMuted: '#94a3b8',
    cutLineColor: '#10b981',
    rapidLineColor: '#f43f5e',
    gridColor: 'rgba(51, 65, 85, 0.35)',
  },
  {
    id: 'titanium_slate',
    name: 'Titanium & Slate (Kühles Grau)',
    description: 'Kühles Werkstatt-Titangrau mit dezenten Eisblau-Akzenten und klaren Konturen.',
    category: 'minimal',
    tag: 'Schlicht',
    isDark: true,
    accentColor: '#94a3b8',
    bgTone: '#181b20',
    surfaceTone: '#22262e',
    borderTone: '#313742',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    cutLineColor: '#38bdf8',
    rapidLineColor: '#fb7185',
    gridColor: 'rgba(71, 85, 105, 0.35)',
  },
  {
    id: 'oled_stealth',
    name: 'OLED Stealth (Tiefschwarz Minimal)',
    description: 'Echtes Tiefschwarz (#000000) für OLED-Displays mit dezenten, klaren Vektorlinien.',
    category: 'minimal',
    tag: 'Tiefschwarz',
    isDark: true,
    accentColor: '#10b981',
    bgTone: '#000000',
    surfaceTone: '#0a0a0c',
    borderTone: '#202026',
    textMain: '#f4f4f5',
    textMuted: '#71717a',
    cutLineColor: '#22c55e',
    rapidLineColor: '#ef4444',
    gridColor: 'rgba(39, 39, 42, 0.55)',
  },

  // --- SCHLICHTE HELLE DESIGNS (LIGHT MODES) ---
  {
    id: 'minimal_paper',
    name: 'Minimal Paper & Ink (Heller Minimalismus)',
    description: 'Schlichtes helles Studio-Papier mit feinem Anthrazit-Kontrast und dezenten Schnittbahnen.',
    category: 'light',
    tag: 'Hell',
    isDark: false,
    accentColor: '#18181b',
    bgTone: '#f5f5f7',
    surfaceTone: '#ffffff',
    borderTone: '#e4e4e7',
    textMain: '#18181b',
    textMuted: '#71717a',
    cutLineColor: '#0f766e',
    rapidLineColor: '#b91c1c',
    gridColor: 'rgba(212, 212, 216, 0.65)',
  },
  {
    id: 'nordic_frost',
    name: 'Nordic Frost (Sanftes Hellgrau)',
    description: 'Klares arktisches Hellgrau mit ruhigen Himmelsblau-Akzenten für helle Arbeitsumgebungen.',
    category: 'light',
    tag: 'Hell',
    isDark: false,
    accentColor: '#0284c7',
    bgTone: '#f8fafc',
    surfaceTone: '#ffffff',
    borderTone: '#cbd5e1',
    textMain: '#0f172a',
    textMuted: '#64748b',
    cutLineColor: '#0d9488',
    rapidLineColor: '#e11d48',
    gridColor: 'rgba(203, 213, 225, 0.65)',
  },

  // --- KLASSISCH & WERKSTATT ---
  {
    id: 'slate_industrial',
    name: 'Industrial Slate (Standard)',
    description: 'Ausgewogenes Schieferblau mit dezenten Indigo-Akzenten und hoher Lesbarkeit.',
    category: 'classic',
    tag: 'Standard',
    isDark: true,
    accentColor: '#6366f1',
    bgTone: '#090d16',
    surfaceTone: '#0f172a',
    borderTone: '#1e293b',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    cutLineColor: '#10b981',
    rapidLineColor: '#ef4444',
    gridColor: 'rgba(51, 65, 85, 0.4)',
  },
  {
    id: 'cnc_steel',
    name: 'CNC Steel & Mill (Werkstatt Stahl)',
    description: 'Maschinenbau-Look in kühlem Werkzeugstahl mit ruhigen blauen Akzenten.',
    category: 'classic',
    tag: 'Werkstatt',
    isDark: true,
    accentColor: '#3b82f6',
    bgTone: '#111418',
    surfaceTone: '#1a1f26',
    borderTone: '#2b333e',
    textMain: '#e6edf3',
    textMuted: '#8b949e',
    cutLineColor: '#22c55e',
    rapidLineColor: '#f85149',
    gridColor: 'rgba(48, 54, 61, 0.5)',
  },
  {
    id: 'cad_blueprint',
    name: 'CAD Blueprint (Präzision)',
    description: 'Klassisches Technisches CAD-Blau mit feinen Cyan-Vektorlinien.',
    category: 'classic',
    tag: 'CAD',
    isDark: true,
    accentColor: '#38bdf8',
    bgTone: '#0a1120',
    surfaceTone: '#0f1d36',
    borderTone: '#1e3256',
    textMain: '#e0f2fe',
    textMuted: '#7dd3fc',
    cutLineColor: '#00f0ff',
    rapidLineColor: '#f43f5e',
    gridColor: 'rgba(14, 116, 144, 0.4)',
  },

  // --- KONTRAST & SPEZIAL ---
  {
    id: 'amber_retro',
    name: 'Amber CNC Terminal (Retro)',
    description: 'Monochromes Bernstein-Terminal für augenschonenden Kontrast in dunklen Werkstätten.',
    category: 'contrast',
    tag: 'Retro',
    isDark: true,
    accentColor: '#f59e0b',
    bgTone: '#120d04',
    surfaceTone: '#1f1606',
    borderTone: '#3f2c0b',
    textMain: '#fef3c7',
    textMuted: '#fbbf24',
    cutLineColor: '#fbbf24',
    rapidLineColor: '#ef4444',
    gridColor: 'rgba(180, 83, 9, 0.3)',
  },
  {
    id: 'laser_crimson',
    name: 'Laser Crimson (Sicherheit)',
    description: 'Hoher Kontrast mit Laser-Warnrot, optimiert für Laserschutzbrillen.',
    category: 'contrast',
    tag: 'Laser',
    isDark: true,
    accentColor: '#e11d48',
    bgTone: '#0f0507',
    surfaceTone: '#1a0b0e',
    borderTone: '#38131b',
    textMain: '#ffe4e6',
    textMuted: '#fb7185',
    cutLineColor: '#f43f5e',
    rapidLineColor: '#38bdf8',
    gridColor: 'rgba(190, 18, 60, 0.3)',
  },
  {
    id: 'cyberpunk_neon',
    name: 'Cyberpunk Neon (Cyan & Pink)',
    description: 'Satte Kontrastfarben mit Cyan und Magenta.',
    category: 'contrast',
    tag: 'Neon',
    isDark: true,
    accentColor: '#06b6d4',
    bgTone: '#0d0221',
    surfaceTone: '#150836',
    borderTone: '#2d1469',
    textMain: '#fdf4ff',
    textMuted: '#d946ef',
    cutLineColor: '#06b6d4',
    rapidLineColor: '#f43f5e',
    gridColor: 'rgba(147, 51, 234, 0.35)',
  },
];

const STORAGE_KEY_THEME = 'plottercnc_theme';
const STORAGE_KEY_CUSTOM_THEME = 'plottercnc_custom_theme';

export function getSavedTheme(): ThemeConfig {
  try {
    const custom = localStorage.getItem(STORAGE_KEY_CUSTOM_THEME);
    if (custom) {
      return JSON.parse(custom);
    }
    const themeId = localStorage.getItem(STORAGE_KEY_THEME);
    const found = PRESET_THEMES.find(t => t.id === themeId);
    if (found) return found;
  } catch (e) {
    // Ignore
  }
  return PRESET_THEMES[0];
}

export function saveTheme(theme: ThemeConfig) {
  try {
    if (theme.id === 'custom') {
      localStorage.setItem(STORAGE_KEY_CUSTOM_THEME, JSON.stringify(theme));
      localStorage.setItem(STORAGE_KEY_THEME, 'custom');
    } else {
      localStorage.removeItem(STORAGE_KEY_CUSTOM_THEME);
      localStorage.setItem(STORAGE_KEY_THEME, theme.id);
    }
    applyThemeCssVars(theme);
  } catch (e) {
    // Ignore
  }
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = (hex || '').replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map(c => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length !== 6) return { r: 99, g: 102, b: 241 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function getContrastTextColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  // Perceived relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#09090b' : '#ffffff';
}

export function adjustHexBrightness(hex: string, percent: number): string {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 + percent / 100;
  const newR = Math.max(0, Math.min(255, Math.round(r * factor)));
  const newG = Math.max(0, Math.min(255, Math.round(g * factor)));
  const newB = Math.max(0, Math.min(255, Math.round(b * factor)));
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export function applyThemeCssVars(theme: ThemeConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  
  const accentRgb = hexToRgb(theme.accentColor);
  const surfaceRgb = hexToRgb(theme.surfaceTone);
  const borderRgb = hexToRgb(theme.borderTone);
  const bgRgb = hexToRgb(theme.bgTone);
  
  const accentText = getContrastTextColor(theme.accentColor);
  const accentHover = adjustHexBrightness(theme.accentColor, theme.isDark ? 12 : -12);
  const accentActive = adjustHexBrightness(theme.accentColor, theme.isDark ? -10 : 10);
  const surfaceHover = adjustHexBrightness(theme.surfaceTone, theme.isDark ? 15 : -8);
  const borderHover = adjustHexBrightness(theme.borderTone, theme.isDark ? 20 : -15);

  root.style.setProperty('--app-accent', theme.accentColor);
  root.style.setProperty('--app-accent-hover', accentHover);
  root.style.setProperty('--app-accent-active', accentActive);
  root.style.setProperty('--app-accent-text', accentText);
  root.style.setProperty('--app-accent-rgb', `${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}`);
  root.style.setProperty('--app-accent-10', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.10)`);
  root.style.setProperty('--app-accent-15', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.15)`);
  root.style.setProperty('--app-accent-20', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.20)`);
  root.style.setProperty('--app-accent-30', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.30)`);
  root.style.setProperty('--app-accent-40', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.40)`);
  root.style.setProperty('--app-accent-50', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.50)`);
  root.style.setProperty('--app-accent-80', `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.80)`);

  root.style.setProperty('--app-bg', theme.bgTone);
  root.style.setProperty('--app-bg-rgb', `${bgRgb.r}, ${bgRgb.g}, ${bgRgb.b}`);
  
  root.style.setProperty('--app-surface', theme.surfaceTone);
  root.style.setProperty('--app-surface-hover', surfaceHover);
  root.style.setProperty('--app-surface-rgb', `${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}`);

  root.style.setProperty('--app-border', theme.borderTone);
  root.style.setProperty('--app-border-hover', borderHover);
  root.style.setProperty('--app-border-rgb', `${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}`);

  root.style.setProperty('--app-text', theme.textMain);
  root.style.setProperty('--app-text-muted', theme.textMuted);
  root.style.setProperty('--app-cut-line', theme.cutLineColor || '#10b981');
  root.style.setProperty('--app-rapid-line', theme.rapidLineColor || '#ef4444');
  root.style.setProperty('--app-grid', theme.gridColor || 'rgba(51, 65, 85, 0.4)');

  root.setAttribute('data-theme', theme.id);

  if (!theme.isDark) {
    root.classList.add('light');
    root.classList.remove('dark');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
  }
}
