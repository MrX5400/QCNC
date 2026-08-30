import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { GcodeStreamer } from './components/GcodeStreamer';
import { JogController } from './components/JogController';
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
  const [isLaserDbModalOpen, setIsLaserDbModalOpen] = useState<boolean>(false);
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
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState<boolean>(false);
  
  const handleResizeRightPanelStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isRightPanelCollapsed) return; // Prevent resizing when collapsed
    e.preventDefault();
    const startX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const startWidth = rightPanelWidth;
    let animationFrameId: number;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : (moveEvent as MouseEvent).clientX;
      const delta = startX - currentX; // Dragging left increases right panel width
      
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        // Limit max width to avoid squishing the workspace completely (leave at least 300px for workspace)
        const maxWidth = window.innerWidth - 300;
        const newWidth = Math.max(280, Math.min(maxWidth, startWidth + delta));
        setRightPanelWidth(newWidth);
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleMouseMove);
      document.removeEventListener('touchend', handleMouseUp);
      document.body.style.cursor = '';
      cancelAnimationFrame(animationFrameId);
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



  // Import and Export handlers for top bar
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const handleImportFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const gcodeExts = ['nc', 'gcode', 'ngc', 'tap', 'cnc', 'txt'];
    if (gcodeExts.includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          const parsed = parseGcode(text, currentProfile.penUpZ);
          setParsedGcode(parsed);
          setActiveTab('visualizer');
        }
      };
      reader.readAsText(file);
    } else {
      // It's a vector or image file, pass to Workspace (generator tab)
      setPendingImportFile(file);
      setActiveTab('generator');
    }
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
        onOpenLaserDbModal={() => setIsLaserDbModalOpen(true)}
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
                  >
                    <JogController
                      currentProfile={currentProfile}
                      liveState={liveState}
                    />
                  </GcodeStreamer>
                </div>
              }
              liveState={liveState}
              parsedGcode={parsedGcode}
              isLaserDbModalOpen={isLaserDbModalOpen}
              onOpenLaserDbModal={() => setIsLaserDbModalOpen(true)}
              onCloseLaserDbModal={() => setIsLaserDbModalOpen(false)}
              pendingImportFile={pendingImportFile}
              onPendingImportFileHandled={() => setPendingImportFile(null)}
            />
          </div>

          {/* Resizer & Toggle (Only visible if activeTab === 'console') */}
          {activeTab === 'console' && (
            <div className="flex flex-col items-center justify-center shrink-0 z-20 relative -ml-3">
              <button
                onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
                className="z-50 w-6 h-16 bg-indigo-600 hover:bg-indigo-500 text-white rounded-l-md flex items-center justify-center transition-colors shadow-lg border-y border-l border-indigo-400"
                title={isRightPanelCollapsed ? 'Konsole einblenden' : 'Konsole einklappen'}
              >
                <div style={{ transform: isRightPanelCollapsed ? 'rotate(180deg)' : 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
              </button>
              
              {!isRightPanelCollapsed && (
                <div 
                  className="hidden md:flex w-2 h-16 mt-2 hover:bg-indigo-500/50 cursor-col-resize justify-center items-center rounded transition-colors group"
                  onMouseDown={handleResizeRightPanelStart}
                  onTouchStart={handleResizeRightPanelStart}
                >
                  <div className="w-0.5 h-full bg-slate-700 group-hover:bg-indigo-400 rounded-full transition-colors" />
                </div>
              )}
            </div>
          )}

          {/* Console Right Panel */}
          <div 
            className={`flex flex-row h-full shrink-0 transition-all duration-300 ${activeTab === 'console' ? 'flex' : 'hidden'} ${isRightPanelCollapsed ? 'w-0 opacity-0 border-none ml-0' : 'md:gap-3 gap-2 ml-1'} absolute md:relative right-0 top-0 bottom-0 z-10 bg-slate-950 p-2 md:p-0 md:bg-transparent`} 
            style={{ width: isRightPanelCollapsed ? 0 : (window.innerWidth >= 768 ? rightPanelWidth : '100%'), maxWidth: window.innerWidth >= 768 ? '60vw' : '100%' }}
          >
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
