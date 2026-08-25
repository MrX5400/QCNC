export type Language = 'de' | 'en';

export interface Translations {
  // Navigation & Header
  appTitle: string;
  appSubtitle: string;
  tabVisualizer: string;
  tabGenerator: string;
  tabGrblSettings: string;
  tabConsole: string;
  btnMachineProfile: string;
  btnSettings: string;
  btnEmergencyStop: string;
  btnConnectSerial: string;
  btnConnectSim: string;
  btnDisconnect: string;
  statusIdle: string;
  statusRun: string;
  statusHold: string;
  statusAlarm: string;
  statusJog: string;
  statusHome: string;

  // Header & Navigation Aliases
  machineProfileTitle: string;
  controlAndVisualizer: string;
  vectorRasterGenerator: string;
  consoleTab: string;
  importButton: string;
  exportButton: string;
  customButtonsTab: string;
  connectUSB: string;
  connectSimulation: string;
  disconnect: string;
  emergencyStop: string;

  // Visualizer
  mode2D: string;
  mode3D: string;
  btnFitView: string;
  btnReset3D: string;
  layerGrid: string;
  layerRapid: string;
  layerSwivel: string;
  layerBlade: string;
  toolhead: string;
  doubleClickJogTip: string;
  joggingTo: string;
  transformTitle: string;
  transformMove: string;
  transformRotate: string;
  transformScale: string;
  transformCenter: string;
  transformOrigin: string;
  transformDragMode: string;
  transformDragActive: string;

  // Jog & Controller
  jogTitle: string;
  jogModeStep: string;
  jogModeContinuous: string;
  jogStepSize: string;
  jogFeedrate: string;
  manualJog: string;
  jogStepMode: string;
  jogContinuousMode: string;
  stepDistance: string;
  feedrateSpeed: string;
  setWorkZero: string;
  btnZeroXY: string;
  btnZeroZ: string;
  btnGoZero: string;
  btnUnlock: string;
  btnHome: string;
  btnPenDown: string;
  btnPenUp: string;
  btnLaserTest: string;

  // G-Code Streamer
  streamerTitle: string;
  btnStartJob: string;
  btnPauseJob: string;
  btnResumeJob: string;
  btnStopJob: string;
  btnLoadFile: string;
  btnExportNC: string;
  btnExportGcode: string;
  jobProgress: string;
  jobTimeRemaining: string;
  feedOverride: string;

  // Generator & DXF
  generatorTitle: string;
  uploadVectorOrImage: string;
  uploadVectorDesc: string;
  supportedFormats: string;
  dxfDetected: string;
  svgDetected: string;
  rasterDetected: string;
  targetModePen: string;
  targetModeKnife: string;
  targetModeLaser: string;
  vectorScale: string;
  vectorRotation: string;
  vectorMirrorX: string;
  vectorMirrorY: string;
  vectorCenterBed: string;
  btnGenerateGcode: string;
  btnLoadVisualizer: string;
  laserDatabase: string;
  activePreset: string;

  // Custom Buttons & Macros
  customButtonsTitle: string;
  customButtonsDesc: string;
  btnManageButtons: string;
  btnAddButton: string;
  btnExportButtons: string;
  btnImportButtons: string;
  btnExportSelected: string;
  btnRestoreDefaults: string;
  buttonName: string;
  buttonCommand: string;
  buttonColor: string;
  buttonIcon: string;
  buttonConfirmPrompt: string;
  buttonVisible: string;
  btnFraming: string;
  btnFramingDesc: string;
  framingRunning: string;

  // Settings Modal
  settingsTitle: string;
  settingsAppearance: string;
  settingsLanguage: string;
  settingsButtons: string;
  settingsSafety: string;
  settingsBackup: string;
  settingsAbout: string;
  themeSelect: string;
  themeCategoryAll: string;
  themeCategoryMinimal: string;
  themeCategoryClassic: string;
  themeCategoryLight: string;
  themeCategoryContrast: string;
  customThemeBuilder: string;
  primaryAccent: string;
  backgroundTone: string;
  surfaceTone: string;
  borderTone: string;
  textMainColor: string;
  textMutedColor: string;
  cutLineG1Color: string;
  rapidLineG0Color: string;
  gridLineColor: string;
  themeLivePreview: string;
  themeExportPalette: string;
  themeImportPalette: string;
  themeModeDark: string;
  themeModeLight: string;
  fullBackupTitle: string;
  fullBackupDesc: string;
  btnExportFullConfig: string;
  btnImportFullConfig: string;
  backupSuccess: string;
  restoreSuccess: string;
  confirmResetFactory: string;
  btnFactoryReset: string;

