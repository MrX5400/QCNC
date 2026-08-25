import { MachineProfile, ParsedGcode } from '../types/cnc';
import { grbl } from './grblService';

export type MacroCategory = 'homing_zero' | 'motion' | 'laser_spindle' | 'utility' | 'custom';

export interface CustomButton {
  id: string;
  name: string;
  description?: string;
  category: MacroCategory;
  command: string;
  color: 'indigo' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'purple' | 'slate' | 'blue' | 'teal';
  icon: string;
  requireConfirmation?: boolean;
  isVisible: boolean;
  order: number;
}

export const MACRO_CATEGORIES: { id: MacroCategory | 'all'; label: string; icon: string }[] = [
  { id: 'all', label: 'Alle Makros', icon: 'Layers' },
  { id: 'homing_zero', label: 'Nullpunkte & Homing', icon: 'Crosshair' },
  { id: 'motion', label: 'Verfahren & Parken', icon: 'Navigation' },
  { id: 'laser_spindle', label: 'Laser & Werkzeug', icon: 'Flame' },
  { id: 'utility', label: 'Steuerung & Tools', icon: 'Zap' },
  { id: 'custom', label: 'Eigene Makros', icon: 'Sparkles' },
];

export const DEFAULT_CUSTOM_BUTTONS: CustomButton[] = [
  {
    id: 'btn_framing',
    name: 'Framing (Umrahmung)',
    description: 'Fährt den Außenrahmen des aktuellen Motivs mit gehobenem Werkzeug ab zur exakten Ausrichtung.',
    category: 'motion',
    command: 'FRAMING_ACTION',
    color: 'purple',
    icon: 'Square',
    requireConfirmation: false,
    isVisible: true,
    order: 0,
  },
  {
    id: 'btn_zero_xy',
    name: 'Nullpunkt X/Y setzen',
    description: 'Setzt die aktuelle X/Y Position als Werkstück-Nullpunkt (G10 L20 P1 X0 Y0).',
    category: 'homing_zero',
    command: 'G10 L20 P1 X0 Y0',
    color: 'cyan',
    icon: 'Crosshair',
    requireConfirmation: false,
    isVisible: true,
    order: 1,
  },
  {
    id: 'btn_zero_z',
    name: 'Nullpunkt Z setzen',
    description: 'Setzt die aktuelle Z-Höhe als Werkstück-Nullpunkt (G10 L20 P1 Z0).',
    category: 'homing_zero',
    command: 'G10 L20 P1 Z0',
    color: 'cyan',
    icon: 'Target',
    requireConfirmation: false,
    isVisible: true,
    order: 2,
  },
  {
    id: 'btn_zero_all',
    name: 'Alle Achsen Nullen (X0 Y0 Z0)',
    description: 'Setzt X, Y und Z gleichzeitig als Werkstück-Nullpunkt (G10 L20 P1 X0 Y0 Z0).',
    category: 'homing_zero',
    command: 'G10 L20 P1 X0 Y0 Z0',
    color: 'teal',
    icon: 'Target',
    requireConfirmation: false,
    isVisible: true,
    order: 3,
  },
  {
    id: 'btn_park',
    name: 'Parkposition anfahren',
    description: 'Hebt Werkzeug sicher an und fährt in die hintere linke Parkposition.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 Z{penUpZ}\nG0 X5 Y{bedHeightMinus10} F{travelFeedrate}',
    color: 'slate',
    icon: 'Navigation',
    requireConfirmation: false,
    isVisible: true,
    order: 4,
  },
  {
    id: 'btn_bed_center',
    name: 'Tischmitte anfahren',
    description: 'Fährt das Werkzeug mittig in den Arbeitsbereich der Baufläche.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 Z{penUpZ}\nG0 X{bedCenterX} Y{bedCenterY} F{travelFeedrate}',
    color: 'indigo',
    icon: 'Move',
    requireConfirmation: false,
    isVisible: true,
    order: 5,
  },
  {
    id: 'btn_return_wzero',
    name: 'Zu Werkstück-Nullpunkt (0,0)',
    description: 'Fährt das Werkzeug bei sicherer Höhe zum aktuellen Werkstück-Nullpunkt.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 Z{penUpZ}\nG0 X0 Y0 F{travelFeedrate}',
    color: 'indigo',
    icon: 'Home',
    requireConfirmation: false,
    isVisible: true,
    order: 6,
  },
  {
    id: 'btn_laser_pulse',
    name: 'Laser Test-Puls (1s @ 1%)',
    description: 'Zündet den Laser für 1 Sekunde mit minimaler Leistung zur Fokus- und Positionierungsprüfung.',
    category: 'laser_spindle',
    command: 'M3 S10\nG4 P1\nM5',
    color: 'rose',
    icon: 'Flame',
    requireConfirmation: true,
    isVisible: true,
    order: 7,
  },
  {
    id: 'btn_laser_cross',
    name: 'Laser Fokus-Puls (0.5s)',
    description: 'Sehr kurzer 0.5s Laser-Puls für minimale Materialmarkierung beim Ausrichten.',
    category: 'laser_spindle',
    command: 'M3 S5\nG4 P0.5\nM5',
    color: 'rose',
    icon: 'Zap',
    requireConfirmation: true,
    isVisible: false,
    order: 8,
  },
  {
    id: 'btn_tool_off',
    name: 'Spindel / Laser AUS (M5)',
    description: 'Schaltet Spindel, Laser und Werkzeug sofort sicher aus.',
    category: 'laser_spindle',
    command: 'M5',
    color: 'rose',
    icon: 'Power',
    requireConfirmation: false,
    isVisible: true,
    order: 9,
  },
  {
    id: 'btn_air_assist',
    name: 'Air Assist Umschalten',
    description: 'Schaltet Druckluft / Absaugung (M8 / M9) ein oder aus.',
    category: 'laser_spindle',
    command: 'AIR_ASSIST_TOGGLE',
    color: 'cyan',
    icon: 'Wind',
    requireConfirmation: false,
    isVisible: true,
    order: 10,
  },
  {
    id: 'btn_pen_test',
    name: 'Stift-Hub Test (Auf & Ab)',
    description: 'Testet den Stifthebe-Mechanismus mit 1 Sekunde Pause.',
    category: 'utility',
    command: '{penDownCommand}\nG4 P1\n{penUpCommand}',
    color: 'purple',
    icon: 'PenTool',
    requireConfirmation: false,
    isVisible: true,
    order: 11,
  },
  {
    id: 'btn_unlock',
    name: 'Alarm Entsperren ($X)',
    description: 'Löst den GRBL Alarmzustand nach Homing oder Endschalterauslösung auf.',
    category: 'utility',
    command: '$X',
    color: 'amber',
    icon: 'Unlock',
    requireConfirmation: false,
    isVisible: true,
    order: 12,
  },
  {
    id: 'btn_home',
    name: 'Referenzfahrt ($H)',
    description: 'Startet den automatischen Homing-Zyklus an den Endschaltern der Maschine.',
    category: 'homing_zero',
    command: '$H',
    color: 'emerald',
    icon: 'Home',
    requireConfirmation: true,
    isVisible: true,
    order: 13,
  },
  {
    id: 'btn_soft_reset',
    name: 'GRBL Soft-Reset',
    description: 'Sendet das Echtzeit-Reset-Steuerzeichen (Ctrl+X / 0x18) zur Notunterbrechung.',
    category: 'utility',
    command: 'GRBL_SOFT_RESET',
    color: 'amber',
    icon: 'RotateCcw',
    requireConfirmation: true,
    isVisible: true,
    order: 14,
  },
  {
    id: 'btn_probe_z',
    name: 'Z-Tastplatte antasten',
    description: 'Startet den Antastzyklus mit Touch-Plate (G38.2 Z-30 F100).',
    category: 'homing_zero',
    command: 'G91\nG38.2 Z-30 F100\nG90\nG10 L20 P1 Z0\nG91\nG0 Z5\nG90',
    color: 'emerald',
    icon: 'Zap',
    requireConfirmation: true,
    isVisible: false,
    order: 15,
  },
  {
    id: 'btn_query_state',
    name: 'G-Code Status abfragen ($G)',
    description: 'Liest aktive G-Code Modi (G0, G1, G90, G91, G54, etc.) von GRBL aus.',
    category: 'utility',
    command: '$G',
    color: 'slate',
    icon: 'Info',
    requireConfirmation: false,
    isVisible: false,
    order: 16,
  },
  {
    id: 'btn_test_square',
    name: '100x100mm Test-Quadrat',
    description: 'Fährt ein 100mm x 100mm Quadrat ab zur schnellen Maßstabs- und Rechtwinkligkeitsprüfung.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 X10 Y10 F{travelFeedrate}\n{penDownCommand}\nG1 X110 Y10 F{drawingFeedrate}\nG1 X110 Y110\nG1 X10 Y110\nG1 X10 Y10\n{penUpCommand}\nG0 X0 Y0 F{travelFeedrate}',
    color: 'blue',
    icon: 'Square',
    requireConfirmation: true,
    isVisible: false,
    order: 17,
  }
];

