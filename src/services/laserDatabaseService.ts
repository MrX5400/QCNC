export type LaserOperation = 'cut' | 'engrave' | 'score';

export type LaserCategory = 
  | 'Wood' 
  | 'Acrylic' 
  | 'Paper & Cardboard' 
  | 'Leather & Fabric' 
  | 'Stone & Coated Metal' 
  | 'Foam & Plastics' 
  | 'Custom';

export interface LaserMaterialPreset {
  id: string;
  name: string;
  category: LaserCategory;
  operation: LaserOperation;
  thicknessMm: number; // e.g. 3.0 mm (0 for surface engraving)
  feedrate: number; // mm/min (speed)
  powerPercent: number; // 0 - 100%
  powerSValue?: number; // S-value (e.g. 0-1000)
  passes: number; // number of passes
  zStepPerPass?: number; // mm to lower Z per pass
  airAssist: boolean; // M8 air assist active
  laserMode: 'M3' | 'M4'; // Dynamic M4 vs Constant M3
  recommendedLaserWattage?: string; // e.g. "10W Diode", "20W Diode", "40W CO2"
  notes?: string;
  isBuiltIn?: boolean;
}

export const DEFAULT_LASER_PRESETS: LaserMaterialPreset[] = [
  // --- Holz / Wood ---
  {
    id: 'wood-birch-plywood-3mm-cut',
    name: 'Birkensperrholz 3.0 mm (Schneiden)',
    category: 'Wood',
    operation: 'cut',
    thicknessMm: 3.0,
    feedrate: 350,
    powerPercent: 95,
    powerSValue: 950,
    passes: 2,
    zStepPerPass: 0.8,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Mit Air Assist und Wabenplatte für saubere, brandfreie Kanten.',
    isBuiltIn: true,
  },
  {
    id: 'wood-birch-plywood-3mm-engrave',
    name: 'Birkensperrholz 3.0 mm (Flächengravur)',
    category: 'Wood',
    operation: 'engrave',
    thicknessMm: 3.0,
    feedrate: 2400,
    powerPercent: 45,
    powerSValue: 450,
    passes: 1,
    zStepPerPass: 0,
    airAssist: false,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode',
    notes: 'Geringer Air Assist verhindert Schmauchspuren bei feinen Vektorgravuren.',
    isBuiltIn: true,
  },
  {
    id: 'wood-balsa-4mm-cut',
    name: 'Balsaholz 4.0 mm (Leichtbau Schnitt)',
    category: 'Wood',
    operation: 'cut',
    thicknessMm: 4.0,
    feedrate: 600,
    powerPercent: 80,
    powerSValue: 800,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '5W - 10W Diode',
    notes: 'Sehr weiches Holz, schneidet extrem leicht in einem Durchgang.',
    isBuiltIn: true,
  },
  {
    id: 'wood-mdf-3mm-cut',
    name: 'MDF / HDF 3.0 mm (Schneiden)',
    category: 'Wood',
    operation: 'cut',
    thicknessMm: 3.0,
    feedrate: 280,
    powerPercent: 100,
    powerSValue: 1000,
    passes: 3,
    zStepPerPass: 0.6,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Hoher Klebstoffanteil in MDF erfordert starken Air Assist und mehrere Durchgänge.',
    isBuiltIn: true,
  },
  {
    id: 'wood-walnut-2mm-score',
    name: 'Nussbaum Echtholzfurnier 2.0 mm (Anritzen / Vektormarkierung)',
    category: 'Wood',
    operation: 'score',
    thicknessMm: 2.0,
    feedrate: 1800,
    powerPercent: 30,
    powerSValue: 300,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode',
    notes: 'Feine Vektorlinien ohne Durchtrennung des Materials.',
    isBuiltIn: true,
  },

  // --- Acryl / Plexiglas ---
  {
    id: 'acrylic-black-3mm-cut',
    name: 'Schwarzes / Dunkles Acryl 3.0 mm (Schneiden)',
    category: 'Acrylic',
    operation: 'cut',
    thicknessMm: 3.0,
    feedrate: 220,
    powerPercent: 90,
    powerSValue: 900,
    passes: 2,
    zStepPerPass: 0.7,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Diodenlaser (450nm) absorbieren dunkles und farbiges Acryl hervorragend. Schutzfolie vorher abziehen.',
    isBuiltIn: true,
  },
  {
    id: 'acrylic-engrave-surface',
    name: 'Acryl / Plexiglas (Oberflächengravur)',
    category: 'Acrylic',
    operation: 'engrave',
    thicknessMm: 3.0,
    feedrate: 2000,
    powerPercent: 35,
    powerSValue: 350,
    passes: 1,
    zStepPerPass: 0,
    airAssist: false,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode / CO2',
    notes: 'Erzeugt mattweiße Gravuren auf dunklem Acryl oder LED-Kantenbeleuchtungen.',
    isBuiltIn: true,
  },

  // --- Papier & Pappe ---
  {
    id: 'paper-cardstock-300g-cut',
    name: 'Tonpapier / Fotokarton 300g/m² (Schneiden)',
    category: 'Paper & Cardboard',
    operation: 'cut',
    thicknessMm: 0.4,
    feedrate: 1800,
    powerPercent: 40,
    powerSValue: 400,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '5W - 10W Diode',
    notes: 'Schneller Schnitt, Air Assist verhindert Brandspuren an den Papierkanten.',
    isBuiltIn: true,
  },
  {
    id: 'paper-corrugated-cardboard-2mm-cut',
    name: 'Wellpappe 2.0 mm (Schneiden)',
    category: 'Paper & Cardboard',
    operation: 'cut',
    thicknessMm: 2.0,
    feedrate: 1200,
    powerPercent: 60,
    powerSValue: 600,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode',
    notes: 'Wabenmuster erfordert kontinuierlichen Vorschub.',
    isBuiltIn: true,
  },
  {
    id: 'paper-kraft-score',
    name: 'Kraftpapier (Falzlinien / Anritzen)',
    category: 'Paper & Cardboard',
    operation: 'score',
    thicknessMm: 0.3,
    feedrate: 2500,
    powerPercent: 15,
    powerSValue: 150,
    passes: 1,
    zStepPerPass: 0,
    airAssist: false,
    laserMode: 'M4',
    recommendedLaserWattage: '5W Diode',
    notes: 'Perfekt zum Anritzen von Knick- und Faltkanten für Verpackungen.',
    isBuiltIn: true,
  },

  // --- Leder & Stoff ---
  {
    id: 'leather-veg-tan-1_5mm-cut',
    name: 'Pflanzlich gegerbtes Echtleder 1.5 mm (Schneiden)',
    category: 'Leather & Fabric',
    operation: 'cut',
    thicknessMm: 1.5,
    feedrate: 450,
    powerPercent: 85,
    powerSValue: 850,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Gute Absaugung / Belüftung erforderlich. Kanten nach Schnitt mit Lederbalsam polieren.',
    isBuiltIn: true,
  },
  {
    id: 'leather-engrave',
    name: 'Echtleder & Kunstleder (Feingravur)',
    category: 'Leather & Fabric',
    operation: 'engrave',
    thicknessMm: 2.0,
    feedrate: 2600,
    powerPercent: 25,
    powerSValue: 250,
    passes: 1,
    zStepPerPass: 0,
    airAssist: false,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode',
    notes: 'Dunkelt die Oberfläche kontrolliert ab.',
    isBuiltIn: true,
  },

  // --- Stein & Beschichtetes Metall ---
  {
    id: 'stone-slate-coaster-engrave',
    name: 'Schieferplatten / Schieferuntersetzer (Gravur)',
    category: 'Stone & Coated Metal',
    operation: 'engrave',
    thicknessMm: 5.0,
    feedrate: 1500,
    powerPercent: 75,
    powerSValue: 750,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Erzeugt einen extrem kontrastreichen, hellweißen Kontrast auf natürlichem Schiefer.',
    isBuiltIn: true,
  },
  {
    id: 'metal-anodized-aluminum-engrave',
    name: 'Eloxiertes Aluminium (Laser-Abtrag / Visitenkarten)',
    category: 'Stone & Coated Metal',
    operation: 'engrave',
    thicknessMm: 0.5,
    feedrate: 1800,
    powerPercent: 65,
    powerSValue: 650,
    passes: 1,
    zStepPerPass: 0,
    airAssist: false,
    laserMode: 'M4',
    recommendedLaserWattage: '10W - 20W Diode',
    notes: 'Trägt die Eloxalschicht ab und legt das blanke Aluminium frei.',
    isBuiltIn: true,
  },

  // --- Schaumstoff & EVA ---
  {
    id: 'foam-eva-5mm-cut',
    name: 'EVA Schaumstoff / Moosgummi 5.0 mm (Cosplay Schnitt)',
    category: 'Foam & Plastics',
    operation: 'cut',
    thicknessMm: 5.0,
    feedrate: 700,
    powerPercent: 70,
    powerSValue: 700,
    passes: 1,
    zStepPerPass: 0,
    airAssist: true,
    laserMode: 'M4',
    recommendedLaserWattage: '10W Diode',
    notes: 'Schneidet sehr sauber mit minimalem Abbrand.',
    isBuiltIn: true,
  }
];

