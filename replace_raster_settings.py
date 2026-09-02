import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

idx_start = ws.find("              {sourceType === 'raster' && (")
start = ws.find('<div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-3.5">', idx_start)

# The end is the button
end_btn = ws.find('{/* ADD VECTORIZED GRAPHIC TO CANVAS BUTTON */}', start)
# Wait, I want to keep the upload and preview logic? 
# Maybe I should just replace EVERYTHING inside the sourceType === 'raster' && ( div and use my new layout?
# My new layout:
# 1. Upload Button
# 2. Preview Panel (the one with the Eye and EyeOff icons and 3 tabs)
# 3. RasterSettingsPanel

preview_code_start = ws.find('{/* LIVE INTERACTIVE IMAGE & VECTOR PREVIEW PANEL */}', start)
preview_code_end = ws.find('{/* 2. TRACING ENGINE & VEKTORISIERUNGS-MODUS */}', preview_code_start)

# I can just inject RasterSettingsPanel instead of all the old settings blocks!
# The old settings block starts at:
settings_start = ws.find('{/* 2. TRACING ENGINE & VEKTORISIERUNGS-MODUS */}', start)
settings_end = end_btn

new_settings_jsx = """
                  <div className="flex-1 min-h-0 -mx-3 mt-3 border-t border-slate-800">
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

ws = ws[:settings_start] + new_settings_jsx + ws[settings_end:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)

print("Replaced settings with RasterSettingsPanel!")