export const MACRO_TEMPLATES_LIBRARY: Omit<CustomButton, 'id' | 'order' | 'isVisible'>[] = [
  {
    name: 'Parken Hinten-Rechts',
    description: 'Fährt das Werkzeug in die hintere rechte Ecke der Baufläche.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 Z{penUpZ}\nG0 X{bedWidthMinus10} Y{bedHeightMinus10} F{travelFeedrate}',
    color: 'slate',
    icon: 'Navigation',
    requireConfirmation: false,
  },
  {
    name: 'Parken Vorne-Links',
    description: 'Fährt das Werkzeug in die vordere linke Ecke zur bequemen Materialentnahme.',
    category: 'motion',
    command: 'G90\n{penUpCommand}\nG0 Z{penUpZ}\nG0 X5 Y5 F{travelFeedrate}',
    color: 'slate',
    icon: 'CornerDownLeft',
    requireConfirmation: false,
  },
  {
    name: 'WCS G54 Wechsel',
    description: 'Aktiviert das Standard-Koordinatensystem 1 (G54).',
    category: 'homing_zero',
    command: 'G54',
    color: 'indigo',
    icon: 'Crosshair',
    requireConfirmation: false,
  },
  {
    name: 'WCS G55 Wechsel',
    description: 'Aktiviert das zweite Werkstück-Koordinatensystem (G55).',
    category: 'homing_zero',
    command: 'G55',
    color: 'indigo',
    icon: 'Crosshair',
    requireConfirmation: false,
  },
  {
    name: 'Spindel Vorlauf 3000 RPM (M3 S3000)',
    description: 'Startet die Spindel mit 3000 U/min und wartet 3 Sekunden auf Drehzahl.',
    category: 'laser_spindle',
    command: 'M3 S3000\nG4 P3',
    color: 'amber',
    icon: 'Flame',
    requireConfirmation: true,
  },
  {
    name: 'Druckluft / Absaugung AN (M8)',
    description: 'Schaltet Kühlmittel- oder Druckluftrelais aktiv.',
    category: 'laser_spindle',
    command: 'M8',
    color: 'cyan',
    icon: 'Wind',
    requireConfirmation: false,
  },
  {
    name: 'Druckluft / Absaugung AUS (M9)',
    description: 'Schaltet Kühlmittel- oder Druckluftrelais ab.',
    category: 'laser_spindle',
    command: 'M9',
    color: 'cyan',
    icon: 'Wind',
    requireConfirmation: false,
  },
  {
    name: 'Stift Schnellhub (10x Auf/Ab)',
    description: 'Führt 10 schnelle Stift-Hebezyklen zur Schmier- und Gängigkeitsprüfung durch.',
    category: 'utility',
    command: '{penDownCommand}\nG4 P0.2\n{penUpCommand}\nG4 P0.2\n{penDownCommand}\nG4 P0.2\n{penUpCommand}\nG4 P0.2\n{penDownCommand}\nG4 P0.2\n{penUpCommand}',
    color: 'purple',
    icon: 'PenTool',
    requireConfirmation: false,
  },
  {
    name: 'Fehler-Status & Parser State ($# & $G)',
    description: 'Liest alle Versätze (G54-G59, G28, G30, G92) und aktiven Parser-Modi aus.',
    category: 'utility',
    command: '$#\n$G',
    color: 'slate',
    icon: 'Terminal',
    requireConfirmation: false,
  }
];

