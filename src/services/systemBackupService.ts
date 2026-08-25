import { loadSavedProfiles, saveAllProfiles, loadActiveProfile, saveOrUpdateProfile } from './machineProfiles';
import { loadLaserPresets, saveLaserPresets } from './laserDatabaseService';
import { loadCustomButtons, saveCustomButtons } from './customButtonsService';
import { getSavedTheme, saveTheme, ThemeConfig } from './themeService';
import { getSavedLanguage, saveLanguage, Language } from './i18n';
import { MachineProfile } from '../types/cnc';

export interface FullSystemConfiguration {
  version: string;
  app: string;
  exportDate: string;
  machineProfiles: {
    profiles: MachineProfile[];
    activeProfileId: string;
  };
  laserDatabase: any[];
  customButtons: any[];
  theme: ThemeConfig;
  language: Language;
  appPreferences?: Record<string, any>;
}

export function exportFullSystemConfiguration(): string {
  const profiles = loadSavedProfiles();
  const activeProfile = loadActiveProfile();
  const laserPresets = loadLaserPresets();
  const customButtons = loadCustomButtons();
  const theme = getSavedTheme();
  const language = getSavedLanguage();

  const config: FullSystemConfiguration = {
    version: '1.0',
    app: 'PlotterCNC Studio',
    exportDate: new Date().toISOString(),
    machineProfiles: {
      profiles,
      activeProfileId: activeProfile.id,
    },
    laserDatabase: laserPresets,
    customButtons,
    theme,
    language,
  };

  return JSON.stringify(config, null, 2);
}

export function importFullSystemConfiguration(jsonString: string): {
  profileCount: number;
  laserCount: number;
  buttonCount: number;
  theme: string;
  language: string;
} {
  try {
    const config: FullSystemConfiguration = JSON.parse(jsonString);

    if (!config || typeof config !== 'object') {
      throw new Error('Ungültiges Backup-Format.');
    }

    // 1. Restore Machine Profiles
    if (config.machineProfiles && Array.isArray(config.machineProfiles.profiles)) {
      saveAllProfiles(config.machineProfiles.profiles);
      if (config.machineProfiles.activeProfileId) {
        localStorage.setItem('plotter_cnc_active_profile_id_v1', config.machineProfiles.activeProfileId);
      }
    }

    // 2. Restore Laser Material Database
    if (Array.isArray(config.laserDatabase)) {
      saveLaserPresets(config.laserDatabase);
    }

    // 3. Restore Custom Buttons
    if (Array.isArray(config.customButtons)) {
      saveCustomButtons(config.customButtons);
    }

    // 4. Restore Theme
    if (config.theme) {
      saveTheme(config.theme);
    }

    // 5. Restore Language
    if (config.language && (config.language === 'de' || config.language === 'en')) {
      saveLanguage(config.language);
    }

    return {
      profileCount: config.machineProfiles?.profiles?.length || 0,
      laserCount: config.laserDatabase?.length || 0,
      buttonCount: config.customButtons?.length || 0,
      theme: config.theme?.name || 'Standard',
      language: config.language || 'de',
    };
  } catch (err: any) {
    throw new Error('Import fehlgeschlagen: ' + err.message);
  }
}

export function resetAllToFactoryDefaults() {
  const keysToClear = [
    'plottercnc_machine_profiles',
    'plottercnc_active_profile_id',
    'plottercnc_laser_materials',
    'plottercnc_custom_buttons',
    'plottercnc_theme',
    'plottercnc_custom_theme',
    'plottercnc_language',
  ];

  for (const k of keysToClear) {
    localStorage.removeItem(k);
  }
}
