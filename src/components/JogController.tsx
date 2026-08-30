import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  ArrowUpLeft, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ArrowDownRight,
  Crosshair, 
  Home, 
  Unlock, 
  RotateCcw, 
  PenTool, 
  Move, 
  Zap, 
  Flame,
  Gauge,
  Ruler,
  MousePointerClick,
  Activity,
  Keyboard,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { grbl } from '../services/grblService';
import { GrblState, MachineProfile } from '../types/cnc';
import { useI18n } from '../contexts/ThemeLanguageContext';

interface JogControllerProps {
  currentProfile: MachineProfile;
  liveState: GrblState;
}

export const JogController: React.FC<JogControllerProps> = ({
  currentProfile,
  liveState,
}) => {
  const { t } = useI18n();
  const [stepSize, setStepSize] = useState<number>(10);
  const [feedrate, setFeedrate] = useState<number>(currentProfile.travelFeedrate || 2000);
  const [jogMode, setJogMode] = useState<'step' | 'continuous'>('step');
  const [isPenDown, setIsPenDown] = useState<boolean>(false);
  const [isLaserFiring, setIsLaserFiring] = useState<boolean>(false);
  const [activeContinuousKey, setActiveContinuousKey] = useState<string | null>(null);
  const [enableKeyboardJog, setEnableKeyboardJog] = useState<boolean>(true);
  const [isCompact, setIsCompact] = useState<boolean>(false);

  const isJobRunning = liveState?.status?.toUpperCase() === 'RUN' || liveState?.status?.toUpperCase() === 'HOLD';

  const stepOptions = [0.1, 1, 5, 10, 50, 100];
  const feedrateOptions = [100, 500, 2000, 5000, 10000];

  const continuousJogInterval = useRef<any>(null);

  // Step-based Jogging
  const handleStepJog = async (axis: 'X' | 'Y' | 'Z', direction: number) => {
    if (isJobRunning) return;
    await grbl.jog(axis, direction * stepSize, feedrate);
  };

  const handleStepDiagonalJog = async (dirX: number, dirY: number) => {
    if (isJobRunning) return;
    const dist = stepSize * 0.7071; // preserve vector length
    const cmd = `$J=G91 G21 X${(dirX * dist).toFixed(3)} Y${(dirY * dist).toFixed(3)} F${feedrate}`;
    await grbl.send(cmd);
  };

  // Continuous Jogging (Hold to Move)
  const handleStartContinuous = async (key: string, axis: 'X' | 'Y' | 'Z', dir: number) => {
    if (isJobRunning) return;
    setActiveContinuousKey(key);
    await grbl.startContinuousJog(axis, dir, feedrate);
  };

  const handleStartContinuousDiagonal = async (key: string, dirX: number, dirY: number) => {
    if (isJobRunning) return;
    setActiveContinuousKey(key);
    await grbl.startContinuousDiagonalJog(dirX, dirY, feedrate);
  };

  const handleStopContinuous = async () => {
    setActiveContinuousKey(null);
    if (continuousJogInterval.current) {
      clearInterval(continuousJogInterval.current);
      continuousJogInterval.current = null;
    }
    await grbl.stopContinuousJog();
  };

  const handleTogglePen = async () => {
    if (isPenDown) {
      await grbl.send(currentProfile.penUpCommand);
      setIsPenDown(false);
    } else {
      await grbl.send(currentProfile.penDownCommand);
      setIsPenDown(true);
    }
  };

  const handleLaserTest = async () => {
    if (isLaserFiring) {
      await grbl.send('M5');
      setIsLaserFiring(false);
    } else {
      await grbl.send('M3 S50'); // 5% power test beam
      setIsLaserFiring(true);
    }
  };

  const handleTouchStartAxis = (e: React.TouchEvent, key: string, axis: 'X' | 'Y' | 'Z', dir: number) => {
    if (e.cancelable) e.preventDefault();
    if (jogMode === 'continuous') {
      handleStartContinuous(key, axis, dir);
    } else {
      handleStepJog(axis, dir);
    }
  };

  const handleTouchEndAxis = (e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault();
    if (jogMode === 'continuous') {
      handleStopContinuous();
    }
  };

  const handleTouchStartDiag = (e: React.TouchEvent, key: string, dirX: number, dirY: number) => {
    if (e.cancelable) e.preventDefault();
    if (jogMode === 'continuous') {
      handleStartContinuousDiagonal(key, dirX, dirY);
    } else {
      handleStepDiagonalJog(dirX, dirY);
    }
  };

  // Keyboard Jogging Listener (when not inside input/textarea)
  useEffect(() => {
    if (!enableKeyboardJog) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleStepJog('Y', 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleStepJog('Y', -1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleStepJog('X', -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleStepJog('X', 1);
      } else if (e.key === 'PageUp') {
        e.preventDefault();
        handleStepJog('Z', 1);
      } else if (e.key === 'PageDown') {
        e.preventDefault();
        handleStepJog('Z', -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        grbl.returnToZero();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enableKeyboardJog, stepSize, feedrate]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 shadow-xl text-slate-200">
    

      {/* Mode Switcher: Step vs Continuous */}
      <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
        <button
          onClick={() => setJogMode('step')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-semibold transition-all ${
            jogMode === 'step'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>{t.jogStepMode || 'Schritt-Modus'}</span>
        </button>
        <button
          onClick={() => setJogMode('continuous')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md font-semibold transition-all ${
            jogMode === 'continuous'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{t.jogContinuousMode || 'Dauer-Joggen'}</span>
        </button>
      </div>

      {/* Step Size Slider & Presets */}
      {jogMode === 'step' && (
        <div className="space-y-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-[0.6875rem]">
            <span className="text-slate-300 font-medium flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-indigo-400" />
              {t.stepDistance || 'Schrittweite'}:
            </span>
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
              <input
                type="number"
                min="0.01"
                max="500"
                step="0.1"
                value={stepSize}
                onChange={(e) => setStepSize(Math.max(0.01, Number(e.target.value)))}
                className="w-14 bg-transparent text-right font-mono text-xs text-indigo-300 focus:outline-none"
              />
              <span className="text-[0.625rem] text-slate-500 font-mono">mm</span>
            </div>
          </div>

          {/* Continuous Interactive Step Slider */}
          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="range"
              min="0.05"
              max="100"
              step="0.05"
              value={stepSize}
              onChange={(e) => setStepSize(Number(e.target.value))}
              className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
            <span className="font-mono text-[0.625rem] text-indigo-300 w-12 text-right">{stepSize} mm</span>
          </div>

          {/* Quick Step Preset Buttons */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 pt-1 font-mono text-[0.625rem]">
            {stepOptions.map((s) => (
              <button
                key={s}
                onClick={() => setStepSize(s)}
                className={`py-1 rounded border transition-all ${
                  stepSize === s
                    ? 'bg-indigo-600 text-white border-indigo-400 font-bold shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {s < 1 ? s : `${s}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feedrate Speed Slider & Presets */}
      <div className="space-y-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
        <div className="flex items-center justify-between text-[0.6875rem]">
          <span className="text-slate-300 font-medium flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            {t.feedrateSpeed || 'Jog-Geschwindigkeit'}:
          </span>
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
            <input
              type="number"
              min="0"
              max="15000"
              step="50"
              value={feedrate}
              onChange={(e) => setFeedrate(Math.max(50, Number(e.target.value)))}
              className="w-16 bg-transparent text-right font-mono text-xs text-amber-300 focus:outline-none"
            />
            <span className="text-[0.625rem] text-slate-500 font-mono">mm/min</span>
          </div>
        </div>

        {/* Continuous Interactive Speed Slider */}
        <div className="flex items-center gap-2 pt-0.5">
          <input
            type="range"
            min="0"
            max="15000"
            step="25"
            value={feedrate}
            onChange={(e) => setFeedrate(Number(e.target.value))}
            className="flex-1 accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <span className="font-mono text-[0.625rem] text-amber-300 w-16 text-right">{feedrate} mm/min</span>
        </div>

        {/* Quick Speed Preset Buttons */}
        <div className="grid grid-cols-5 gap-1 font-mono text-[0.625rem]">
          {feedrateOptions.map((f) => (
            <button
              key={f}
              onClick={() => setFeedrate(f)}
              className={`py-1 rounded border transition-all ${
                feedrate === f
                  ? 'bg-amber-600 text-white border-amber-400 font-bold shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TACTILE CNC JOGGING DISC & PRECISION DIRECTIONAL ARROWS                    */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-center gap-6 py-2">
        {/* XY Circular D-Pad Controller */}
        <div className="relative w-48 h-48 rounded-full bg-slate-950 p-2 border-2 border-slate-800 shadow-2xl flex items-center justify-center">
          {/* Subtle Direction Ring Guides */}
          <div className="absolute inset-2 rounded-full border border-slate-800/80 pointer-events-none" />
          <div className="absolute inset-8 rounded-full border border-slate-800/40 pointer-events-none" />

          {/* 1. TOP: Y+ (Hinten) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('Y+', 'Y', 1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'Y+', 'Y', 1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('Y', 1) : undefined}
            className={`absolute top-2 left-1/2 -translate-x-1/2 w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-t-2xl rounded-b-md flex flex-col items-center justify-center transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'Y+'
                ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/50 scale-95 ring-2 ring-cyan-300'
                : 'bg-gradient-to-b from-cyan-950/80 to-slate-900 hover:from-cyan-900 hover:to-slate-800 border border-cyan-800/50 text-cyan-400 hover:text-cyan-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Dauer-Y+' : 'Y+ (Hinten / Oben) [Pfeil Oben]'}
          >
            <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* 2. BOTTOM: Y- (Vorne) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('Y-', 'Y', -1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'Y-', 'Y', -1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('Y', -1) : undefined}
            className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-b-2xl rounded-t-md flex flex-col items-center justify-center transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'Y-'
                ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/50 scale-95 ring-2 ring-cyan-300'
                : 'bg-gradient-to-t from-cyan-950/80 to-slate-900 hover:from-cyan-900 hover:to-slate-800 border border-cyan-800/50 text-cyan-400 hover:text-cyan-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Dauer-Y-' : 'Y- (Vorne / Unten) [Pfeil Unten]'}
          >
            <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* 3. LEFT: X- (Links) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('X-', 'X', -1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'X-', 'X', -1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('X', -1) : undefined}
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-14 h-14 rounded-l-2xl rounded-r-md flex flex-col items-center justify-center transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'X-'
                ? 'bg-rose-500 text-slate-950 shadow-rose-500/50 scale-95 ring-2 ring-rose-300'
                : 'bg-gradient-to-r from-rose-950/80 to-slate-900 hover:from-rose-900 hover:to-slate-800 border border-rose-800/50 text-rose-400 hover:text-rose-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Dauer-X-' : 'X- (Links) [Pfeil Links]'}
          >
            <div className="flex items-center">
              <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
              <span className="text-[0.625rem] font-bold font-mono tracking-wider -ml-0.5">X-</span>
            </div>
          </button>

          {/* 4. RIGHT: X+ (Rechts) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('X+', 'X', 1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'X+', 'X', 1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('X', 1) : undefined}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-r-2xl rounded-l-md flex flex-col items-center justify-center transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'X+'
                ? 'bg-rose-500 text-slate-950 shadow-rose-500/50 scale-95 ring-2 ring-rose-300'
                : 'bg-gradient-to-l from-rose-950/80 to-slate-900 hover:from-rose-900 hover:to-slate-800 border border-rose-800/50 text-rose-400 hover:text-rose-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Dauer-X+' : 'X+ (Rechts) [Pfeil Rechts]'}
          >
            <div className="flex items-center">
              <span className="text-[0.625rem] font-bold font-mono tracking-wider -mr-0.5">X+</span>
              <ChevronRight className="w-5 h-5 stroke-[2.5]" />
            </div>
          </button>

          {/* DIAGONALS (NW, NE, SW, SE) */}
          {/* NW */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuousDiagonal('NW', -1, 1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartDiag(e, 'NW', -1, 1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepDiagonalJog(-1, 1) : undefined}
            className={`absolute top-4 left-4 w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 touch-none select-none ${
              activeContinuousKey === 'NW'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
            title="Diagonal Links-Oben (NW)"
          >
            <ArrowUpLeft className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* NE */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuousDiagonal('NE', 1, 1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartDiag(e, 'NE', 1, 1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepDiagonalJog(1, 1) : undefined}
            className={`absolute top-4 right-4 w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 touch-none select-none ${
              activeContinuousKey === 'NE'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
            title="Diagonal Rechts-Oben (NE)"
          >
            <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* SW */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuousDiagonal('SW', -1, -1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartDiag(e, 'SW', -1, -1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepDiagonalJog(-1, -1) : undefined}
            className={`absolute bottom-4 left-4 w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 touch-none select-none ${
              activeContinuousKey === 'SW'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
            title="Diagonal Links-Unten (SW)"
          >
            <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* SE */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuousDiagonal('SE', 1, -1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartDiag(e, 'SE', 1, -1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepDiagonalJog(1, -1) : undefined}
            className={`absolute bottom-4 right-4 w-9 h-9 md:w-10 md:h-10 lg:w-11 lg:h-11 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-90 touch-none select-none ${
              activeContinuousKey === 'SE'
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800'
            }`}
            title="Diagonal Rechts-Unten (SE)"
          >
            <ArrowDownRight className="w-4 h-4 md:w-5 md:h-5" />
          </button>

          {/* CENTER: Return to Zero / Reticle */}
          <button
            onClick={() => grbl.returnToZero()}
            className="w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-full bg-indigo-600/30 hover:bg-indigo-600 active:bg-indigo-700 border-2 border-indigo-500/60 flex flex-col items-center justify-center text-indigo-300 hover:text-white transition-all shadow-lg hover:shadow-indigo-500/50 active:scale-90 select-none touch-none z-10"
            title="Fahre zu Nullpunkt (G0 X0 Y0) [Home-Taste]"
          >
            <Crosshair className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-2 w-full justify-center mt-4">
        {/* Z Controls & Pen */}
        <div className="flex gap-2">
          {/* Z+ (Tool Up) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('Z+', 'Z', 1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'Z+', 'Z', 1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('Z', 1) : undefined}
            className={`w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl flex flex-col items-center justify-center font-bold transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'Z+'
                ? 'bg-indigo-500 text-white scale-95 shadow-indigo-500/50 ring-2 ring-indigo-300'
                : 'bg-gradient-to-b from-indigo-950/80 to-slate-900 hover:from-indigo-900 hover:to-slate-800 border border-indigo-800/50 text-indigo-400 hover:text-indigo-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Z+ Heben' : 'Z+ (Tool Heben) [Bild Auf]'}
          >
            <ChevronUp className="w-5 h-5 md:w-6 md:h-6" />
          </button>

          {/* Z-Achse Homing in middle */}
          <button
            onClick={() => grbl.send('G53 G0 Z0')}
            className="w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-lg flex flex-col items-center justify-center text-[0.5625rem] font-bold transition-all shadow-sm select-none touch-none bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800"
            title="Z-Achse Homing / Z-Home (G53 G0 Z0)"
          >
            <Move className="w-4 h-4 md:w-5 md:h-5 mb-0.5 opacity-80" />
            <span className="hidden md:inline">Z-Home</span>
          </button>

          {/* Z- (Tool Down) */}
          <button
            onMouseDown={jogMode === 'continuous' ? () => handleStartContinuous('Z-', 'Z', -1) : undefined}
            onMouseUp={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onMouseLeave={jogMode === 'continuous' ? handleStopContinuous : undefined}
            onTouchStart={(e) => handleTouchStartAxis(e, 'Z-', 'Z', -1)}
            onTouchEnd={handleTouchEndAxis}
            onClick={jogMode === 'step' ? () => handleStepJog('Z', -1) : undefined}
            className={`w-11 h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-xl flex flex-col items-center justify-center font-bold transition-all shadow-md active:scale-95 select-none touch-none ${
              activeContinuousKey === 'Z-'
                ? 'bg-indigo-500 text-white scale-95 shadow-indigo-500/50 ring-2 ring-indigo-300'
                : 'bg-gradient-to-t from-indigo-950/80 to-slate-900 hover:from-indigo-900 hover:to-slate-800 border border-indigo-800/50 text-indigo-400 hover:text-indigo-200'
            }`}
            title={jogMode === 'continuous' ? 'Gedrückt halten für Z- Senken' : 'Z- (Tool Senken) [Bild Ab]'}
          >
            <ChevronDown className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>

      {/* Keyboard Shortcut Hint */}
      <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 rounded-lg text-[0.625rem] text-slate-400 border border-slate-800/50">
        <div className="flex items-center gap-1.5">
          <Keyboard className="w-3 h-3 text-indigo-400" />
          <span>Tastatur: Pfeiltasten (XY), BildAuf/Ab (Z), Home (X0 Y0)</span>
        </div>
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={enableKeyboardJog}
            onChange={(e) => setEnableKeyboardJog(e.target.checked)}
            className="w-3 h-3 rounded bg-slate-800 text-indigo-500"
          />
          <span>Aktiv</span>
        </label>
      </div>

      {/* Work Zero & Machine Operations */}
      <div className="space-y-2 pt-1 border-t border-slate-800/60">
        <label className="text-[0.6875rem] font-medium text-slate-400 uppercase tracking-wider">
          {t.setWorkZero || 'Nullpunkt setzen (WPos Zero)'}
        </label>
        <div className="grid grid-cols-4 gap-1.5 text-xs font-mono">
          <button
            onClick={() => grbl.setWorkZero()}
            className="py-1.5 bg-indigo-950/80 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-md border border-indigo-800/60 transition-colors font-bold shadow-sm"
            title="Nullpunkt für alle Achsen X0 Y0 Z0 setzen"
          >
            Zero XYZ
          </button>
          <button
            onClick={() => grbl.setWorkZero('X')}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-white rounded-md border border-slate-700 transition-colors"
          >
            Zero X
          </button>
          <button
            onClick={() => grbl.setWorkZero('Y')}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white rounded-md border border-slate-700 transition-colors"
          >
            Zero Y
          </button>
          <button
            onClick={() => grbl.setWorkZero('Z')}
            className="py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-white rounded-md border border-slate-700 transition-colors"
          >
            Zero Z
          </button>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-3 gap-1.5 pt-1 text-xs">
        <button
          onClick={() => grbl.home()}
          className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
          title="Homing-Zyklus starten ($H)"
        >
          <Home className="w-3.5 h-3.5 text-blue-400" />
          <span>Home ($H)</span>
        </button>

        <button
          onClick={() => grbl.unlock()}
          className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
          title="Alarmzustand entsperren ($X)"
        >
          <Unlock className="w-3.5 h-3.5 text-amber-400" />
          <span>Unlock ($X)</span>
        </button>

        <button
          onClick={() => grbl.softReset()}
          className="flex items-center justify-center gap-1.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md border border-slate-700 transition-colors"
          title="Soft-Reset an GRBL senden (Ctrl+X)"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          <span>Soft-Reset</span>
        </button>
      </div>

      {/* Real-time Feed Rate Override */}
      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-1.5 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 font-medium">Vorschub-Echtzeit-Override:</span>
          <span className="text-cyan-400 font-mono font-bold">{liveState?.overrides?.feed ?? 100}%</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 font-mono text-[0.6875rem]">
          <button
            onClick={() => grbl.sendRaw('\x92')}
            className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            -10%
          </button>
          <button
            onClick={() => grbl.sendRaw('\x90')}
            className="py-1 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded border border-slate-700 font-bold"
          >
            100%
          </button>
          <button
            onClick={() => grbl.sendRaw('\x91')}
            className="py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
          >
            +10%
          </button>
        </div>
      </div>

      {/* Laser test button if laser actuator */}
      {currentProfile.actuatorType === 'laser' && (
        <button
          onClick={handleLaserTest}
          className={`w-full py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
            isLaserFiring
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-800 hover:bg-slate-700 text-rose-400 border border-rose-900/40'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>{isLaserFiring ? 'Laser AUS (M5)' : 'Laser Fadenkreuz Test (5% M3 S50)'}</span>
        </button>
      )}
    </div>
  );
};