const STORAGE_KEY_BUTTONS = 'plottercnc_custom_buttons_v2';
const LEGACY_STORAGE_KEY = 'plottercnc_custom_buttons';

export function loadCustomButtons(): CustomButton[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_BUTTONS);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      }
    }
    // Fallback: check legacy storage
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const parsedLegacy = JSON.parse(legacy);
      if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
        const migrated = parsedLegacy.map((btn: any, idx: number) => ({
          ...btn,
          category: btn.category || 'custom',
          order: btn.order ?? idx,
        }));
        saveCustomButtons(migrated);
        return migrated;
      }
    }
  } catch (e) {
    console.warn('Error loading custom buttons from storage', e);
  }
  const initial = [...DEFAULT_CUSTOM_BUTTONS];
  saveCustomButtons(initial);
  return initial;
}

export function saveCustomButtons(buttons: CustomButton[]) {
  try {
    localStorage.setItem(STORAGE_KEY_BUTTONS, JSON.stringify(buttons));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('custom-buttons-updated', { detail: buttons }));
    }
  } catch (e) {
    console.error('Error saving custom buttons', e);
  }
}

// Variable substitution engine
export function substituteMacroVariables(commandTemplate: string, profile: MachineProfile): string {
  const bedW = profile.bedWidth || 300;
  const bedH = profile.bedHeight || 200;
  const bedCenterX = (bedW / 2).toFixed(1);
  const bedCenterY = (bedH / 2).toFixed(1);
  const bedWidthMinus10 = Math.max(10, bedW - 10).toFixed(1);
  const bedHeightMinus10 = Math.max(10, bedH - 10).toFixed(1);
  
  const penUp = profile.penUpCommand || 'M3 S0';
  const penDown = profile.penDownCommand || 'M3 S1000';
  const penUpZ = (profile.penUpZ ?? 5).toFixed(2);
  const penDownZ = (profile.penDownZ ?? 0).toFixed(2);
  const travelFeed = (profile.travelFeedrate || 2500).toString();
  const drawingFeed = (profile.drawingFeedrate || 1200).toString();
  const plungeFeed = (profile.plungeFeedrate || 600).toString();
  const laserPowerMax = (profile.laserPowerMax || 1000).toString();
  const laserLowPower = Math.max(1, Math.round((profile.laserPowerMax || 1000) * 0.01)).toString();

  const state = grbl.getCurrentState();
  const currentX = state.wpos.x.toFixed(3);
  const currentY = state.wpos.y.toFixed(3);
  const currentZ = state.wpos.z.toFixed(3);

  return commandTemplate
    .replace(/\{bedWidth\}/g, bedW.toString())
    .replace(/\{bedHeight\}/g, bedH.toString())
    .replace(/\{bedCenterX\}/g, bedCenterX)
    .replace(/\{bedCenterY\}/g, bedCenterY)
    .replace(/\{bedWidthMinus10\}/g, bedWidthMinus10)
    .replace(/\{bedHeightMinus10\}/g, bedHeightMinus10)
    .replace(/\{penUpCommand\}/g, penUp)
    .replace(/\{penDownCommand\}/g, penDown)
    .replace(/\{penUpZ\}/g, penUpZ)
    .replace(/\{penDownZ\}/g, penDownZ)
    .replace(/\{travelFeedrate\}/g, travelFeed)
    .replace(/\{drawingFeedrate\}/g, drawingFeed)
    .replace(/\{plungeFeedrate\}/g, plungeFeed)
    .replace(/\{laserPowerMax\}/g, laserPowerMax)
    .replace(/\{laserLowPower\}/g, laserLowPower)
    .replace(/\{currentX\}/g, currentX)
    .replace(/\{currentY\}/g, currentY)
    .replace(/\{currentZ\}/g, currentZ);
}