  // Console
  consoleTitle: string;
  consoleFilterReports: string;
  consoleAutoScroll: string;
  consoleClear: string;
  consoleCopy: string;
  consoleInputPlaceholder: string;
}

export const translations: Record<Language, Translations> = {
  de: {
    appTitle: 'PlotterCNC',
    appSubtitle: 'GRBL Plotter & CNC Steuerung',
    tabVisualizer: 'Steuerung & 3D Pfad',
    tabGenerator: 'Vektor & Raster Generator',
    tabGrblSettings: 'GRBL $$ Parameter',
    tabConsole: 'Konsole',
    btnMachineProfile: 'Maschinenprofil',
    btnSettings: 'Einstellungen',
    btnEmergencyStop: 'NOT-HALT',
    btnConnectSerial: 'USB / Seriell',
    btnConnectSim: 'Simulation',
    btnDisconnect: 'Trennen',
    statusIdle: 'BEREIT (IDLE)',
    statusRun: 'LÄUFT (RUN)',
    statusHold: 'ANGEHALTEN (HOLD)',
    statusAlarm: 'ALARM',
    statusJog: 'MANUELL (JOG)',
    statusHome: 'REFERENZ (HOME)',

    // Header & Navigation Aliases
    machineProfileTitle: 'Maschinenprofil anpassen',
    controlAndVisualizer: 'Steuerung & 3D Pfad',
    vectorRasterGenerator: 'Vektor & Raster Generator',
    consoleTab: 'Konsole',
    importButton: 'Importieren',
    exportButton: 'Exportieren',
    customButtonsTab: 'Makros',
    connectUSB: 'USB / Seriell',
    connectSimulation: 'Simulation',
    disconnect: 'Trennen',
    emergencyStop: 'NOT-HALT',

    mode2D: '2D Plan',
    mode3D: '3D Iso',
    btnFitView: 'Einpassen',
    btnReset3D: '3D Reset',
    layerGrid: 'Gitter',
    layerRapid: 'Eilgang (G0)',
    layerSwivel: 'Messer-Bögen',
    layerBlade: 'Messer-Winkel',
    toolhead: 'Kopf',
    doubleClickJogTip: 'Doppelklick = Kopf fahren',
    joggingTo: 'Fahre Kopf zu',
    transformTitle: 'Geometrie transformieren & verschieben',
    transformMove: 'Verschieben',
    transformRotate: 'Drehen',
    transformScale: 'Skalieren',
    transformCenter: 'Zentrieren',
    transformOrigin: 'Nullpunkt',
    transformDragMode: 'Maus-Verschieben',
    transformDragActive: 'Maus-Verschieben aktiv (Klick & Ziehen auf Fläche)',

    jogTitle: 'Manuelle Achssteuerung (Jog)',
    jogModeStep: 'Schritt-Modus',
    jogModeContinuous: 'Dauerlauf (Halten)',
    jogStepSize: 'Schrittweite',
    jogFeedrate: 'Vorschub',
    manualJog: 'Manuelle Achsensteuerung',
    jogStepMode: 'Schritt-Modus',
    jogContinuousMode: 'Dauer-Joggen',
    stepDistance: 'Schrittweite',
    feedrateSpeed: 'Jog-Geschwindigkeit',
    setWorkZero: 'Nullpunkt setzen (WPos Zero)',
    btnZeroXY: 'X/Y Nullen',
    btnZeroZ: 'Z Nullen',
    btnGoZero: 'Zu X0 Y0',
    btnUnlock: 'Entsperren ($X)',
    btnHome: 'Referenz ($H)',
    btnPenDown: 'Stift Senken',
    btnPenUp: 'Stift Heben',
    btnLaserTest: 'Laser Test',

    streamerTitle: 'G-Code Ausführung & Job-Streamer',
    btnStartJob: 'Job Starten',
    btnPauseJob: 'Pause',
    btnResumeJob: 'Fortsetzen',
    btnStopJob: 'Job Abbrechen',
    btnLoadFile: 'Datei laden (.nc / .gcode)',
    btnExportNC: 'Export .NC',
    btnExportGcode: 'Export .gcode',
    jobProgress: 'Fortschritt',
    jobTimeRemaining: 'Verbleibend',
    feedOverride: 'Vorschub-Override',

    generatorTitle: 'Vektor- & Bild-Generator',
    uploadVectorOrImage: 'DXF, SVG oder Bilddatei hier ablegen',
    uploadVectorDesc: 'Unterstützt AutoCAD DXF (Linien, Splines, Kreisbögen), Inkscape SVG und Rasterbilder',
    supportedFormats: '.dxf, .svg, .png, .jpg, .bmp, .webp',
    dxfDetected: 'DXF CAD-Datei geladen',
    svgDetected: 'SVG Vektordatei geladen',
    rasterDetected: 'Rasterbild geladen',
    targetModePen: 'Stift-Plotter',
    targetModeKnife: 'Schleppmesser',
    targetModeLaser: 'Laser-Cutter',
    vectorScale: 'Skalierung',
    vectorRotation: 'Drehwinkel',
    vectorMirrorX: 'Spiegeln X',
    vectorMirrorY: 'Spiegeln Y',
    vectorCenterBed: 'Tischmitte',
    btnGenerateGcode: 'G-Code Generieren',
    btnLoadVisualizer: 'In Visualizer laden',
    laserDatabase: 'Material-Datenbank',
    activePreset: 'Aktives Preset',

    customButtonsTitle: 'Benutzerdefinierte Schnell-Buttons & Makros',
    customButtonsDesc: 'Individuelle G-Code Makros, Framing und Ein-/Ausblenden',
    btnManageButtons: 'Buttons Verwalten',
    btnAddButton: 'Button Hinzufügen',
    btnExportButtons: 'Buttons Exportieren (.json)',
    btnImportButtons: 'Buttons Importieren (.json)',
    btnExportSelected: 'Ausgewählte exportieren',
    btnRestoreDefaults: 'Standard-Buttons wiederherstellen',
    buttonName: 'Name / Beschriftung',
    buttonCommand: 'G-Code Befehl(e)',
    buttonColor: 'Farbe',
    buttonIcon: 'Icon',
    buttonConfirmPrompt: 'Sicherheitsabfrage vor Ausführung',
    buttonVisible: 'In Leiste anzeigen',
    btnFraming: 'Framing (Umrahmung)',
    btnFramingDesc: 'Fährt den Außenrahmen des Bauteils ab zur Positionsprüfung',
    framingRunning: 'Framing läuft...',

    settingsTitle: 'Programmeinstellungen',
    settingsAppearance: 'Erscheinungsbild & Themes',
    settingsLanguage: 'Sprache & Einheiten',
    settingsButtons: 'Eigene Buttons',
    settingsSafety: 'Steuerung & Sicherheit',
    settingsBackup: 'Vollständiges Backup & Restore',
    settingsAbout: 'System & Über',
    themeSelect: 'Farb-Design wählen',
    themeCategoryAll: 'Alle Designs',
    themeCategoryMinimal: 'Schlicht & Minimal',
    themeCategoryClassic: 'Klassisch & CAD',
    themeCategoryLight: 'Helle Modi',
    themeCategoryContrast: 'Spezial & Kontrast',
    customThemeBuilder: 'Eigenes Farb-Schema zusammenstellen',
    primaryAccent: 'Akzentfarbe',
    backgroundTone: 'Hintergrundton',
    surfaceTone: 'Oberflächen / Panele',
    borderTone: 'Rahmen / Linien',
    textMainColor: 'Text Hauptfarbe',
    textMutedColor: 'Text Gedämpft',
    cutLineG1Color: 'Schnittbahn (G1 / Laser)',
    rapidLineG0Color: 'Eilgang / Leerfahrt (G0)',
    gridLineColor: 'Rasterlinien',
    themeLivePreview: 'Echtzeit-Vorschau',
    themeExportPalette: 'Palette exportieren',
    themeImportPalette: 'Palette importieren',
    themeModeDark: 'Dunkles Design (Dark Mode)',
    themeModeLight: 'Helles Design (Light Mode)',
    fullBackupTitle: 'Gesamte Programmkonfiguration',
    fullBackupDesc: 'Sichert alle Maschinenprofile, Laser-Materialdaten, eigene Buttons und Einstellungen in einer Datei.',
    btnExportFullConfig: 'Komplette Konfiguration exportieren (.json)',
    btnImportFullConfig: 'Konfiguration wiederherstellen (.json)',
    backupSuccess: 'Konfiguration erfolgreich exportiert!',
    restoreSuccess: 'Konfiguration erfolgreich importiert und angewendet!',
    confirmResetFactory: 'Möchtest du wirklich alle Einstellungen auf Werkseinstellungen zurücksetzen?',
    btnFactoryReset: 'Auf Werkseinstellungen zurücksetzen',

    consoleTitle: 'GRBL Echtzeit-Seriell-Konsole',
    consoleFilterReports: 'Status-Polls (?) ausblenden',
    consoleAutoScroll: 'Auto-Scroll',
    consoleClear: 'Leeren',
    consoleCopy: 'Kopieren',
    consoleInputPlaceholder: 'G-Code oder GRBL-Befehl eingeben (z. B. $$, G0 X10 Y10, $X)...',
  },
  en: {
    appTitle: 'PlotterCNC',
    appSubtitle: 'GRBL Plotter & CNC Controller',
    tabVisualizer: 'Control & 3D Visualizer',
    tabGenerator: 'Vector & Raster Generator',
    tabGrblSettings: 'GRBL $$ Parameters',
    tabConsole: 'Console',
    btnMachineProfile: 'Machine Profile',
    btnSettings: 'Settings',
    btnEmergencyStop: 'E-STOP',
    btnConnectSerial: 'USB / Serial',
    btnConnectSim: 'Simulation',
    btnDisconnect: 'Disconnect',
    statusIdle: 'IDLE',
    statusRun: 'RUNNING',
    statusHold: 'HOLD',
    statusAlarm: 'ALARM',
    statusJog: 'JOGGING',
    statusHome: 'HOMING',

    // Header & Navigation Aliases
    machineProfileTitle: 'Configure Machine Profile',
    controlAndVisualizer: 'Control & 3D Path',
    vectorRasterGenerator: 'Vector & Raster Generator',
    consoleTab: 'Console',
    importButton: 'Import',
    exportButton: 'Export',
    customButtonsTab: 'Macros',
    connectUSB: 'USB / Serial',
    connectSimulation: 'Simulation',
    disconnect: 'Disconnect',
    emergencyStop: 'E-STOP',

    mode2D: '2D Top-Down',
    mode3D: '3D Iso',
    btnFitView: 'Fit View',
    btnReset3D: 'Reset 3D',
    layerGrid: 'Grid',
    layerRapid: 'Rapid (G0)',
    layerSwivel: 'Swivel Arcs',
    layerBlade: 'Blade Angle',
    toolhead: 'Head',
    doubleClickJogTip: 'Double click = Move head',
    joggingTo: 'Jogging head to',
    transformTitle: 'Transform & Move Geometry',
    transformMove: 'Move',
    transformRotate: 'Rotate',
    transformScale: 'Scale',
    transformCenter: 'Center on Bed',
    transformOrigin: 'Origin (0,0)',
    transformDragMode: 'Mouse Drag Move',
    transformDragActive: 'Drag mode active (Click & drag on bed area)',

    jogTitle: 'Manual Axis Control (Jog)',
    jogModeStep: 'Step Mode',
    jogModeContinuous: 'Continuous (Hold)',
    jogStepSize: 'Step Size',
    jogFeedrate: 'Feedrate',
    manualJog: 'Manual Axis Control',
    jogStepMode: 'Step Mode',
    jogContinuousMode: 'Continuous Jog',
    stepDistance: 'Step Size',
    feedrateSpeed: 'Jog Speed',
    setWorkZero: 'Set Work Zero (WPos Zero)',
    btnZeroXY: 'Zero X/Y',
    btnZeroZ: 'Zero Z',
    btnGoZero: 'Go to X0 Y0',
    btnUnlock: 'Unlock ($X)',
    btnHome: 'Home ($H)',
    btnPenDown: 'Pen Down',
    btnPenUp: 'Pen Up',
    btnLaserTest: 'Laser Test',

    streamerTitle: 'G-Code Execution & Job Streamer',
    btnStartJob: 'Start Job',
    btnPauseJob: 'Pause',
    btnResumeJob: 'Resume',
    btnStopJob: 'Abort Job',
    btnLoadFile: 'Load File (.nc / .gcode)',
    btnExportNC: 'Export .NC',
    btnExportGcode: 'Export .gcode',
    jobProgress: 'Progress',
    jobTimeRemaining: 'Remaining',
    feedOverride: 'Feed Override',

    generatorTitle: 'Vector & Image Generator',
    uploadVectorOrImage: 'Drop DXF, SVG or Image file here',
    uploadVectorDesc: 'Supports AutoCAD DXF (Lines, Splines, Arcs), Inkscape SVG, and Raster Images',
    supportedFormats: '.dxf, .svg, .png, .jpg, .bmp, .webp',
    dxfDetected: 'DXF CAD File Loaded',
    svgDetected: 'SVG Vector File Loaded',
    rasterDetected: 'Raster Image Loaded',
    targetModePen: 'Pen Plotter',
    targetModeKnife: 'Drag Knife',
    targetModeLaser: 'Laser Cutter',
    vectorScale: 'Scaling',
    vectorRotation: 'Rotation Angle',
    vectorMirrorX: 'Mirror X',
    vectorMirrorY: 'Mirror Y',
    vectorCenterBed: 'Center on Bed',
    btnGenerateGcode: 'Generate G-Code',
    btnLoadVisualizer: 'Load into Visualizer',
    laserDatabase: 'Material Database',
    activePreset: 'Active Preset',

    customButtonsTitle: 'Custom Quick Buttons & Macros',
    customButtonsDesc: 'Custom G-Code macros, Framing, and visibility toggles',
    btnManageButtons: 'Manage Buttons',
    btnAddButton: 'Add Button',
    btnExportButtons: 'Export Buttons (.json)',
    btnImportButtons: 'Import Buttons (.json)',
    btnExportSelected: 'Export Selected',
    btnRestoreDefaults: 'Restore Default Buttons',
    buttonName: 'Name / Label',
    buttonCommand: 'G-Code Command(s)',
    buttonColor: 'Color',
    buttonIcon: 'Icon',
    buttonConfirmPrompt: 'Confirmation prompt before running',
    buttonVisible: 'Show in Toolbar',
    btnFraming: 'Framing (Perimeter Trace)',
    btnFramingDesc: 'Traces workpiece perimeter with low pilot power to verify alignment',
    framingRunning: 'Framing in progress...',

    settingsTitle: 'Application Settings',
    settingsAppearance: 'Appearance & Themes',
    settingsLanguage: 'Language & Units',
    settingsButtons: 'Custom Buttons',
    settingsSafety: 'Control & Safety',
    settingsBackup: 'Full Backup & Restore',
    settingsAbout: 'System & About',
    themeSelect: 'Choose Color Theme',
    themeCategoryAll: 'All Designs',
    themeCategoryMinimal: 'Subtle & Minimal',
    themeCategoryClassic: 'Classic & CAD',
    themeCategoryLight: 'Light Modes',
    themeCategoryContrast: 'Special & Contrast',
    customThemeBuilder: 'Build Custom Color Scheme',
    primaryAccent: 'Primary Accent Color',
    backgroundTone: 'Background Tone',
    surfaceTone: 'Surfaces / Panels',
    borderTone: 'Borders & Lines',
    textMainColor: 'Main Text Color',
    textMutedColor: 'Muted Text Color',
    cutLineG1Color: 'Cut Path (G1 / Laser)',
    rapidLineG0Color: 'Rapid Move / Travel (G0)',
    gridLineColor: 'Grid Lines',
    themeLivePreview: 'Real-time Live Preview',
    themeExportPalette: 'Export Palette',
    themeImportPalette: 'Import Palette',
    themeModeDark: 'Dark Mode',
    themeModeLight: 'Light Mode',
    fullBackupTitle: 'Complete Program Configuration',
    fullBackupDesc: 'Backs up all machine profiles, laser materials, custom buttons and settings into a single file.',
    btnExportFullConfig: 'Export Complete Configuration (.json)',
    btnImportFullConfig: 'Restore Configuration (.json)',
    backupSuccess: 'Configuration successfully exported!',
    restoreSuccess: 'Configuration successfully restored and applied!',
    confirmResetFactory: 'Are you sure you want to reset all settings to factory defaults?',
    btnFactoryReset: 'Reset to Factory Defaults',

    consoleTitle: 'GRBL Realtime Serial Console',
    consoleFilterReports: 'Hide status polls (?)',
    consoleAutoScroll: 'Auto Scroll',
    consoleClear: 'Clear',
    consoleCopy: 'Copy Log',
    consoleInputPlaceholder: 'Enter G-Code or GRBL command (e.g. $$, G0 X10 Y10, $X)...',
  },
};

const STORAGE_KEY_LANG = 'plottercnc_language';

export function getSavedLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LANG);
    if (saved === 'en' || saved === 'de') return saved;
  } catch (e) {
    // Ignore storage error
  }
  return 'de';
}

export function saveLanguage(lang: Language) {
  try {
    localStorage.setItem(STORAGE_KEY_LANG, lang);
  } catch (e) {
    // Ignore
  }
}
