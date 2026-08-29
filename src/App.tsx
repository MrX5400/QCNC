import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GcodeStreamer } from './components/GcodeStreamer';
import { Workspace } from './components/Workspace';
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

  const [rightPanelWidth, setRightPanelWidth] = useState<number>(380); // Default right panel width
  
  const handleResizeRightPanelStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startWidth = rightPanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const delta = startX - currentX; // Dragging left increases right panel width
      const newWidth = Math.max(280, Math.min(800, startWidth + delta));
      setRightPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.cursor = '';
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleMouseMove, { passive: false });
    document.addEventListener('touchend', handleMouseUp);
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

    return () => {
      unsubState();
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
        parsedGcode={parsedGcode}
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
        {/* Unified Workspace Tab */}
        <div className={`flex-1 flex flex-row gap-2 md:gap-3 h-full overflow-hidden ${activeTab === 'visualizer' || activeTab === 'generator' || activeTab === 'console' ? 'flex' : 'hidden'}`}>
          <div className="flex-1 flex flex-col gap-2 h-full overflow-hidden min-w-[300px]">
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
            <Workspace
              currentProfile={currentProfile}
              onProfileUpdate={handleProfileSave}
              onGcodeGenerated={(parsed) => {
                setParsedGcode(parsed);
              }}
              cncControls={
                <div className="flex flex-col gap-2 md:gap-3 h-full pb-2 shrink-0">
                  <GcodeStreamer
                    parsedGcode={parsedGcode}
                    onGcodeLoaded={(parsed) => setParsedGcode(parsed)}
                    currentProfile={currentProfile}
                    liveState={liveState}
                  />
                </div>
              }
              liveState={liveState}
              parsedGcode={parsedGcode}
            />
          </div>

          {/* Console Right Panel */}
          <div 
            className={`flex flex-row h-full gap-2 md:gap-3 shrink-0 ${activeTab === 'console' ? 'flex' : 'hidden'}`} 
            style={{ width: window.innerWidth >= 768 ? rightPanelWidth : '100%' }}
          >
            {/* Resizer */}
            <div 
              className="hidden md:flex w-2 -mx-1 hover:bg-indigo-500/50 cursor-col-resize justify-center items-center rounded transition-colors group z-10 shrink-0"
              onMouseDown={handleResizeRightPanelStart}
              onTouchStart={handleResizeRightPanelStart}
            >
              <div className="w-0.5 h-12 bg-slate-700 group-hover:bg-indigo-400 rounded-full transition-colors" />
            </div>

            {/* Right: GRBL Terminal & Command Console */}
            <div className="h-full w-full overflow-hidden border border-slate-800 rounded-xl bg-slate-900 shadow-xl">
              <GrblConsole />
            </div>
          </div>
        </div>

        {/* Settings Tab */}
        <div className={`flex-1 h-full overflow-y-auto ${activeTab === 'settings' ? 'block' : 'hidden'}`}>
          <GrblSettingsManager />
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
