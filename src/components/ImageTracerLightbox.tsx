import React, { useState, useEffect, useRef } from 'react';
import { Settings2, Sliders, Image as ImageIcon, Check, MousePointer2, Layers, Search, Maximize2, Minimize2, X, Plus, Minus, Move } from 'lucide-react';
import { RasterSettings, VectorPolyline } from '../types/cnc';
import { RasterSettingsPanel } from './RasterSettingsPanel';

interface ImageTracerLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  image: HTMLImageElement | null;
  settings: RasterSettings;
  onSettingsChange: (newSettings: RasterSettings) => void;
  polylines: VectorPolyline[];
  bwDataUrl?: string;
  isTracing: boolean;
}

export function ImageTracerLightbox({
  isOpen,
  onClose,
  image,
  settings,
  onSettingsChange,
  polylines,
  bwDataUrl,
  isTracing
}: ImageTracerLightboxProps) {
  const [activeTab, setActiveTab] = useState<'vectors' | 'split' | 'threshold' | 'original'>('split');
  const [splitPos, setSplitPos] = useState(50);
  const [isMaximized, setIsMaximized] = useState(false);
  const [tracerBgOpacity, setTracerBgOpacity] = useState(35);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className={`bg-slate-900 border border-slate-700/60 shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isMaximized ? 'fixed inset-0 rounded-none' : 'w-[90vw] h-[90vh] rounded-2xl max-w-7xl'
        }`}
      >
        {/* HEADER */}
        <div className="h-14 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
              <Search className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-slate-200 font-bold text-sm leading-tight flex items-center gap-2">
                Bild-Vektorisierung
                {isTracing && (
                  <span className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-cyan-900/50 text-cyan-400 text-[0.625rem] border border-cyan-500/30 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> Rechnet...
                  </span>
                )}
              </h2>
              <div className="text-[0.6875rem] text-slate-400 font-mono flex items-center gap-2">
                {image && (
                  <span>{image.width} × {image.height} px</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Tabs */}
            <div className="hidden sm:flex bg-slate-900 rounded-lg p-0.5 border border-slate-700">
              <button onClick={() => setActiveTab('vectors')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'vectors' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                Vektoren
              </button>
              <button onClick={() => setActiveTab('split')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'split' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                Vergleich (Split)
              </button>
              <button onClick={() => setActiveTab('threshold')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'threshold' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                SW-Schwelle
              </button>
              <button onClick={() => setActiveTab('original')} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${activeTab === 'original' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}>
                Original
              </button>
            </div>

            <div className="w-px h-6 bg-slate-800 mx-1 hidden sm:block" />

            {/* Maximize & Close */}
            <div className="flex items-center gap-1">
              <button onClick={() => setIsMaximized(!isMaximized)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title={isMaximized ? "Verkleinern" : "Vollbild"}>
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950 rounded-lg transition-colors" title="Schließen">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* MAIN CONTENT SPLIT */}
        <div className="flex flex-1 min-h-0 relative">
          
          {/* CANVAS AREA */}
          <div className="flex-1 bg-slate-950/80 relative flex flex-col min-h-0">
            <div 
              ref={containerRef}
              className="flex-1 relative overflow-hidden"
            >
              {/* 1. Original Image (Background) */}
              {image && (activeTab === 'original' || activeTab === 'split' || (activeTab === 'vectors' && tracerBgOpacity > 0)) && (
                <img 
                  src={image.src} 
                  alt="Original" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ opacity: activeTab === 'original' ? 1 : tracerBgOpacity / 100 }}
                />
              )}

              {/* 2. Threshold Image */}
              {(activeTab === 'threshold' || activeTab === 'split') && bwDataUrl && (
                <img 
                  src={bwDataUrl} 
                  alt="Threshold" 
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                  style={{ clipPath: activeTab === 'split' ? `inset(0 0 0 ${splitPos}%)` : 'none', opacity: activeTab === 'threshold' ? 1 : tracerBgOpacity / 100 }}
                />
              )}

              {/* 3. Vector Overlay */}
              {(activeTab === 'vectors' || activeTab === 'split') && polylines && (
                <svg 
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${settings.targetWidth || 100} ${settings.targetHeight || 100}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {polylines.map((poly, i) => (
                    <path
                      key={i}
                      d={`M ${poly.points.map(p => `${p.x},${p.y}`).join(' L ')} ${poly.closed ? 'Z' : ''}`}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.5px"
                      vectorEffect="non-scaling-stroke"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
              )}

              {/* Split Slider Handle */}
              {activeTab === 'split' && (
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-indigo-500 cursor-col-resize z-10 flex items-center justify-center group"
                  style={{ left: `${splitPos}%`, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    const parent = e.currentTarget.parentElement;
                    if (!parent) return;
                    const move = (me: MouseEvent) => {
                      const rect = parent.getBoundingClientRect();
                      const p = ((me.clientX - rect.left) / rect.width) * 100;
                      setSplitPos(Math.max(0, Math.min(100, p)));
                    };
                    const up = () => {
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    };
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  }}
                >
                  <div className="w-6 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <div className="w-1 h-4 border-l border-r border-indigo-200" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Overlay Controls (Opacity Slider for Vector Tab) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700/50 shadow-2xl pointer-events-auto">
               <div className="flex items-center gap-2">
                 <span className="text-xs font-semibold text-slate-300">Ansicht:</span>
                 <select 
                   value={activeTab}
                   onChange={(e) => setActiveTab(e.target.value as any)}
                   className="bg-slate-950 border border-slate-700 text-slate-200 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500 sm:hidden"
                 >
                   <option value="vectors">Vektoren</option>
                   <option value="split">Split</option>
                   <option value="threshold">Schwelle</option>
                   <option value="original">Original</option>
                 </select>
               </div>
               
               {(activeTab === 'vectors' || activeTab === 'split') && (
                 <>
                   <div className="w-px h-4 bg-slate-700" />
                   <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                     <Layers className="w-3.5 h-3.5 text-cyan-400" />
                     <span>Hintergrund:</span>
                     <input
                       type="range"
                       min="0"
                       max="100"
                       step="5"
                       value={tracerBgOpacity}
                       onChange={(e) => setTracerBgOpacity(Number(e.target.value))}
                       className="w-24 accent-cyan-400"
                     />
                     <span className="w-8 text-right text-cyan-300">{tracerBgOpacity}%</span>
                   </div>
                 </>
               )}
            </div>

          </div>

          {/* RIGHT SIDEBAR: Settings & Metrics */}
          <div className="w-[320px] bg-slate-900 border-l border-slate-800 flex flex-col shrink-0 overflow-y-auto hidden md:flex">
             <div className="p-4 bg-indigo-950/20 border-b border-indigo-500/20">
                <RasterSettingsPanel
                  settings={settings}
                  onSettingsChange={onSettingsChange}
                  image={image}
                />
             </div>
             
             {/* Trace Result Metrics */}
             <div className="p-4 space-y-3 flex-1 bg-slate-950/50">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Vektorisierungs-Ergebnis</h3>
                <div className="grid grid-cols-2 gap-2">
                   <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-[0.625rem] text-slate-500 mb-1">Pfad-Anzahl</div>
                      <div className="text-sm font-mono font-bold text-slate-200">{polylines.length}</div>
                   </div>
                   <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <div className="text-[0.625rem] text-slate-500 mb-1">Punkte Gesamt</div>
                      <div className="text-sm font-mono font-bold text-slate-200">
                        {polylines.reduce((acc, p) => acc + p.points.length, 0)}
                      </div>
                   </div>
                </div>

                {isTracing && (
                   <div className="p-3 bg-cyan-950/30 border border-cyan-900/50 rounded-lg text-center mt-4 animate-pulse">
                     <span className="text-xs font-semibold text-cyan-400 flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-cyan-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Bild wird verarbeitet...
                     </span>
                   </div>
                )}
             </div>

             {/* Footer Action */}
             <div className="p-4 bg-slate-900 border-t border-slate-800 mt-auto shrink-0">
               <button
                 onClick={onClose}
                 className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-[0.98]"
               >
                 <Check className="w-5 h-5" />
                 <span>Schließen</span>
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
