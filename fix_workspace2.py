import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

# Add imports
if 'import { RasterSettingsPanel }' not in ws:
    ws = ws.replace("import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';", "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';\nimport { RasterSettingsPanel } from './RasterSettingsPanel';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';\nimport { vectorizeImageAsync } from '../services/imageVectorizer';")

# 1. Replace the Settings UI block with RasterSettingsPanel
settings_start = ws.find('{/* 1. ZIELGRÖSSE & SEITENVERHÄLTNIS-SPERRE (GANZ NACH OBEN VERSCHOBEN) */}')
if settings_start == -1: settings_start = ws.find('{/* 1. ZIELGR')

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

# 2. Replace the old inline Modal with the Lightbox
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
          polylines={rasterPolylines}
          bwDataUrl={bwDataUrl}
          isTracing={isTracing}
        />
      )}'''
        
        ws = ws[:modal_start] + new_modal_jsx + ws[modal_end:]

# 3. Replace the debounced trace with `vectorizeImageAsync`
trace_start = ws.find('// --- Asynchronous & Debounced Vector Trace Preview for 60 FPS UI Smoothness ---')
trace_end = ws.find('// --- Update Processed Image Canvas Preview for Vectorization Menu ---')

if trace_start != -1 and trace_end != -1:
    new_effect = """// --- Asynchronous & Debounced Vector Trace Preview for 60 FPS UI Smoothness ---
  const [bwDataUrl, setBwDataUrl] = useState<string | undefined>();
  
  useEffect(() => {
    if (!rasterImage || sourceType !== 'raster') {
      setRasterPolylines([]);
      setBwDataUrl(undefined);
      setIsTracing(false);
      return;
    }

    setIsTracing(true);

    const timer = setTimeout(async () => {
      try {
        const offscreen = document.createElement('canvas');
        offscreen.width = rasterImage.width;
        offscreen.height = rasterImage.height;
        const ctx = offscreen.getContext('2d');
        if (ctx) {
          ctx.drawImage(rasterImage, 0, 0);
          const imageData = ctx.getImageData(0, 0, rasterImage.width, rasterImage.height);
          const res = await vectorizeImageAsync(imageData, rasterSettings);
          setRasterPolylines(res.polylines || []);
          if (res.bwDataUrl) setBwDataUrl(res.bwDataUrl);
        }
      } catch (err) {
        console.error("Vectorization error:", err);
      } finally {
        setIsTracing(false);
      }
    }, 250); // 250ms debounce for complex trace parameters!

    return () => clearTimeout(timer);
  }, [
    sourceType,
    rasterImage,
    rasterSettings
  ]);

  """
    ws = ws[:trace_start] + new_effect + ws[trace_end:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
