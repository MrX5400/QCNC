import React, { useState, useEffect, useRef } from 'react';
import { 
  Usb, 
  Play, 
  PowerOff, 
  Cpu, 
  AlertTriangle, 
  Settings, 
  Sliders, 
  RefreshCw, 
  Activity,
  Layers,
  Terminal as TerminalIcon,
  HelpCircle,
  FileCode,
  Compass,
  SlidersHorizontal,
  Palette,
  Upload,
  Download,
  LayoutGrid,
  Check,
  FolderOpen,
  Zap
} from 'lucide-react';
import { grbl } from '../services/grblService';
import { GrblState, MachineProfile } from '../types/cnc';
import { useI18n, useTheme } from '../contexts/ThemeLanguageContext';
import appLogo from '../logo.svg';

interface HeaderProps {
  currentProfile: MachineProfile;
  onOpenProfileModal: () => void;
  onOpenSettingsModal?: () => void;
  onOpenButtonsModal?: () => void;
  activeTab: 'visualizer' | 'generator' | 'settings' | 'console';
  setActiveTab: (tab: 'visualizer' | 'generator' | 'settings' | 'console') => void;
  onImportFile?: (file: File) => void;
  onExportGcode?: (ext?: 'nc' | 'gcode') => void;
  hasGcode?: boolean;
  panelVisibility?: {
    visualizer: boolean;
    jog: boolean;
    streamer: boolean;
    macros: boolean;
    dro: boolean;
  };
  onTogglePanel?: (panel: 'visualizer' | 'jog' | 'streamer' | 'macros' | 'dro') => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  onOpenProfileModal,
  onOpenSettingsModal,
  onOpenButtonsModal,
  activeTab,
  setActiveTab,
  onImportFile,
  onExportGcode,
  hasGcode = false,
  panelVisibility,
  onTogglePanel,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [grblState, setGrblState] = useState<GrblState>(() => grbl.getCurrentState());
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connInfo, setConnInfo] = useState(() => grbl.getConnectionInfo());
  const [showLayoutMenu, setShowLayoutMenu] = useState<boolean>(false);
  const [showImportExportMenu, setShowImportExportMenu] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const layoutDropdownRef = useRef<HTMLDivElement | null>(null);
  const importExportDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = grbl.onState((state) => {
      setGrblState(state);
      setConnInfo(grbl.getConnectionInfo());
    });
    return () => unsub();
  }, []);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
      if (importExportDropdownRef.current && !importExportDropdownRef.current.contains(e.target as Node)) {
        setShowImportExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnectSerial = async () => {
    setIsConnecting(true);
    await grbl.connectSerial(baudRate);
    setIsConnecting(false);
  };

  const handleConnectSimulation = () => {
    grbl.connectSimulation();
  };

  const handleDisconnect = async () => {
    await grbl.disconnect();
  };

  const handleEmergencyStop = async () => {
    await grbl.sendRaw('!');
    await grbl.softReset();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImportFile) {
      onImportFile(file);
    }
    e.target.value = '';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Idle':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Run':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30 animate-pulse';
      case 'Hold':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Alarm':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-bounce';
      case 'Jog':
        return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case 'Home':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 select-none z-30 relative shadow-md">
      {/* Hidden File Input for Header Import Button */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept=".nc,.gcode,.ngc,.tap,.cnc,.dxf,.svg,image/*"
        className="hidden"
      />

      {/* LEFT: Brand, Machine Profile Pill & Live GRBL Status Badge */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 p-0.5 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[6px] flex items-center justify-center">
              <img src={appLogo} alt="Logo" className="w-full h-full object-contain p-0.5" />
            </div>
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-100 text-sm tracking-tight">QCNC</span>
              <span className="text-[0.5625rem] uppercase font-bold px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PRO
              </span>
            </div>
            <p className="text-[0.625rem] text-slate-400 leading-none">GRBL Controller and gcode Generator</p>
          </div>
        </div>

        {/* Profile Pill */}
        <button
          onClick={onOpenProfileModal}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-slate-300 transition-colors"
          title={t.machineProfileTitle || 'Maschinenprofil anpassen'}
        >
          <Sliders className="w-3.5 h-3.5 text-indigo-400" />
          <span className="max-w-[110px] sm:max-w-[130px] truncate font-medium">{currentProfile.name}</span>
          <span className="hidden md:inline text-[0.625rem] text-slate-400 font-mono">({currentProfile.bedWidth}x{currentProfile.bedHeight}mm)</span>
        </button>

        {/* Live GRBL State Badge (Positioned in Left Section as requested) */}
        <div className={`px-2.5 py-1 rounded-md border text-xs font-mono font-semibold flex items-center gap-1.5 ${getStatusColor(grblState.status)}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          <span>{grblState.status.toUpperCase()}</span>
          {connInfo.simulated && (
            <span className="text-[0.5625rem] bg-slate-900 px-1 py-0.2 rounded text-slate-300 font-sans">SIM</span>
          )}
        </div>
      </div>

      {/* CENTER: Workflows (Now unified into the main view) */}
      <nav className="flex items-center bg-slate-950/90 p-0.5 rounded-lg border border-slate-800 text-xs">
        <button
          onClick={() => setActiveTab('visualizer')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'visualizer' || activeTab === 'generator'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="Hauptarbeitsfläche (Design & Steuerung)"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span>Workspace</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'settings'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="3. GRBL $$ Parameter"
        >
          <Settings className="w-3.5 h-3.5 text-amber-400" />
          <span>GRBL $$</span>
        </button>

        <button
          onClick={() => setActiveTab('console')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium transition-all ${
            activeTab === 'console'
              ? 'bg-indigo-600 text-white shadow-sm font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
          title="GRBL Direktkonsole & Terminal"
        >
          <TerminalIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.consoleTab || 'Konsole'}</span>
        </button>
      </nav>

      {/* RIGHT: Import/Export, Connection, Central Gear Menu (Settings/Macros/Layout), E-Stop */}
      <div className="flex items-center gap-2">
        {/* 1. Import / Export Dropdown */}
        <div className="relative" ref={importExportDropdownRef}>
          <button
            onClick={() => setShowImportExportMenu(!showImportExportMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shadow-sm border ${
              showImportExportMenu
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-600/30'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 hover:border-slate-600'
            }`}
            title="G-Code, DXF, SVG importieren oder G-Code (.nc / .gcode) exportieren"
          >
            <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Import/Export</span>
            <Download className="w-3 h-3 text-slate-400" />
          </button>

          {showImportExportMenu && (
            <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-1.5 text-xs animate-in fade-in-50 duration-100">
              {/* Import Section */}
              <div>
                <div className="px-2 py-1 text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center gap-1.5">
                  <Upload className="w-3 h-3 text-indigo-400" />
                  <span>Importieren</span>
                </div>
                <div className="pt-1 space-y-1">
                  <button
                    onClick={() => {
                      setShowImportExportMenu(false);
                      fileInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <FileCode className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">G-Code laden...</div>
                      <div className="text-[0.625rem] text-slate-400">.nc, .gcode, .tap, .cnc</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowImportExportMenu(false);
                      setActiveTab('generator');
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <Compass className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">Vektor / Bild importieren</div>
                      <div className="text-[0.625rem] text-slate-400">.dxf, .svg, PNG, JPG (im Generator)</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Export Section */}
              <div>
                <div className="px-2 py-1 text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 flex items-center gap-1.5">
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>Exportieren</span>
                </div>
                <div className="pt-1 space-y-1">
                  <button
                    onClick={() => {
                      if (onExportGcode) onExportGcode('nc');
                      setShowImportExportMenu(false);
                    }}
                    disabled={!hasGcode}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left ${
                      hasGcode
                        ? 'text-slate-200 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700/50'
                        : 'text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Download className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">G-Code als .nc speichern</div>
                      <div className="text-[0.625rem] text-slate-400">Standard GRBL Format (.nc)</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (onExportGcode) onExportGcode('gcode');
                      setShowImportExportMenu(false);
                    }}
                    disabled={!hasGcode}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left ${
                      hasGcode
                        ? 'text-slate-200 hover:bg-emerald-950/60 hover:text-emerald-300 hover:border-emerald-700/50'
                        : 'text-slate-500 cursor-not-allowed opacity-60'
                    }`}
                  >
                    <Download className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <div className="font-medium">G-Code als .gcode speichern</div>
                      <div className="text-[0.625rem] text-slate-400">CNC/Plotter Format (.gcode)</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Connection Controls (USB / Simulation) */}
        {!connInfo.connected ? (
          <div className="flex items-center gap-1">
            <select
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              className="hidden lg:block bg-slate-800 text-slate-300 text-xs rounded px-1.5 py-1 border border-slate-700 focus:outline-none focus:border-indigo-500 font-mono"
            >
              <option value={115200}>115200</option>
              <option value={9600}>9600</option>
              <option value={57600}>57600</option>
              <option value={250000}>250000</option>
            </select>

            <button
              onClick={handleConnectSerial}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-semibold transition-colors shadow-sm disabled:opacity-50"
              title="Per WebSerial (USB) mit GRBL Controller verbinden"
            >
              <Usb className="w-3.5 h-3.5" />
              <span>{t.connectUSB || 'USB'}</span>
            </button>

            <button
              onClick={handleConnectSimulation}
              className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium border border-slate-700 transition-colors"
              title="Simulator ohne echte Hardware starten"
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Sim</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 rounded-md text-xs font-medium border border-slate-700 hover:border-rose-800 transition-colors"
            title="Verbindung zum Controller trennen"
          >
            <PowerOff className="w-3.5 h-3.5 text-rose-400" />
            <span>{t.disconnect || 'Trennen'}</span>
          </button>
        )}

        {/* 3. Central Gear Menu (Settings, Makros, Layout & Fenster) */}
        <div className="relative" ref={layoutDropdownRef}>
          <button
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
            className={`p-1.5 rounded-md text-xs font-medium border transition-colors ${
              showLayoutMenu
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Studio-Menü: Einstellungen, Makros & Fenster"
          >
            <Settings className="w-4 h-4 text-cyan-400" />
          </button>

          {showLayoutMenu && (
            <div className="absolute right-0 mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 space-y-2 text-xs animate-in fade-in-50 duration-100">
              {/* Settings & Themes */}
              <div className="space-y-1">
                {onOpenSettingsModal && (
                  <button
                    onClick={() => {
                      setShowLayoutMenu(false);
                      onOpenSettingsModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <Palette className="w-4 h-4 text-cyan-400" />
                    <div>
                      <div className="font-semibold">{t.settingsTitle || 'Einstellungen'}</div>
                      <div className="text-[0.625rem] text-slate-400">Farben, Themes & Sprache</div>
                    </div>
                  </button>
                )}

                {onOpenButtonsModal && (
                  <button
                    onClick={() => {
                      setShowLayoutMenu(false);
                      onOpenButtonsModal();
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 hover:text-white transition-colors text-left"
                  >
                    <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                    <div>
                      <div className="font-semibold">{t.customButtonsTab || 'Makros verwalten'}</div>
                      <div className="text-[0.625rem] text-slate-400">Schnell-Buttons bearbeiten</div>
                    </div>
                  </button>
                )}
              </div>

              {/* Panel Visibility Section */}
              {panelVisibility && onTogglePanel && (
                <div className="pt-1.5 border-t border-slate-800">
                  <div className="px-2 py-1 text-[0.625rem] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                    <span>Fenster & Leisten</span>
                    <LayoutGrid className="w-3 h-3 text-slate-500" />
                  </div>

                  <div className="space-y-0.5 pt-1">
                    {/* Quick Macro Bar Toggle */}
                    <button
                      onClick={() => onTogglePanel('macros')}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Zap className={`w-3.5 h-3.5 ${panelVisibility.macros ? 'text-amber-400' : 'text-slate-500'}`} />
                        <span>Makroleiste</span>
                      </span>
                      {panelVisibility.macros ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <span className="text-[0.625rem] text-slate-500">Aus</span>
                      )}
                    </button>

                    {[
                      { key: 'visualizer' as const, label: '3D/2D Arbeitsfläche' },
                      { key: 'jog' as const, label: 'Jog Controller' },
                      { key: 'streamer' as const, label: 'G-Code Job Streamer' },
                      { key: 'dro' as const, label: 'Live DRO Koordinaten' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => onTogglePanel(item.key)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-200 hover:bg-slate-800 transition-colors text-left"
                      >
                        <span className="text-[0.6875rem]">{item.label}</span>
                        {panelVisibility[item.key] ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span className="text-[0.625rem] text-slate-500">Aus</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Emergency Stop / NOT-HALT Button */}
        <button
          onClick={handleEmergencyStop}
          className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white rounded-md text-xs font-bold transition-all shadow-md shadow-rose-600/30"
          title="Not-Halt / Sofortiger Spindel- & Motorstopp (Reset)"
        >
          <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
          <span>{t.emergencyStop || 'NOT-HALT'}</span>
        </button>
      </div>
    </header>
  );
};
