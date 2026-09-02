import re
with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '''                    {rasterImage ? (
                      <>
                        <div 
                          className="h-36 rounded-lg bg-slate-950 border border-slate-800 relative cursor-pointer group flex items-center justify-center overflow-hidden"
                          onClick={() => setShowImageLightbox(true)}
                          title="Klicken für interaktive Vollbild-Vorschau"
                        >
                          <canvas ref={vectorOverlayCanvasRef} className="max-w-full max-h-full object-contain z-10" />
                          <img src={rasterImage.src} className="absolute max-w-full max-h-full object-contain opacity-20 pointer-events-none" alt="" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-white bg-indigo-600/80 px-4 py-2 rounded-full font-bold shadow-lg">
                              <Expand className="w-4 h-4" /> Großansicht öffnen
                            </div>
                          </div>
                        </div>
                      </>
                    ) : ('''

replacement = '''                    {rasterImage ? (
                      <>
                        <div 
                          className="h-36 rounded-lg bg-slate-950 border border-slate-800 relative cursor-pointer group flex items-center justify-center overflow-hidden"
                          onClick={() => setShowImageLightbox(true)}
                          title="Klicken für interaktive Vollbild-Vorschau"
                        >
                          <canvas ref={vectorOverlayCanvasRef} className="max-w-full max-h-full object-contain z-10" style={{ opacity: rasterOpacityVectors / 100 }} />
                          <img src={rasterImage.src} className="absolute max-w-full max-h-full object-contain pointer-events-none" style={{ opacity: rasterOpacityOriginal / 100 }} alt="" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20 backdrop-blur-sm">
                            <div className="flex items-center gap-2 text-white bg-indigo-600/80 px-4 py-2 rounded-full font-bold shadow-lg">
                              <Expand className="w-4 h-4" /> Großansicht öffnen
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[0.55rem] text-slate-400"><span>🖼️ Original</span><span>{rasterOpacityOriginal}%</span></div>
                            <input type="range" min="0" max="100" value={rasterOpacityOriginal} onChange={e => setRasterOpacityOriginal(Number(e.target.value))} className="w-full h-1" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[0.55rem] text-slate-400"><span>⬛ B/W Maske</span><span>{rasterOpacityBW}%</span></div>
                            <input type="range" min="0" max="100" value={rasterOpacityBW} onChange={e => setRasterOpacityBW(Number(e.target.value))} className="w-full h-1" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[0.55rem] text-slate-400"><span>✨ Vektoren</span><span>{rasterOpacityVectors}%</span></div>
                            <input type="range" min="0" max="100" value={rasterOpacityVectors} onChange={e => setRasterOpacityVectors(Number(e.target.value))} className="w-full h-1" />
                          </div>
                          <div className="flex items-center justify-between text-[0.55rem] text-slate-400">
                            <span>Farbe:</span>
                            <div className="flex gap-1">
                              {['#06b6d4', '#10b981', '#ef4444', '#ffffff'].map(c => (
                                <div key={c} onClick={() => setRasterVectorColor(c)} className={w-3 h-3 rounded-full cursor-pointer border } style={{ backgroundColor: c }} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </>
                    ) : ('''

if target in text:
    text = text.replace(target, replacement)
    with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Replaced Karte B!")
else:
    print("Target not found!")
