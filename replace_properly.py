import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

# Add imports
if 'import { RasterSettingsPanel }' not in ws:
    ws = ws.replace("import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';", "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';\nimport { RasterSettingsPanel } from './RasterSettingsPanel';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';")

# Find the start of the settings block
settings_start = ws.find('{/* 2. TRACING ENGINE & VEKTORISIERUNGS-MODUS */}')
# Find the end (the Add button)
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
    
# Replace the inline lightbox with the component
modal_start = ws.find('{/* ========================================================================= */}\n      {/* MODAL: Image Trace Lightbox')
if modal_start == -1: modal_start = ws.find('{showImageLightbox && rasterImage && (')

if modal_start != -1:
    count = 0
    i = ws.find('<div className="fixed inset-0', modal_start)
    if i != -1:
        while count >= 0 and i < len(ws):
            if ws.startswith('<div', i): count += 1
            elif ws.startswith('</div', i):
                count -= 1
                if count == 0:
                    break
            i += 1
        modal_end = ws.find(')}', i) + 2
        
        new_modal_jsx = '''      {showImageLightbox && rasterImage && (
        <ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
        />
      )}'''
        
        ws = ws[:modal_start] + new_modal_jsx + ws[modal_end:]
        print("Replaced Modal.")
    else:
        print("Could not find <div className=\"fixed inset-0")
else:
    print("Could not find modal start.")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
    