const LOCAL_STORAGE_KEY = 'plotter_laser_materials_db_v1';

export function loadLaserPresets(): LaserMaterialPreset[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_LASER_PRESETS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('Fehler beim Laden der Laser-Materialdatenbank:', e);
  }
  return DEFAULT_LASER_PRESETS;
}

export function saveLaserPresets(presets: LaserMaterialPreset[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(presets));
  } catch (e) {
    console.error('Fehler beim Speichern der Laser-Materialdatenbank:', e);
  }
}

export function resetLaserPresetsToDefault(): LaserMaterialPreset[] {
  saveLaserPresets(DEFAULT_LASER_PRESETS);
  return DEFAULT_LASER_PRESETS;
}

export function addOrUpdateLaserPreset(preset: LaserMaterialPreset): LaserMaterialPreset[] {
  const current = loadLaserPresets();
  const existingIdx = current.findIndex(p => p.id === preset.id);
  let updated: LaserMaterialPreset[];
  if (existingIdx !== -1) {
    updated = [...current];
    updated[existingIdx] = preset;
  } else {
    updated = [preset, ...current];
  }
  saveLaserPresets(updated);
  return updated;
}

export function deleteLaserPreset(id: string): LaserMaterialPreset[] {
  const current = loadLaserPresets();
  const updated = current.filter(p => p.id !== id);
  saveLaserPresets(updated);
  return updated;
}
