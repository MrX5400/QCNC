import React, { useState, useEffect, useRef } from 'react';
import { 
  Square, 
  Zap, 
  Home, 
  Crosshair, 
  Target, 
  Wind, 
  Unlock, 
  RotateCcw, 
  Power, 
  Flame, 
  Navigation, 
  Move, 
  SlidersHorizontal,
  PenTool,
  Info,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Check,
  Sparkles,
  Terminal,
  CornerDownLeft,
  Minimize2,
  Maximize2,
  X,
  EyeOff
} from 'lucide-react';
import { 
  CustomButton, 
  loadCustomButtons, 
  saveCustomButtons, 
  executeMacroSequence,
  substituteMacroVariables
} from '../services/customButtonsService';
import { grbl } from '../services/grblService';
import { MachineProfile, ParsedGcode } from '../types/cnc';

interface CustomButtonsBarProps {
  currentProfile: MachineProfile;
  parsedGcode: ParsedGcode | null;
  onOpenManageModal: () => void;
  onClose?: () => void;
}

export const CustomButtonsBar: React.FC<CustomButtonsBarProps> = ({
  currentProfile,
  parsedGcode,
  onOpenManageModal,
  onClose,
}) => {
  const [buttons, setButtons] = useState<CustomButton[]>(() => loadCustomButtons());
  const [executingMacroId, setExecutingMacroId] = useState<string | null>(null);
  const [executingStepInfo, setExecutingStepInfo] = useState<{ step: number; total: number; line: string } | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isWrapMode, setIsWrapMode] = useState<boolean>(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; button: CustomButton | null }>({
    isOpen: false,
    button: null,
  });
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; isError?: boolean } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Reload buttons on custom event or storage
  useEffect(() => {
    const handleUpdate = () => {
      setButtons(loadCustomButtons());
    };
    window.addEventListener('storage', handleUpdate);
    window.addEventListener('custom-buttons-updated', handleUpdate);
    return () => {
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('custom-buttons-updated', handleUpdate);
    };
  }, []);

  const showToast = (text: string, isError: boolean = false) => {
    setFeedbackToast({ text, isError });
    setTimeout(() => setFeedbackToast(null), 3000);
  };

  // Icon Resolver
  const renderIcon = (iconName: string, className: string = 'w-3.5 h-3.5 shrink-0') => {
    switch (iconName) {
      case 'Square': return <Square className={className} />;
      case 'Zap': return <Zap className={className} />;
      case 'Home': return <Home className={className} />;
      case 'Crosshair': return <Crosshair className={className} />;
      case 'Target': return <Target className={className} />;
      case 'Wind': return <Wind className={className} />;
      case 'Unlock': return <Unlock className={className} />;
      case 'RotateCcw': return <RotateCcw className={className} />;
      case 'Power': return <Power className={className} />;
      case 'Flame': return <Flame className={className} />;
      case 'Navigation': return <Navigation className={className} />;
      case 'Move': return <Move className={className} />;
      case 'PenTool': return <PenTool className={className} />;
      case 'Info': return <Info className={className} />;
      case 'Sparkles': return <Sparkles className={className} />;
      case 'Terminal': return <Terminal className={className} />;
      case 'CornerDownLeft': return <CornerDownLeft className={className} />;
      default: return <Zap className={className} />;
    }
  };

  const getColorClasses = (color: CustomButton['color'], isRunning: boolean = false) => {
    if (isRunning) {
      return 'bg-purple-900/80 text-white border-purple-400 animate-pulse';
    }
    switch (color) {
      case 'purple':
        return 'bg-purple-950/40 hover:bg-purple-900/70 text-purple-300 border-purple-800/50 hover:border-purple-600';
      case 'rose':
        return 'bg-rose-950/40 hover:bg-rose-900/70 text-rose-300 border-rose-800/50 hover:border-rose-600';
      case 'cyan':
        return 'bg-cyan-950/40 hover:bg-cyan-900/70 text-cyan-300 border-cyan-800/50 hover:border-cyan-600';
      case 'teal':
        return 'bg-teal-950/40 hover:bg-teal-900/70 text-teal-300 border-teal-800/50 hover:border-teal-600';
      case 'blue':
        return 'bg-blue-950/40 hover:bg-blue-900/70 text-blue-300 border-blue-800/50 hover:border-blue-600';
      case 'emerald':
        return 'bg-emerald-950/40 hover:bg-emerald-900/70 text-emerald-300 border-emerald-800/50 hover:border-emerald-600';
      case 'amber':
        return 'bg-amber-950/40 hover:bg-amber-900/70 text-amber-300 border-amber-800/50 hover:border-amber-600';
      case 'indigo':
        return 'bg-indigo-950/40 hover:bg-indigo-900/70 text-indigo-300 border-indigo-800/50 hover:border-indigo-600';
      case 'slate':
      default:
        return 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 border-slate-700/80 hover:border-slate-600';
    }
  };

  const handleRunMacro = async (macro: CustomButton) => {
    if (executingMacroId) {
      showToast('Ein Makro wird bereits ausgeführt', true);
      return;
    }

    setExecutingMacroId(macro.id);
    setExecutingStepInfo({ step: 1, total: 1, line: macro.name });

    try {
      const result = await executeMacroSequence(
        macro,
        currentProfile,
        parsedGcode,
        (step, total, lineText) => {
          setExecutingStepInfo({ step, total, line: lineText });
        }
      );

      if (result.success) {
        showToast(`✓ ${result.message}`);
      } else {
        showToast(`✕ ${result.message}`, true);
      }
    } catch (err: any) {
      showToast(`✕ Fehler: ${err.message || err}`, true);
    } finally {
      setExecutingMacroId(null);
      setExecutingStepInfo(null);
    }
  };

  const handleButtonClick = (macro: CustomButton) => {
    if (macro.requireConfirmation) {
      setConfirmDialog({ isOpen: true, button: macro });
    } else {
      handleRunMacro(macro);
    }
  };

  const visibleButtons = buttons.filter(b => b.isVisible);

  // Horizontal scroll on mouse wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isWrapMode && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-lg px-2 py-1 shadow-sm transition-all text-xs select-none">
      <div className="flex items-center justify-between gap-2">
        {/* Left Side: Collapse Toggle & Label & Running Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors touch-none"
            title={isCollapsed ? 'Makroleiste aufklappen' : 'Makroleiste minimieren'}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5 text-amber-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>

          <div 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="flex items-center gap-1 cursor-pointer font-semibold text-[11px] text-slate-300 hover:text-white transition-colors min-h-[44px] select-none touch-none"
            title="Klicken zum Ein-/Ausklappen"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Makros</span>
            <span className="text-[10px] text-slate-500 font-mono">({visibleButtons.length})</span>
          </div>

          {/* Running Progress Badge */}
          {executingMacroId && executingStepInfo && (
            <div className="flex items-center gap-1.5 bg-purple-950/80 border border-purple-600/70 text-purple-200 px-2 py-0.5 rounded text-[10px] font-mono animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
              <span className="truncate max-w-[120px]">
                {executingStepInfo.step}/{executingStepInfo.total}: {executingStepInfo.line}
              </span>
            </div>
          )}

          {/* Toast Notification */}
          {feedbackToast && !executingMacroId && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border animate-fade-in ${
              feedbackToast.isError
                ? 'bg-rose-950/80 border-rose-800 text-rose-300'
                : 'bg-emerald-950/80 border-emerald-800 text-emerald-300'
            }`}>
              {feedbackToast.isError ? <AlertCircle className="w-3 h-3" /> : <Check className="w-3 h-3" />}
              <span className="truncate max-w-[160px]">{feedbackToast.text}</span>
            </div>
          )}
        </div>

        {/* Center: Slim Buttons Strip (if not collapsed) */}
        {!isCollapsed && (
          <div
            ref={scrollContainerRef}
            onWheel={handleWheel}
            className={`flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 transition-all ${
              isWrapMode ? 'flex-wrap max-h-[100px] overflow-y-auto' : 'flex-nowrap'
            }`}
          >
            {visibleButtons.map((btn) => {
              const isRunning = executingMacroId === btn.id;
              return (
                <button
                  key={btn.id}
                  onClick={() => handleButtonClick(btn)}
                  disabled={!!executingMacroId}
                  className={`min-h-[44px] px-4 rounded text-[11px] font-medium border flex items-center gap-1.5 shrink-0 transition-all shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer touch-none ${getColorClasses(
                    btn.color,
                    isRunning
                  )}`}
                  title={`${btn.name}\n${btn.description || btn.command}`}
                >
                  {isRunning ? (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-300" />
                  ) : (
                    renderIcon(btn.icon)
                  )}
                  <span className="whitespace-nowrap font-medium">{btn.name}</span>
                </button>
              );
            })}

            {visibleButtons.length === 0 && (
              <span className="text-[11px] text-slate-500 italic py-1">
                Keine Makros eingeblendet.
              </span>
            )}
          </div>
        )}

        {/* Right Side: Tools & Quick Manage Modal */}
        <div className="flex items-center gap-1 shrink-0">
          {!isCollapsed && (
            <button
              onClick={() => setIsWrapMode(!isWrapMode)}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded text-xs transition-colors touch-none ${
                isWrapMode 
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={isWrapMode ? 'Einzeilige Ansicht (Scrollbar)' : 'Mehrzeilige Ansicht (Umbruch)'}
            >
              {isWrapMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={onOpenManageModal}
            className="min-h-[44px] px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded border border-slate-700 font-medium text-[11px] flex items-center justify-center gap-1.5 transition-colors touch-none"
            title="Makros verwalten, anordnen oder neue erstellen"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Verwalten</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-1 rounded text-slate-400 hover:text-rose-300 hover:bg-rose-950/50 border border-transparent hover:border-rose-800/40 transition-colors touch-none"
              title="Makroleiste komplett ausblenden (mehr Baufläche)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDialog.isOpen && confirmDialog.button && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-sm w-full p-4 space-y-3 shadow-2xl animate-fade-in text-xs">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-4 h-4" />
              <h3 className="font-bold text-sm text-slate-100">Makro ausführen bestätigen</h3>
            </div>
            <p className="text-slate-300">
              Möchtest du <strong>{confirmDialog.button.name}</strong> wirklich ausführen?
            </p>
            {confirmDialog.button.description && (
              <p className="text-[11px] text-slate-400 italic">
                {confirmDialog.button.description}
              </p>
            )}
            <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[10px] font-mono text-slate-300 max-h-24 overflow-y-auto whitespace-pre-line">
              {substituteMacroVariables(confirmDialog.button.command, currentProfile)}
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, button: null })}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Abbrechen
              </button>
              <button
                onClick={() => {
                  const b = confirmDialog.button;
                  setConfirmDialog({ isOpen: false, button: null });
                  if (b) handleRunMacro(b);
                }}
                className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-500 font-semibold"
              >
                Ausführen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
