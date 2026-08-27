import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Visualizer2D3D } from './components/Visualizer2D3D';
import { JogController } from './components/JogController';
import { GcodeStreamer } from './components/GcodeStreamer';
import { GeneratorSuite } from './components/GeneratorSuite';
import { GrblSettingsManager } from './components/GrblSettingsManager';
import { GrblConsole } from './components/GrblConsole';
import { MachineProfileModal } from './components/MachineProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { CustomButtonsBar } from './components/CustomButtonsBar';
import { CustomButtonsModal } from './components/CustomButtonsModal';
import { DEFAULT_PROFILES, loadActiveProfile, saveOrUpdateProfile } from './services/machineProfiles';
import { GrblState, MachineProfile, ParsedGcode } from './types/cnc';
import { grbl } from './services/grblService';
import { parseGcode } from './services/gcodeParser';
import { applyThemeCssVars, getSavedTheme } from './services/themeService';

export default function App() {
  const [currentProfile, setCurrentProfile] = useState<MachineProfile>(() => loadActiveProfile());
  const [activeTab, setActiveTab] = useState<'visualizer' | 'generator' | 'settings' | 'console'>('visualizer');
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isButtonsModalOpen, setIsButtonsModalOpen] = useState<boolean>(false);
  const [parsedGcode, setParsedGcode] = useState<ParsedGcode | null>(null);
  const [liveState, setLiveState] = useState<GrblState>(() => grbl.getCurrentState());
  const [activeExecutingLine, setActiveExecutingLine] = useState<number>(0);
  const [showMacroBar, setShowMacroBar] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('plottercnc_macrobar_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleMacroBar = (visible?: boolean) => {
    setShowMacroBar((prev) => {
      const next = typeof visible === 'boolean' ? visible : !prev;
      try {
        localStorage.setItem('plottercnc_macrobar_visible', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Apply stored theme on mount
  useEffect(() => {
    applyThemeCssVars(getSavedTheme());
  }, []);

  const handleProfileSave = (profile: MachineProfile) => {
    saveOrUpdateProfile(profile);
    setCurrentProfile(profile);
  };

  // Subscribe to live GRBL state updates
  useEffect(() => {
    const unsubState = grbl.onState((state) => {
      setLiveState(state);
    });

    const unsubProgress = grbl.onStreamProgress((prog) => {
      setActiveExecutingLine(prog.currentLine);
    });

    return () => {
      unsubState();
      unsubProgress();
    };
  }, []);

  // Initialize with a default demo job
  useEffect(() => {
    const defaultJob = `; PlotterCNC Studio Initial Demo
G90
G21
${currentProfile.penUpCommand}
G0 X30.000 Y30.000 F${currentProfile.travelFeedrate}
${currentProfile.penDownCommand}
G1 X120.000 Y30.000 F${currentProfile.drawingFeedrate}
G1 X120.000 Y100.000
G1 X30.000 Y100.000
G1 X30.000 Y30.000
${currentProfile.penUpCommand}
G0 X45.000 Y45.000
${currentProfile.penDownCommand}
G1 X105.000 Y45.000
G1 X75.000 Y85.000
G1 X45.000 Y45.000
${currentProfile.penUpCommand}
G0 X0.000 Y0.000
`;
    const parsed = parseGcode(defaultJob, currentProfile.penUpZ);
    setParsedGcode(parsed);
  }, []);

  // Import and Export handlers for top bar
  const handleImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        const parsed = parseGcode(text, currentProfile.penUpZ);
        setParsedGcode(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleExportGcode = (ext: 'nc' | 'gcode' = 'nc') => {
    if (!parsedGcode || !parsedGcode.raw) return;
    const blob = new Blob([parsedGcode.raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plottercnc_${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden select-none">
      {/* Top Application Header Bar */}
      <Header
        currentProfile={currentProfile}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
        onOpenButtonsModal={() => setIsButtonsModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasGcode={!!parsedGcode && parsedGcode.lines.length > 0}
        onImportFile={handleImportFile}
        onExportGcode={handleExportGcode}
        panelVisibility={{
          visualizer: true,
          jog: true,
          streamer: true,
          macros: showMacroBar,
          dro: true,
        }}
        onTogglePanel={(panel) => {
          if (panel === 'macros') {
            toggleMacroBar();
          }
        }}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 flex overflow-hidden p-2 md:p-3 gap-2 md:gap-3 relative">
        {/* Visualizer Tab (Persistent) */}
        <div className={`flex-1 grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 h-full overflow-hidden ${activeTab === 'visualizer' ? 'grid' : 'hidden'}`}>
          {/* Left: 2D/3D Real-time Path Visualizer + Custom Action Buttons Bar */}
          <div className="md:col-span-7 xl:col-span-8 flex flex-col gap-2 h-full overflow-hidden">
            {/* Custom Macro Toolbar (Fully hideable to maximize workspace area) */}
            {showMacroBar && (
              <div className="shrink-0">
                <CustomButtonsBar
                  currentProfile={currentProfile}
                  parsedGcode={parsedGcode}
                  onOpenManageModal={() => setIsButtonsModalOpen(true)}
                  onClose={() => toggleMacroBar(false)}
                />
              </div>
            )}

            {/* 2D/3D Interactive Canvas */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative min-h-0">
              <Visualizer2D3D
                parsedGcode={parsedGcode}
                currentProfile={currentProfile}
                liveState={liveState}
                activeLineIndex={activeExecutingLine}
                onGcodeUpdate={(updated) => setParsedGcode(updated)}
                onOpenGenerator={() => setActiveTab('generator')}
              />
            </div>
          </div>

          {/* Right: Jog Controller + G-Code Execution Streamer */}
          <div className="md:col-span-5 xl:col-span-4 flex flex-col gap-2 md:gap-3 h-full overflow-y-auto pr-1 pb-2">
            <JogController
              currentProfile={currentProfile}
              liveState={liveState}
            />
            <GcodeStreamer
              parsedGcode={parsedGcode}
              onGcodeLoaded={(parsed) => setParsedGcode(parsed)}
              currentProfile={currentProfile}
              liveState={liveState}
            />
          </div>
        </div>

        {/* Generator Tab (Persistent - State Never Lost When Switching Tabs!) */}
        <div className={`flex-1 h-full overflow-hidden ${activeTab === 'generator' ? 'block' : 'hidden'}`}>
          <GeneratorSuite
            currentProfile={currentProfile}
            onProfileUpdate={handleProfileSave}
            onGcodeGenerated={(parsed) => {
              setParsedGcode(parsed);
              setActiveTab('visualizer');
            }}
            onSwitchToVisualizer={() => setActiveTab('visualizer')}
          />
        </div>

        {/* Settings Tab */}
        <div className={`flex-1 h-full overflow-y-auto ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
          <GrblSettingsManager />
        </div>

        {/* Console View: Constrained to max 1/3 width with workspace visualizer visible in remaining 2/3 */}
        <div className={`flex-1 grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 h-full overflow-hidden ${activeTab === 'console' ? 'grid' : 'hidden'}`}>
          {/* Left 2/3: Live 2D/3D Workspace Surface is fully visible */}
          <div className="md:col-span-7 xl:col-span-8 flex flex-col gap-2 h-full overflow-hidden">
            {showMacroBar && (
              <div className="shrink-0">
                <CustomButtonsBar
                  currentProfile={currentProfile}
                  parsedGcode={parsedGcode}
                  onOpenManageModal={() => setIsButtonsModalOpen(true)}
                  onClose={() => toggleMacroBar(false)}
                />
              </div>
            )}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative min-h-0">
              <Visualizer2D3D
                parsedGcode={parsedGcode}
                currentProfile={currentProfile}
                liveState={liveState}
                activeLineIndex={activeExecutingLine}
                onGcodeUpdate={(updated) => setParsedGcode(updated)}
                onOpenGenerator={() => setActiveTab('generator')}
              />
            </div>
          </div>

          {/* Right 1/3: GRBL Terminal & Command Console */}
          <div className="md:col-span-5 xl:col-span-4 h-full overflow-hidden border border-slate-800 rounded-xl bg-slate-900 shadow-xl">
            <GrblConsole />
          </div>
        </div>
      </main>

      {/* Machine Profile & Configuration Modal */}
      <MachineProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentProfile={currentProfile}
        onSaveProfile={handleProfileSave}
      />

      {/* Settings Modal (Theme, Language, Full Backup/Restore) */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onThemeChanged={(t) => applyThemeCssVars(t)}
        onOpenButtonsModal={() => {
          setIsSettingsModalOpen(false);
          setIsButtonsModalOpen(true);
        }}
      />

      {/* Custom Buttons / Macro Manager Modal */}
      <CustomButtonsModal
        isOpen={isButtonsModalOpen}
        onClose={() => setIsButtonsModalOpen(false)}
        currentProfile={currentProfile}
        parsedGcode={parsedGcode}
      />
    </div>
  );
}
