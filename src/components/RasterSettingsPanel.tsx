import React, { useState } from 'react';
import { RasterSettings } from '../types/cnc';
import { autoDetectImageSettings } from '../services/imageVectorizer';
import { 
  Settings2, Sun, Lock, Unlock, ChevronDown, ChevronRight, 
  Layers, Hash, Ruler, Sparkles, RotateCcw, 
  AlignJustify, Spline, LayoutGrid, CheckCircle2
} from 'lucide-react';

interface RasterSettingsPanelProps {
  settings: RasterSettings;
  onSettingsChange: (s: RasterSettings | ((prev: RasterSettings) => RasterSettings)) => void;
  image?: HTMLImageElement | null;
  stats?: { paths: number; nodes: number; lengthMm: number };
}

export function RasterSettingsPanel({ settings, onSettingsChange, image, stats }: RasterSettingsPanelProps) {
  const [lockAspect, setLockAspect] = useState(true);

  const setPartial = (partial: Partial<RasterSettings>) => {
    onSettingsChange(s => ({ ...s, ...partial }));
  };

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const w = Number(e.target.value);
    setPartial({
      targetWidth: w,
      targetHeight: (lockAspect && image) ? (w * (image.height / image.width)) : settings.targetHeight
    });
  };

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = Number(e.target.value);
    setPartial({
      targetHeight: h,
      targetWidth: (lockAspect && image) ? (h * (image.width / image.height)) : settings.targetWidth
    });
  };

  const handleAutoOptimize = () => {
    if (!image) return;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(image, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const detected = autoDetectImageSettings(imgData);
      setPartial(detected);
    }
  };

  const applyPreset = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const preset = e.target.value;
    onSettingsChange(s => {
      const ns = { ...s };
      switch (preset) {
        case 'logo':
          ns.traceStrategy = 'contour';
          ns.contourMode = 'contour_only';
          ns.fillMode = 'none';
          ns.threshold = 128; 
          ns.alphamax = 0.0;
          ns.curveSmoothness = 25;
          ns.contrast = 30;
          break;
        case 'round':
          ns.traceStrategy = 'contour';
          ns.contourMode = 'contour_only';
          ns.fillMode = 'none';
          ns.alphamax = 1.2;
          ns.curveSmoothness = 90;
          break;
        case 'calligraphy':
          ns.traceStrategy = 'centerline';
          ns.fillMode = 'none';
          break;
        case 'stippling':
          ns.traceStrategy = 'pattern';
          ns.fillMode = 'dots_grid';
          ns.fillPattern = 'dots_grid';
          ns.stippleDensity = 50;
          break;
        case 'hatch':
          ns.traceStrategy = 'pattern';
          ns.fillMode = 'lines';
          ns.fillPattern = 'lines';
          ns.hatchAngle = 45;
          break;
        case 'laser_m4':
          ns.traceStrategy = 'scanline';
          ns.fillMode = 'laser_m4_scanline';
          ns.scanlineType = 'zigzag';
          break;
      }
      return ns;
    });
  };

  const resetAll = () => {
    setPartial({
      threshold: 135, brightness: 0, contrast: 25, gamma: 1.0, invert: false, 
      blurRadius: 1, alphamax: 1.0, turdsize: 8, opttolerance: 0.2, curveSmoothness: 65,
      traceStrategy: 'contour', contourMode: 'contour_only', fillMode: 'none'
    });
  };

  const strategy = settings.traceStrategy || 'contour';
  
  return (
    <div className="flex flex-col h-full bg-slate-900 overflow-hidden w-full text-slate-300">
      <div className="flex-none p-4 border-b border-slate-800 bg-slate-950/50">
        <h2 className="text-slate-100 font-bold flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-indigo-400" /> Profil & Zielgröße
          </div>
          <button onClick={resetAll} className="text-slate-400 hover:text-slate-200 p-1" title="Alles zurücksetzen">
            <RotateCcw className="w-4 h-4" />
          </button>
        </h2>

        <div className="flex items-center gap-2 mb-3">
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

        <div className="flex items-center gap-2 pt-1">
          <span className="text-slate-500 text-[0.65rem] whitespace-nowrap">Optionales Profil:</span>
          <select onChange={applyPreset} defaultValue="custom" className="w-full bg-slate-900 border border-slate-800 text-slate-400 text-xs py-1 px-2 rounded focus:border-indigo-500 outline-none">
            <option value="custom">-- Manuelle Konfiguration --</option>
            <option value="logo">🎯 Logo & Scharfe Kanten</option>
            <option value="round">🟢 Rundliche Objekte & Glatte Kurven</option>
            <option value="calligraphy">🖋️ Strichzeichnung & Text</option>
            <option value="laser_m4">🔥 M4 Laser Scanline</option>
            <option value="stippling">✨ Stippling / Punkt-Gravur</option>
            <option value="hatch">/// Gravur mit Flächenfüllung</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        
        {/* Schritt 1: Wie soll getraced werden? */}
        <div className="space-y-3">
          <h3 className="text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider">Schritt 1: Wie soll getraced werden?</h3>
          
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'contour', label: 'Kontur', icon: Layers },
              { id: 'centerline', label: 'Mittellinie', icon: Spline },
              { id: 'scanline', label: 'Linie für Linie', icon: AlignJustify },
              { id: 'pattern', label: 'Muster', icon: LayoutGrid }
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => setPartial({ traceStrategy: t.id as any })}
                className={`flex items-center gap-2 p-2 rounded border text-xs font-medium transition-all ${strategy === t.id ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
              >
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Kontext-Optionen */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-3">
            {strategy === 'contour' && (
              <>
                <select 
                  value={settings.contourMode || 'contour_only'} 
                  onChange={e => {
                    const mode = e.target.value;
                    setPartial({ 
                      contourMode: mode as any,
                      fillIncludeContour: mode !== 'fill_only',
                      fillPattern: mode === 'contour_only' ? 'none' : (settings.fillPattern === 'none' ? 'lines' : settings.fillPattern),
                      fillMode: mode === 'contour_only' ? 'none' : (settings.fillMode === 'none' ? 'lines' : settings.fillMode) as any
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none mb-2"
                >
                  <option value="contour_only">Nur Kontur (Außen & Innen)</option>
                  <option value="contour_fill">Kontur + Füllung</option>
                  <option value="fill_only">Nur Füllung (Randlos)</option>
                </select>

                {settings.contourMode !== 'contour_only' && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <select value={settings.fillPattern || 'lines'} onChange={e => setPartial({ fillPattern: e.target.value as any, fillMode: e.target.value as any })} className="w-full bg-slate-950 text-slate-300 rounded p-1.5 text-xs border border-slate-700 focus:border-indigo-500 outline-none">
                      <option value="lines">〰️ Linien (Schraffur)</option>
                      <option value="crosshatch">✖️ Kreuzschraffur</option>
                      <option value="concentric">🎯 Konzentrisch</option>
                      <option value="spiral">🌀 Spirale</option>
                      <option value="wave">🌊 Wellenlinie</option>
                      <option value="dots_grid">✨ Punktraster</option>
                      <option value="stippling">🔵 Stippling</option>
                      <option value="dithered_hatch">〽️ Jitter-Schraffur</option>
                    </select>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                        <span>Füll-Abstand (mm)</span>
                        <span className="text-indigo-400">{settings.fillSpacing || 2}</span>
                      </div>
                      <input type="range" min="0.2" max="10" step="0.2" value={settings.fillSpacing || 2} onChange={e => setPartial({ fillSpacing: Number(e.target.value) })} className="w-full accent-indigo-500 h-1.5" />
                    </div>

                    {['lines', 'crosshatch', 'wave', 'dithered_hatch'].includes(settings.fillPattern || '') && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                          <span>Winkel (Grad)</span>
                          <span className="text-indigo-400">{settings.hatchAngle || 45}°</span>
                        </div>
                        <input type="range" min="0" max="180" step="1" value={settings.hatchAngle || 45} onChange={e => setPartial({ hatchAngle: Number(e.target.value) })} className="w-full accent-indigo-500 h-1.5" />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {strategy === 'scanline' && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 0, label: 'Horizontal' },
                    { val: 90, label: 'Vertikal' },
                    { val: 45, label: 'Diagonal' }
                  ].map(a => (
                    <button 
                      key={a.val}
                      onClick={() => setPartial({ scanlineAngle: a.val })}
                      className={`p-1.5 rounded border text-[0.6rem] font-bold text-center ${settings.scanlineAngle === a.val ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'}`}
                    >
                      {a.label} ({a.val}°)
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                    <span>Linienabstand (mm)</span>
                    <button onClick={() => setPartial({ fillSpacing: 0.2 })} className="text-slate-500"><RotateCcw className="w-3 h-3" /></button>
                  </div>
                  <input type="range" min="0.05" max="2" step="0.05" value={settings.fillSpacing || 0.2} onChange={e => setPartial({ fillSpacing: Number(e.target.value) })} className="w-full accent-indigo-500 h-1.5" />
                  <div className="text-right text-[0.6rem] text-indigo-400">{settings.fillSpacing || 0.2} mm</div>
                </div>

                <div className="space-y-1">
                  <label className="text-[0.65rem] text-slate-400 font-medium">Muster-Typ</label>
                  <select 
                    value={settings.scanlineType || 'zigzag'} 
                    onChange={e => setPartial({ scanlineType: e.target.value as any, fillMode: 'laser_m4_scanline' })}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs focus:border-indigo-500 outline-none"
                  >
                    <option value="parallel">Gleichmäßig parallel</option>
                    <option value="zigzag">Zick-Zack (Schnell)</option>
                  </select>
                </div>
              </>
            )}

            {strategy === 'pattern' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'lines', label: 'Schraffur', icon: '〰️' },
                    { id: 'crosshatch', label: 'Kreuzgitter', icon: '✖️' },
                    { id: 'spiral', label: 'Spirale', icon: '🌀' },
                    { id: 'concentric', label: 'Konzentrisch', icon: '🎯' },
                    { id: 'dots_grid', label: 'Punktraster', icon: '✨' },
                    { id: 'wave', label: 'Wellenlinie', icon: '🌊' },
                    { id: 'stippling', label: 'Stippling', icon: '🔵' },
                    { id: 'dithered_hatch', label: 'Jitter-Schraffur', icon: '〽️' }
                  ].map(p => (
                    <button 
                      key={p.id}
                      onClick={() => setPartial({ fillPattern: p.id as any, fillMode: p.id as any })}
                      className={`flex items-center gap-1.5 p-2 rounded border text-xs font-medium transition-all ${settings.fillPattern === p.id ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                    >
                      <span className="text-base">{p.icon}</span> <span className="truncate">{p.label}</span>
                    </button>
                  ))}
                </div>

                <div className="space-y-1 mt-3">
                  <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                    <span>Muster-Abstand (mm)</span>
                    <span className="text-indigo-400">{settings.fillSpacing || 2}</span>
                  </div>
                  <input type="range" min="0.2" max="10" step="0.2" value={settings.fillSpacing || 2} onChange={e => setPartial({ fillSpacing: Number(e.target.value) })} className="w-full accent-indigo-500 h-1.5" />
                </div>
                
                {['lines', 'crosshatch', 'wave', 'dithered_hatch'].includes(settings.fillPattern || '') && (
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                      <span>Winkel (Grad)</span>
                      <span className="text-indigo-400">{settings.hatchAngle || 45}°</span>
                    </div>
                    <input type="range" min="0" max="180" step="1" value={settings.hatchAngle || 45} onChange={e => setPartial({ hatchAngle: Number(e.target.value) })} className="w-full accent-indigo-500 h-1.5" />
                  </div>
                )}
              </>
            )}

            {strategy === 'centerline' && (
              <div className="text-xs text-slate-400 p-2 text-center">
                Die Mittellinien-Vektorisierung eignet sich ideal für Strichzeichnungen und Text. Keine Füllungseinstellungen verfügbar.
              </div>
            )}
          </div>

          {/* Laser Power Range (visible for scanline and pattern) */}
          {(strategy === 'scanline' || strategy === 'pattern') && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-3 space-y-3 mt-3">
              <h4 className="text-[0.65rem] font-bold text-orange-400 uppercase tracking-wider">⚡ Laser Power Range (S-Wert)</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                    <span>Min Power</span>
                    <span className="text-orange-400 font-mono">{settings.laserPowerMin ?? 0}</span>
                  </div>
                  <input type="range" min="0" max="1000" step="10" value={settings.laserPowerMin ?? 0} onChange={e => setPartial({ laserPowerMin: Number(e.target.value) })} className="w-full accent-orange-500 h-1.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                    <span>Max Power</span>
                    <span className="text-orange-400 font-mono">{settings.laserPowerMax ?? 1000}</span>
                  </div>
                  <input type="range" min="0" max="1000" step="10" value={settings.laserPowerMax ?? 1000} onChange={e => setPartial({ laserPowerMax: Number(e.target.value) })} className="w-full accent-orange-500 h-1.5" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Schritt 2: Bild-Grundeinstellungen */}
        <div className="space-y-3 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-[0.7rem] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5" /> Schritt 2: Bild-Grundeinstellungen
            </h3>
            <button onClick={handleAutoOptimize} className="flex-none flex items-center justify-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white px-2.5 py-1 rounded-md text-[0.65rem] font-bold transition-all shadow-lg">
              <Sparkles className="w-3 h-3" /> Auto
            </button>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[0.65rem] text-slate-300 font-medium">
              <div className="flex items-center gap-1.5">
                <span>Schwellenwert (Threshold)</span>
                <button onClick={() => setPartial({ threshold: 128 })} className="text-slate-500 hover:text-slate-300"><RotateCcw className="w-3 h-3" /></button>
              </div>
              <span className="text-amber-400 font-mono">{settings.threshold}</span>
            </div>
            <input type="range" min="0" max="255" value={settings.threshold} onChange={e => setPartial({ threshold: Number(e.target.value) })} className="w-full accent-amber-500 h-1.5" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-300 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Kontrast</span>
                  <button onClick={() => setPartial({ contrast: 0 })} className="text-slate-500"><RotateCcw className="w-3 h-3" /></button>
                </div>
                <span className="text-amber-400 font-mono">{settings.contrast || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.contrast || 0} onChange={e => setPartial({ contrast: Number(e.target.value) })} className="w-full accent-amber-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-300 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Helligkeit</span>
                  <button onClick={() => setPartial({ brightness: 0 })} className="text-slate-500"><RotateCcw className="w-3 h-3" /></button>
                </div>
                <span className="text-amber-400 font-mono">{settings.brightness || 0}</span>
              </div>
              <input type="range" min="-100" max="100" value={settings.brightness || 0} onChange={e => setPartial({ brightness: Number(e.target.value) })} className="w-full accent-amber-500 h-1.5" />
            </div>
          </div>
          
          <label className="flex items-center gap-2 text-[0.65rem] text-slate-300 cursor-pointer pt-1">
            <input type="checkbox" checked={settings.invert || false} onChange={e => setPartial({ invert: e.target.checked })} className="rounded bg-slate-950 border-slate-700 text-amber-500" />
            Farben umkehren (Invertieren)
          </label>
        </div>

        {/* Erweiterte Einstellungen */}
        <details className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/50 group">
          <summary className="w-full p-2.5 flex items-center justify-between bg-slate-800/30 hover:bg-slate-800/60 transition-colors cursor-pointer list-none">
            <span className="text-[0.65rem] font-bold text-slate-300 uppercase tracking-wider">Erweiterte Bild- & Glättungseinstellungen</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          
          <div className="p-3 space-y-4 border-t border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Kurvenglättung / Rundheit</span>
                  <button onClick={() => setPartial({ curveSmoothness: 65 })} className="text-slate-500 hover:text-slate-300"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-cyan-400 font-mono">{settings.curveSmoothness ?? 65} %</span>
              </div>
              <input type="range" min="0" max="100" value={settings.curveSmoothness ?? 65} onChange={e => setPartial({ curveSmoothness: Number(e.target.value) })} className="w-full accent-cyan-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Ecken-Schärfe (alphamax)</span>
                  <button onClick={() => setPartial({ alphamax: 1.0 })} className="text-slate-500 hover:text-slate-300"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-cyan-400 font-mono">{settings.alphamax ?? 1.0}</span>
              </div>
              <input type="range" min="0" max="1.33" step="0.01" value={settings.alphamax ?? 1.0} onChange={e => setPartial({ alphamax: Number(e.target.value) })} className="w-full accent-cyan-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Rauschunterdrückung (turdsize)</span>
                  <button onClick={() => setPartial({ turdsize: 8 })} className="text-slate-500 hover:text-slate-300"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-cyan-400 font-mono">{settings.turdsize ?? 8} px</span>
              </div>
              <input type="range" min="0" max="100" value={settings.turdsize ?? 8} onChange={e => setPartial({ turdsize: Number(e.target.value) })} className="w-full accent-cyan-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[0.65rem] text-slate-400 font-medium">
                <div className="flex items-center gap-1.5">
                  <span>Vorfilter-Blur (px)</span>
                  <button onClick={() => setPartial({ blurRadius: 1 })} className="text-slate-500 hover:text-slate-300"><RotateCcw className="w-3.5 h-3.5" /></button>
                </div>
                <span className="text-cyan-400 font-mono">{settings.blurRadius ?? 1} px</span>
              </div>
              <input type="range" min="0" max="10" step="0.5" value={settings.blurRadius ?? 1} onChange={e => setPartial({ blurRadius: Number(e.target.value) })} className="w-full accent-cyan-500 h-1.5" />
            </div>

            <div className="space-y-1">
              <label className="text-[0.65rem] text-slate-400 font-medium">Hintergrund-Alpha-Mischung</label>
              <select 
                value={settings.bgBlendMode || 'white'} 
                onChange={e => setPartial({ bgBlendMode: e.target.value as any })}
                className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs focus:border-cyan-500 outline-none"
              >
                <option value="white">Weiß</option>
                <option value="black">Schwarz</option>
                <option value="transparent_threshold">Ignorieren</option>
              </select>
            </div>
          </div>
        </details>
        
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
