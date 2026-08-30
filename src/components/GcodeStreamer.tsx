import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Upload, 
  FileText, 
  Download, 
  Sliders, 
  CheckCircle2, 
  Clock, 
  Activity,
  Layers,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { grbl, StreamProgressListener } from '../services/grblService';
import { GrblState, MachineProfile, ParsedGcode } from '../types/cnc';
import { parseGcode } from '../services/gcodeParser';

interface GcodeStreamerProps {
  parsedGcode: ParsedGcode | null;
  onGcodeLoaded: (parsed: ParsedGcode) => void;
  currentProfile: MachineProfile;
  liveState: GrblState;
  children?: React.ReactNode;
}

export const GcodeStreamer: React.FC<GcodeStreamerProps> = ({
  parsedGcode,
  onGcodeLoaded,
  currentProfile,
  liveState,
  children,
}) => {
  const [streamProgress, setStreamProgress] = useState({
    currentLine: 0,
    totalLines: 0,
    percent: 0,
    isStreaming: false,
    isPaused: false,
  });

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [feedOverride, setFeedOverride] = useState<number>(100);
  const codeViewerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsub = grbl.onStreamProgress((prog) => {
      setStreamProgress(prog);
    });
    return () => unsub();
  }, []);

  // Timer for active streaming job
  useEffect(() => {
    let timer: any = null;
    if (streamProgress.isStreaming && !streamProgress.isPaused) {
      timer = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [streamProgress.isStreaming, streamProgress.isPaused]);

  const [autoScrollGcode, setAutoScrollGcode] = useState<boolean>(true);

  // Auto-scroll G-Code viewer to executing line strictly isolated within inner box
  useEffect(() => {
    if (autoScrollGcode && codeViewerRef.current && streamProgress.currentLine > 0) {
      const container = codeViewerRef.current;
      // Target scroll strictly inside container: calculate line height ~24px
      const targetScroll = Math.max(0, (streamProgress.currentLine - 3) * 24);
      container.scrollTop = targetScroll;
    }
  }, [streamProgress.currentLine, autoScrollGcode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const parsed = parseGcode(text, currentProfile.penUpZ);
        onGcodeLoaded(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleStartStream = () => {
    if (!parsedGcode || parsedGcode.lines.length === 0) return;
    setElapsedSeconds(0);
    grbl.startStream(parsedGcode.lines);
  };

  const handlePauseResume = () => {
    if (streamProgress.isPaused) {
      grbl.resumeStream();
    } else {
      grbl.pauseStream();
    }
  };

  const handleStop = () => {
    grbl.stopStream();
  };

  const handleFeedOverrideChange = (delta: number) => {
    if (delta === 0) {
      grbl.sendRaw('\x90'); // Set 100%
      setFeedOverride(100);
    } else if (delta === 10) {
      grbl.sendRaw('\x91'); // +10%
      setFeedOverride(f => Math.min(200, f + 10));
    } else if (delta === -10) {
      grbl.sendRaw('\x92'); // -10%
      setFeedOverride(f => Math.max(10, f - 10));
    }
  };

  const handleDownloadGcode = (ext: string = 'nc') => {
    if (!parsedGcode) return;
    const blob = new Blob([parsedGcode.raw], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plotter_job_${Date.now()}.${ext}`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Load sample calibration pattern
  const handleLoadSamplePattern = (type: 'calibration' | 'mandala' | 'vinyl_box') => {
    let sampleGcode = '';

    if (type === 'calibration') {
      sampleGcode = `; Calibration Test Pattern
G90
G21
${currentProfile.penUpCommand}
G0 X10.000 Y10.000 F${currentProfile.travelFeedrate}
${currentProfile.penDownCommand}
G1 X60.000 Y10.000 F${currentProfile.drawingFeedrate}
G1 X60.000 Y60.000
G1 X10.000 Y60.000
G1 X10.000 Y10.000
G1 X60.000 Y60.000
${currentProfile.penUpCommand}
G0 X10.000 Y60.000
${currentProfile.penDownCommand}
G1 X60.000 Y10.000
${currentProfile.penUpCommand}
G0 X0.000 Y0.000
`;
    } else if (type === 'vinyl_box') {
      sampleGcode = `; Drag Knife Sticker Cut Sample
G90
G21
${currentProfile.penUpCommand}
G0 X20.450 Y20.000 F${currentProfile.travelFeedrate}
${currentProfile.penDownCommand}
G1 X50.450 Y20.000 F${currentProfile.drawingFeedrate}
; Swivel corner 90 deg
G1 X50.000 Y20.450 F600
G1 X50.000 Y50.450 F${currentProfile.drawingFeedrate}
; Swivel corner 90 deg
G1 X49.550 Y50.000 F600
G1 X19.550 Y50.000 F${currentProfile.drawingFeedrate}
; Swivel corner 90 deg
G1 X20.000 Y49.550 F600
G1 X20.000 Y19.550 F${currentProfile.drawingFeedrate}
; Overcut 1.0mm
G1 X21.450 Y20.000 F${currentProfile.drawingFeedrate}
${currentProfile.penUpCommand}
G0 X0.000 Y0.000
`;
    } else {
      // Mandala Star
      const lines = [
        'G90', 'G21', currentProfile.penUpCommand,
        `G0 X50.000 Y50.000 F${currentProfile.travelFeedrate}`,
      ];
      const rays = 12;
      const rInner = 15;
      const rOuter = 35;
      for (let i = 0; i < rays; i++) {
        const a1 = (i / rays) * Math.PI * 2;
        const a2 = ((i + 0.5) / rays) * Math.PI * 2;
        const x1 = 50 + Math.cos(a1) * rOuter;
        const y1 = 50 + Math.sin(a1) * rOuter;
        const x2 = 50 + Math.cos(a2) * rInner;
        const y2 = 50 + Math.sin(a2) * rInner;

        lines.push(`G0 X${x1.toFixed(3)} Y${y1.toFixed(3)}`);
        lines.push(currentProfile.penDownCommand);
        lines.push(`G1 X${x2.toFixed(3)} Y${y2.toFixed(3)} F${currentProfile.drawingFeedrate}`);
        lines.push(`G1 X50.000 Y50.000`);
        lines.push(currentProfile.penUpCommand);
      }
      lines.push('G0 X0.000 Y0.000');
      sampleGcode = lines.join('\n');
    }

    const parsed = parseGcode(sampleGcode, currentProfile.penUpZ);
    onGcodeLoaded(parsed);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-3 shadow-lg text-slate-200 shrink-0">
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <h3 className="font-bold text-xs text-slate-100">G-Code Job</h3>
          </div>

          {parsedGcode && parsedGcode.lines.length > 0 && (
            <span className="text-[0.625rem] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              {parsedGcode.stats.lineCount} Zeilen
            </span>
          )}
        </div>

        {/* If no gcode loaded */}
        {(!parsedGcode || parsedGcode.lines.length === 0) && (
          <div className="text-xs text-slate-500 font-medium">
            Kein G-Code geladen
          </div>
        )}

        {/* Active Job Progress & Controls */}
        {parsedGcode && parsedGcode.lines.length > 0 && (
          <div className="space-y-2">
            {/* Progress Bar & Line count */}
            <div className="space-y-1 bg-slate-950/70 p-2 rounded border border-slate-800">
              <div className="flex items-center justify-between text-[0.6875rem] font-mono">
                <span className="text-slate-400">
                  <span className="text-cyan-400 font-bold">{streamProgress.currentLine}</span> / {streamProgress.totalLines || parsedGcode.stats.lineCount}
                </span>
              <span className="text-slate-200 font-bold">{streamProgress.percent}%</span>
            </div>

            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 h-2.5 rounded-full transition-all duration-150"
                style={{ width: `${streamProgress.percent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[0.6875rem] text-slate-400 pt-1">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Laufzeit: <span className="text-slate-200 font-mono">{formatTime(elapsedSeconds)}</span></span>
              </div>
              <div>
                <span>Geschätzt gesamt: <span className="text-slate-300 font-mono">{formatTime(parsedGcode.stats.estimatedTimeSec)}</span></span>
              </div>
            </div>
          </div>

          {/* Stream Buttons: Start, Pause/Resume, Stop */}
          <div className="grid grid-cols-3 gap-2">
            {!streamProgress.isStreaming ? (
              <button
                onClick={handleStartStream}
                className="col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Job Starten</span>
              </button>
            ) : (
              <button
                onClick={handlePauseResume}
                className={`col-span-2 py-2.5 text-white rounded-md text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all ${
                  streamProgress.isPaused
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                {streamProgress.isPaused ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Fortsetzen</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pausieren (Feed Hold)</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleStop}
              disabled={!streamProgress.isStreaming}
              className="py-2.5 bg-rose-600/80 hover:bg-rose-600 active:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600/80 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Abbrechen</span>
            </button>
          </div>
        </div>
      )}
      </div>
      
      {children}
      
      {/* G-Code Inspektor at the bottom */}
      {parsedGcode && parsedGcode.lines.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 shadow-lg text-slate-200 flex-1 flex flex-col min-h-[150px] overflow-hidden">
          <div className="flex items-center justify-between text-[0.6875rem] text-slate-400 mb-2 shrink-0">
              <span>G-Code Inspektor ({parsedGcode.lines.length} Zeilen):</span>
              <button
                onClick={() => setAutoScrollGcode(!autoScrollGcode)}
                className={`px-2 py-0.5 rounded text-[0.625rem] font-medium border flex items-center gap-1 transition-colors ${
                  autoScrollGcode
                    ? 'bg-cyan-950/70 border-cyan-700/60 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Automatisches Mitscrollen beim Ausführen"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${autoScrollGcode ? 'bg-cyan-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>Auto-Scroll: {autoScrollGcode ? 'AN' : 'AUS'}</span>
              </button>
            </div>
            <div
              ref={codeViewerRef}
              className="h-36 overflow-y-auto overscroll-contain bg-slate-950 rounded-md border border-slate-800 p-2 font-mono text-[0.6875rem] leading-relaxed select-text"
            >
              {parsedGcode.lines.map((line, idx) => {
                const lineNum = idx + 1;
                const isCurrent = streamProgress.currentLine === lineNum;
                const isComment = line.trim().startsWith(';');

                return (
                  <div
                    key={idx}
                    id={`gcode-line-${lineNum}`}
                    className={`flex items-center px-1.5 rounded transition-colors ${
                      isCurrent
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border-l-2 border-cyan-400'
                        : isComment
                        ? 'text-slate-600'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span className="w-8 text-slate-600 select-none text-[0.625rem]">{lineNum}</span>
                    <span className="flex-1 truncate">{line}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