// Full async Macro Sequence Executor
export async function executeMacroSequence(
  macro: CustomButton,
  profile: MachineProfile,
  parsedGcode: ParsedGcode | null,
  onProgress?: (step: number, total: number, lineText: string) => void
): Promise<{ success: boolean; message: string }> {
  // Check connection; auto-start simulation if disconnected
  const conn = grbl.getConnectionInfo();
  if (!conn.connected) {
    grbl.connectSimulation();
  }

  // 1. Check Special Trigger: Framing
  if (macro.command === 'FRAMING_ACTION') {
    if (!parsedGcode || parsedGcode.segments.length === 0) {
      return { success: false, message: 'Kein G-Code geladen für Framing' };
    }
    const bounds = parsedGcode.cutBounds || parsedGcode.bounds;
    const { minX, maxX, minY, maxY } = bounds;
    const feed = profile.travelFeedrate || 2000;

    try {
      if (onProgress) onProgress(1, 6, 'Werkzeug anheben...');
      await grbl.send(profile.penUpCommand || 'M3 S0');
      await new Promise(r => setTimeout(r, 100));

      if (onProgress) onProgress(2, 6, `Eilgang zu Startpunkt (X${minX.toFixed(1)}, Y${minY.toFixed(1)})`);
      await grbl.send(`G90 G0 X${minX.toFixed(3)} Y${minY.toFixed(3)} F${feed}`);
      await new Promise(r => setTimeout(r, 100));

      if (onProgress) onProgress(3, 6, 'Rahmen abfahren (Linie 1)...');
      await grbl.send(`G1 X${minX.toFixed(3)} Y${maxY.toFixed(3)} F${feed}`);
      await new Promise(r => setTimeout(r, 100));

      if (onProgress) onProgress(4, 6, 'Rahmen abfahren (Linie 2)...');
      await grbl.send(`G1 X${maxX.toFixed(3)} Y${maxY.toFixed(3)}`);
      await new Promise(r => setTimeout(r, 100));

      if (onProgress) onProgress(5, 6, 'Rahmen abfahren (Linie 3)...');
      await grbl.send(`G1 X${maxX.toFixed(3)} Y${minY.toFixed(3)}`);
      await new Promise(r => setTimeout(r, 100));

      if (onProgress) onProgress(6, 6, 'Rahmen abfahren (Linie 4) -> Ende');
      await grbl.send(`G1 X${minX.toFixed(3)} Y${minY.toFixed(3)}`);
      await new Promise(r => setTimeout(r, 100));

      return { success: true, message: 'Framing erfolgreich abgeschlossen' };
    } catch (e: any) {
      return { success: false, message: `Framing-Fehler: ${e.message || e}` };
    }
  }

  // 2. Check Special Trigger: Air Assist Toggle
  if (macro.command === 'AIR_ASSIST_TOGGLE') {
    try {
      const isAirOn = grbl.getCurrentState().accessoryState?.includes('M8') ?? false;
      const nextCmd = isAirOn ? 'M9' : 'M8';
      await grbl.send(nextCmd);
      return { success: true, message: `Air Assist: ${nextCmd === 'M8' ? 'EIN (M8)' : 'AUS (M9)'}` };
    } catch (e: any) {
      return { success: false, message: `Air Assist Fehler: ${e.message}` };
    }
  }

  // 3. Check Special Trigger: Soft Reset
  if (macro.command === 'GRBL_SOFT_RESET') {
    try {
      await grbl.softReset();
      return { success: true, message: 'GRBL Soft-Reset (0x18) gesendet' };
    } catch (e: any) {
      return { success: false, message: `Reset Fehler: ${e.message}` };
    }
  }

  // 4. Multi-Line G-Code Execution with Variable Substitution & Dwell handling
  const substituted = substituteMacroVariables(macro.command, profile);
  const rawLines = substituted.split(/\r?\n/);
  
  // Clean comments and blank lines
  const cleanLines = rawLines
    .map(line => {
      // remove ; comment and (comment)
      let cleaned = line.replace(/;.*$/, '').replace(/\(.*?\)/g, '').trim();
      return cleaned;
    })
    .filter(Boolean);

  if (cleanLines.length === 0) {
    return { success: false, message: 'Keine ausführbaren Befehle im Makro gefunden' };
  }

  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    if (onProgress) {
      onProgress(i + 1, cleanLines.length, line);
    }

    // Check for custom delay syntax: DELAY 500 or G4 P0.5
    if (line.toUpperCase().startsWith('DELAY')) {
      const msMatch = line.match(/DELAY\s+(\d+)/i);
      const ms = msMatch ? parseInt(msMatch[1], 10) : 500;
      await new Promise(r => setTimeout(r, ms));
      continue;
    }

    if (line.toUpperCase().startsWith('G4')) {
      // Send G4 to GRBL and also wait locally for smooth flow
      await grbl.send(line);
      const pMatch = line.match(/P([\d.]+)/i);
      const sMatch = line.match(/S([\d.]+)/i);
      const seconds = pMatch ? parseFloat(pMatch[1]) : (sMatch ? parseFloat(sMatch[1]) : 1);
      await new Promise(r => setTimeout(r, Math.min(5000, seconds * 1000)));
      continue;
    }

    await grbl.send(line);
    // Short 50ms pause between rapid sequential lines to avoid RX buffer stalls
    if (cleanLines.length > 1) {
      await new Promise(r => setTimeout(r, 60));
    }
  }

  return { success: true, message: `Makro ausgeführt: ${macro.name}` };
}

