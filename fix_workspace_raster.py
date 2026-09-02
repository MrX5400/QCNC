import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

idx_start = ws.find("{sourceType === 'raster' && (")
start = ws.find('<div className="space-y-4">', idx_start)

# Find the add button
end_btn = ws.find('<button \n                  onClick={handleAddCurrentToComposition}', start)
if end_btn == -1: end_btn = ws.find('<button \r\n                  onClick={handleAddCurrentToComposition}', start)
if end_btn == -1: end_btn = ws.find('onClick={handleAddCurrentToComposition}', start)

# Walk back to find the <button>
idx_button = ws.rfind('<button', start, end_btn)

new_jsx = """<div className="space-y-4 flex flex-col h-full">
                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-700 shadow-sm space-y-3 shrink-0">
                    <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                      <ImageIcon className="w-4 h-4" /> Bildquelle & Vorbereitung
                    </div>
                    <label className="border border-dashed border-slate-600 hover:border-cyan-500 rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer transition-colors text-center bg-slate-950/50">
                      <span className="font-semibold text-slate-200 text-xs truncate max-w-[250px]">
                        {rasterImageName ? rasterImageName : 'Bild hochladen (PNG, JPG)'}
                      </span>
                      <input type="file" accept="image/*" onChange={handleRasterImageUpload} className="hidden" />
                    </label>
                  </div>
                  
                  <div className="flex-1 min-h-0 -mx-4">
                    <RasterSettingsPanel 
                      settings={rasterSettings} 
                      onSettingsChange={setRasterSettings} 
                      image={rasterImage} 
                      stats={{
                        paths: rasterPolylines.length,
                        nodes: rasterPolylines.reduce((acc, p) => acc + p.points.length, 0),
                        lengthMm: rasterPolylines.reduce((acc, p) => acc + p.points.reduce((a, pt, i, arr) => i > 0 ? a + Math.hypot(pt.x - arr[i-1].x, pt.y - arr[i-1].y) : a, 0), 0)
                      }}
                    />
                  </div>
                  
                  """

# Replace from start to idx_button
ws = ws[:start] + new_jsx + ws[idx_button:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
    
print("Replaced raster settings with RasterSettingsPanel!")
