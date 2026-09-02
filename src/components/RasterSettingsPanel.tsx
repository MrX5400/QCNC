import React, { useState } from 'react';
import { RasterSettings } from '../types/cnc';
import { Settings2, Sun, Lock, Unlock, ChevronDown, ChevronRight, Layers, Hash, Ruler } from 'lucide-react';

interface RasterSettingsPanelProps {
  settings: RasterSettings;
  onSettingsChange: (s: RasterSettings | ((prev: RasterSettings) => RasterSettings)) => void;
  image?: HTMLImageElement | null;
  stats?: { paths: number; nodes: number; lengthMm: number };
}

export function RasterSettingsPanel({ settings, onSettingsChange, image, stats }: RasterSettingsPanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [hatchOpen, setHatchOpen] = useState(false);
  const [lockAspect, setLockAspect] = useState(true);

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = Number(e.target.value);
    onSettingsChange(s => ({
      ...s,
      targetWidth: w,
      targetHeight: (lockAspect && image) ? (w * (image.height / image.width)) : s.targetHeight
    }));
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    onSettingsChange(s => ({
      ...s,
      targetHeight: h,
      targetWidth: (lockAspect && image) ? (h * (image.width / image.height)) : s.targetWidth
    }));
  };

  const applyPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    onSettingsChange(s => {
      const ns = { ...s };
      switch (preset) {
        case 'logo':
          ns.mode = 'contour_trace';
          ns.threshold = 128; 
          ns.alphamax = 0.0; // Scharfe Ecken
          ns.turdsize = 2; // Kaum filtern
          ns.blurRadius = 0;
          ns.opttolerance = 0.2;
          break;
        case 'calligraphy':
          ns.mode = 'centerline_trace';
          ns.threshold = 160;
          ns.blurRadius = 1;
          ns.alphamax = 1.0;
          ns.turdsize = 5;
          ns.opttolerance = 0.1;
          break;
        case 'sketch':
          ns.mode = 'contour_trace';
          ns.threshold = 200;
          ns.alphamax = 1.0;
          ns.turdsize = 10;
          ns.blurRadius = 1;
          ns.opttolerance = 0.5;
          break;
        case 'clipart':
          ns.mode = 'contour_trace';
          ns.threshold = 140;
          ns.alphamax = 1.0;
          ns.blurRadius = 2;
          ns.turdsize = 20;
          ns.opttolerance = 0.3;
          break;
        case 'photo':
          ns.mode = 'contour_trace';
          ns.threshold = 128;
          ns.blurRadius = 3;
          ns.alphamax = 1.33;
          ns.turdsize = 30;
          ns.opttolerance = 0.8;
          break;
      }
      return ns;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden w-full text-slate-300">
      <div className="flex-none p-4 border-b border-slate-800 bg-slate-950/50">
        <h2 className="text-slate-100 font-bold flex items-center gap-2 mb-3">
          <Settings2 className="w-4 h-4 text-indigo-400" /> Profil & Zielgröße
        </h2>
        
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[0.65rem] font-bold text-slate-400 uppercase">Preset-Profil</label>
            <select onChange={applyPreset} defaultValue="custom" className="w-full bg-slate-800 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none">
              <option value="custom">-- Profil wählen --</option>
              <option value="logo">🎯 Logo / Scharfe Kanten</option>
              <option value="calligraphy">🖋️ Kalligrafie & Feinschrift</option>
              <option value="sketch">📐 Strichzeichnung / Skizze</option>
              <option value="clipart">🎨 ClipArt / Flächig</option>
              <option value="photo">🖼️ Foto / Silhouette</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[0.65rem] text-slate-400 font-medium">Breite (mm)</label>
              <input type="number" value={settings.targetWidth} onChange={handleWidthChange} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200" />
            </div>
            <button onClick={() => setLockAspect(!lockAspect)} className={`mt-4 p-2 rounded-lg border transition-colors ${lockAspect ? 'bg-indigo-900/50 border-indigo-500/50 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
              {lockAspect ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </button>
            <div className="flex-1 space-y-1">
              <label className="text-[0.65rem] text-slate-400 font-medium">Höhe (mm)</label>
              <input type="number" value={settings.targetHeight} onChange={handleHeightChange} className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-200" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Hauptmenü */}
        <div className="space-y-4">
          <h3 className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Hauptmenü</h3>
          
          <div className="space-y-1">
            <label className="text-[0.65rem] text-slate-400 font-medium">Vektorisierungs-Modus</label>
            <select 
              value={settings.mode} 
              onChange={e => onSettingsChange(s => ({...s, mode: e.target.value as any}))}
              className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none"
            >
              <option value="contour_trace">Außenkontur (Flächen & Logos)</option>
              <option value="centerline_trace">Mittellinie (1-Strich Handschrift)</option>
              <option value="hatch">Infill / Schraffur</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
              <span>Binarisierungs-Schwellenwert (Threshold)</span>
              <span className="text-emerald-400 font-mono">{settings.threshold}</span>
            </div>
            <input type="range" min="0" max="255" value={settings.threshold} onChange={e => onSettingsChange(s => ({...s, threshold: Number(e.target.value)}))} className="w-full accent-emerald-500 h-1.5" />
          </div>

          {/* Bildanpassungen */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <h3 className="text-[0.7rem] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" /> Bildanpassungen (Live)
            </h3>
            
            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Helligkeit</span>
                <span className="text-amber-400 font-mono">{settings.brightness || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.brightness || 0} onChange={e => onSettingsChange(s => ({...s, brightness: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Kontrast</span>
                <span className="text-amber-400 font-mono">{settings.contrast || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.contrast || 0} onChange={e => onSettingsChange(s => ({...s, contrast: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
                <span>Gamma</span>
                <span className="text-amber-400 font-mono">{settings.gamma || 1.0}</span>
              </div>
              <input type="range" min="0.2" max="3.0" step="0.05" value={settings.gamma || 1.0} onChange={e => onSettingsChange(s => ({...s, gamma: Number(e.target.value)}))} className="w-full accent-amber-500 h-1.5" />
            </div>
            
            <label className="flex items-center gap-2 text-[0.65rem] text-slate-300 cursor-pointer pt-1">
              <input type="checkbox" checked={settings.invert || false} onChange={e => onSettingsChange(s => ({...s, invert: e.target.checked}))} className="rounded bg-slate-950 border-slate-700 text-amber-500" />
              Farben umkehren (Invertieren)
            </label>
          </div>


          <div className="space-y-1">
            <div className="flex justify-between text-[0.65rem] text-slate-300 font-medium">
              <span>Vorfilter-Glättung / Schärfe (Blur)</span>
              <span className="text-emerald-400 font-mono">{settings.blurRadius || 0} px</span>
            </div>
            <input type="range" min="0" max="10" step="0.5" value={settings.blurRadius || 0} onChange={e => onSettingsChange(s => ({...s, blurRadius: Number(e.target.value)}))} className="w-full accent-emerald-500 h-1.5" />
          </div>

          <label className="flex items-center gap-2 text-[0.65rem] text-slate-300 cursor-pointer pt-1">
            <input type="checkbox" checked={settings.invert} onChange={e => onSettingsChange(s => ({...s, invert: e.target.checked}))} className="rounded bg-slate-950 border-slate-700 text-indigo-500 focus:ring-indigo-500" />
            Bildfarben invertieren (Hell/Dunkel tauschen)
          </label>
        </div>

        {/* Schraffur */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <button onClick={() => setHatchOpen(!hatchOpen)} className="w-full p-2.5 flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
            <span className="text-[0.65rem] font-bold text-slate-300 uppercase tracking-wider">Musterfüllung (Infill)</span>
            {hatchOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          
          {hatchOpen && (
            <div className="p-3 space-y-3 border-t border-slate-800">
              <select value={settings.fillPattern || 'none'} onChange={e => onSettingsChange(s => ({...s, fillPattern: e.target.value as any}))} className="w-full bg-slate-950 text-slate-300 rounded p-1.5 text-xs border border-slate-700 focus:border-indigo-500 outline-none">
                <option value="none">Keine Füllung</option>
                <option value="lines">〰️ Linien (Schraffur)</option>
                <option value="crosshatch">✖️ Kreuzschraffur</option>
                <option value="concentric">🎯 Konzentrisch</option>
                <option value="zigzag">📐 Zickzack</option>
                <option value="wave">〰️ Wellenmuster</option>
              </select>
              {settings.fillPattern && settings.fillPattern !== 'none' && (
                <>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[0.65rem] text-slate-400 font-medium">
                      <span>Dichte (Abstand in mm)</span>
                      <span className="text-indigo-400">{settings.fillSpacing || 2}</span>
                    </div>
                    <input type="range" min="0.2" max="10" step="0.2" value={settings.fillSpacing || 2} onChange={e => onSettingsChange(s => ({...s, fillSpacing: Number(e.target.value)}))} className="w-full accent-indigo-500 h-1.5" />
                  </div>
                  <label className="flex items-center gap-2 text-[0.65rem] text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={settings.fillIncludeContour ?? true} onChange={e => onSettingsChange(s => ({...s, fillIncludeContour: e.target.checked}))} className="rounded bg-slate-950 border-slate-700 text-indigo-500" />
                    Äußere Kontur mitzeichnen
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        {/* Erweiterte Einstellungen */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50">
          <button onClick={() => setAdvancedOpen(!advancedOpen)} className="w-full p-2.5 flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/60 transition-colors">
            <span className="text-[0.65rem] font-bold text-slate-300 uppercase tracking-wider">Erweiterte Einstellungen (Potrace)</span>
            {advancedOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </button>
          
          {advancedOpen && (
            <div className="p-3 space-y-4 border-t border-slate-800">
              <div className="space-y-1">
                <div className="flex justify-between text-[0.65rem] text-slate-400 font-medium">
                  <span title="alphamax: Bestimmt die Aggressivität, mit der spitze Ecken abgerundet werden.">Ecken-Schärfe (alphamax)</span>
                  <span className="text-cyan-400 font-mono">{settings.alphamax ?? 1.0}</span>
                </div>
                <input type="range" min="0" max="1.33" step="0.01" value={settings.alphamax ?? 1.0} onChange={e => onSettingsChange(s => ({...s, alphamax: Number(e.target.value)}))} className="w-full accent-cyan-500 h-1.5" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[0.65rem] text-slate-400 font-medium">
                  <span title="turdsize: Ignoriert Artefakte und Flecken unter dieser Pixelgröße.">Rauschunterdrückung (turdsize)</span>
                  <span className="text-cyan-400 font-mono">{settings.turdsize ?? 8} px</span>
                </div>
                <input type="range" min="0" max="100" value={settings.turdsize ?? 8} onChange={e => onSettingsChange(s => ({...s, turdsize: Number(e.target.value)}))} className="w-full accent-cyan-500 h-1.5" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[0.65rem] text-slate-400 font-medium">
                  <span title="opttolerance: Höhere Werte erzeugen weniger Kontrollpunkte, können aber zu geometrischen Abweichungen führen.">Kurvenoptimierung (opttolerance)</span>
                  <span className="text-cyan-400 font-mono">{settings.opttolerance ?? 0.2}</span>
                </div>
                <input type="range" min="0" max="1.5" step="0.05" value={settings.opttolerance ?? 0.2} onChange={e => onSettingsChange(s => ({...s, opttolerance: Number(e.target.value)}))} className="w-full accent-cyan-500 h-1.5" />
              </div>

              <div className="space-y-1">
                <label className="text-[0.65rem] text-slate-400 font-medium">Hintergrund-Behandlung (Alpha)</label>
                <select 
                  value={settings.bgBlendMode || 'white'} 
                  onChange={e => onSettingsChange(s => ({...s, bgBlendMode: e.target.value as any}))}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs focus:border-cyan-500 outline-none"
                >
                  <option value="white">Mit Weiß mischen (Standard)</option>
                  <option value="black">Mit Schwarz mischen</option>
                  <option value="transparent_threshold">Transparenz ignorieren</option>
                </select>
              </div>
            </div>
          )}
        </div>
        
      </div>

      <div className="flex-none p-3 bg-slate-950 border-t border-slate-800">
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-900 rounded border border-slate-800 p-1.5 flex flex-col items-center justify-center">
            <Layers className="w-3.5 h-3.5 text-slate-500 mb-0.5" />
            <span className="text-[0.55rem] text-slate-500">Pfade</span>
            <span className="text-xs font-bold text-slate-300">{stats?.paths || 0}</span>
          </div>
          <div className="bg-slate-900 rounded border border-slate-800 p-1.5 flex flex-col items-center justify-center">
            <Hash className="w-3.5 h-3.5 text-slate-500 mb-0.5" />
            <span className="text-[0.55rem] text-slate-500">Nodes</span>
            <span className="text-xs font-bold text-slate-300">{stats?.nodes || 0}</span>
          </div>
          <div className="bg-slate-900 rounded border border-slate-800 p-1.5 flex flex-col items-center justify-center">
            <Ruler className="w-3.5 h-3.5 text-slate-500 mb-0.5" />
            <span className="text-[0.55rem] text-slate-500">Länge</span>
            <span className="text-xs font-bold text-slate-300">{stats ? Math.round(stats.lengthMm) : 0}mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
