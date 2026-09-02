import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

settings_start = ws.find('{/* 1. ZIELGR')
end_btn = ws.find('{/* ADD VECTORIZED GRAPHIC TO CANVAS BUTTON */}', settings_start)

if settings_start != -1 and end_btn != -1:
    new_settings_jsx = """
                  <div className="flex-1 min-h-0 -mx-3 mt-3 border-t border-slate-800 flex flex-col overflow-hidden">
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
    ws = ws[:settings_start] + new_settings_jsx + ws[end_btn:]
    print("Replaced settings.")
else:
    print(f"Error: settings_start={settings_start}, end_btn={end_btn}")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
