import { MachineProfile } from '../types/cnc';

const PROFILES_STORAGE_KEY = 'plotter_cnc_saved_profiles_v1';
const ACTIVE_PROFILE_STORAGE_KEY = 'plotter_cnc_active_profile_id_v1';

export const DEFAULT_PROFILES: MachineProfile[] = [
  {
    id: 'plotter_300x300',
    name: 'Standard Plotter (300 × 300 mm)',
    bedWidth: 300,
    bedHeight: 300,
    bedDepth: 20,
    origin: 'bottom_left',
    description: 'Klassische quadratische Arbeitsfläche für Stiftplotter & Schleppmesser.',
    travelFeedrate: 4000,
    drawingFeedrate: 2000,
  },
  {
    id: 'a4_bed',
    name: 'A4 Flachbett (297 × 210 mm)',
    bedWidth: 297,
    bedHeight: 210,
    bedDepth: 15,
    origin: 'bottom_left',
    description: 'Kompakte DIN A4 Arbeitsfläche für Dokumente, Zeichnungen & Karten.',
    travelFeedrate: 4000,
    drawingFeedrate: 2000,
  },
  {
    id: 'a3_bed',
    name: 'A3 Arbeitsbereich (420 × 297 mm)',
    bedWidth: 420,
    bedHeight: 297,
    bedDepth: 30,
    origin: 'bottom_left',
    description: 'Großzügiges DIN A3 Format für Poster, Pläne und Folienzuschnitte.',
    travelFeedrate: 3500,
    drawingFeedrate: 1800,
  },
  {
    id: 'laser_400x400',
    name: 'Laser Diode (400 × 400 mm)',
    bedWidth: 400,
    bedHeight: 400,
    bedDepth: 0,
    origin: 'bottom_left',
    description: 'Typische Diodenlaser-Fläche (z. B. Sculpfun, xTool, Ortur, Atomstack).',
    travelFeedrate: 5000,
    drawingFeedrate: 1500,
  },
  {
    id: 'cnc_3018',
    name: 'CNC 3018 (300 × 180 mm)',
    bedWidth: 300,
    bedHeight: 180,
    bedDepth: 45,
    origin: 'bottom_left',
    description: 'Klassischer CNC 3018 Gravier- und Frästisch mit hoher Z-Höhe.',
    travelFeedrate: 2500,
    drawingFeedrate: 1200,
  },
  {
    id: 'large_500x500',
    name: 'Großformat (500 × 500 mm)',
    bedWidth: 500,
    bedHeight: 500,
    bedDepth: 50,
    origin: 'bottom_left',
    description: 'Große Werkbank für Schilder, Werbetechnik und Großzeichnungen.',
    travelFeedrate: 4500,
    drawingFeedrate: 2200,
  },
  {
    id: 'custom_bed',
    name: 'Benutzerdefinierte Bauraumgröße',
    bedWidth: 250,
    bedHeight: 250,
    bedDepth: 25,
    origin: 'bottom_left',
    description: 'Frei konfigurierbare X-, Y- und Z-Abmessungen.',
    travelFeedrate: 3000,
    drawingFeedrate: 1500,
  },
];

/**
 * Loads all saved profiles from localStorage, merging with defaults
 */
export function loadSavedProfiles(): MachineProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILES;
    const parsed: MachineProfile[] = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to load machine profiles from localStorage', e);
  }
  return DEFAULT_PROFILES;
}

/**
 * Saves all profiles to localStorage
 */
export function saveAllProfiles(profiles: MachineProfile[]): void {
  try {
    localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.warn('Failed to save machine profiles to localStorage', e);
  }
}

/**
 * Saves or updates a single profile and returns the full list
 */
export function saveOrUpdateProfile(profile: MachineProfile): MachineProfile[] {
  const currentProfiles = loadSavedProfiles();
  const index = currentProfiles.findIndex(p => p.id === profile.id);
  let updated: MachineProfile[];
  if (index >= 0) {
    updated = [...currentProfiles];
    updated[index] = profile;
  } else {
    updated = [...currentProfiles, profile];
  }
  saveAllProfiles(updated);
  saveActiveProfileId(profile.id);
  return updated;
}

/**
 * Loads the active profile from localStorage
 */
export function loadActiveProfile(): MachineProfile {
  const profiles = loadSavedProfiles();
  try {
    const activeId = localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
    if (activeId) {
      const match = profiles.find(p => p.id === activeId);
      if (match) return match;
    }
  } catch (e) {
    console.warn('Failed to load active profile ID', e);
  }
  return profiles[0] || DEFAULT_PROFILES[0];
}

/**
 * Saves the active profile ID to localStorage
 */
export function saveActiveProfileId(id: string): void {
  try {
    localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, id);
  } catch (e) {
    console.warn('Failed to save active profile ID', e);
  }
}