export function exportCustomButtonsJson(buttons: CustomButton[], selectedIds?: string[]): string {
  const toExport = selectedIds && selectedIds.length > 0 
    ? buttons.filter(b => selectedIds.includes(b.id)) 
    : buttons;
  
  return JSON.stringify({
    version: '2.0',
    type: 'plottercnc_custom_buttons',
    exportDate: new Date().toISOString(),
    count: toExport.length,
    buttons: toExport,
  }, null, 2);
}

export function importCustomButtonsJson(jsonString: string, currentButtons: CustomButton[]): CustomButton[] {
  try {
    const parsed = JSON.parse(jsonString);
    const newButtons: CustomButton[] = parsed.buttons || (Array.isArray(parsed) ? parsed : []);
    
    if (!Array.isArray(newButtons) || newButtons.length === 0) {
      throw new Error('Ungültiges Format für Buttons / Makros');
    }

    const merged = [...currentButtons];
    for (const btn of newButtons) {
      if (!btn.name || !btn.command) continue;
      const validBtn: CustomButton = {
        id: btn.id || 'btn_' + Math.random().toString(36).substring(2, 9),
        name: btn.name,
        description: btn.description || '',
        category: btn.category || 'custom',
        command: btn.command,
        color: btn.color || 'indigo',
        icon: btn.icon || 'Zap',
        requireConfirmation: !!btn.requireConfirmation,
        isVisible: btn.isVisible !== false,
        order: typeof btn.order === 'number' ? btn.order : merged.length,
      };

      const existingIdx = merged.findIndex(b => b.id === validBtn.id);
      if (existingIdx >= 0) {
        merged[existingIdx] = validBtn;
      } else {
        merged.push(validBtn);
      }
    }

    saveCustomButtons(merged);
    return merged;
  } catch (e: any) {
    throw new Error('Fehler beim Importieren der Makros: ' + e.message);
  }
}
