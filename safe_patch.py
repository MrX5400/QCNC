import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
if 'import { ImageTracerLightbox }' not in text:
    text = text.replace(
        "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';",
        "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';\nimport { RasterSettingsPanel } from './RasterSettingsPanel';\nimport { vectorizeImageAsync } from '../services/imageVectorizer';"
    )

# 2. State
if 'const [bwDataUrl, setBwDataUrl]' not in text:
    text = text.replace(
        'const [isTracing, setIsTracing] = useState<boolean>(false);',
        'const [isTracing, setIsTracing] = useState<boolean>(false);\n  const [bwDataUrl, setBwDataUrl] = useState<string | undefined>();'
    )

# 3. Effect replacement
start_str = '// --- Asynchronous & Debounced Vector Trace Preview'
end_str = '    rasterSettings.spiralTightness,\n  ]);'

s1 = text.find(start_str)
e1 = text.find(end_str, s1)

if s1 != -1 and e1 != -1:
    e1 += len(end_str)
    new_effect = """// --- Asynchronous & Debounced Vector Trace Preview for 60 FPS UI Smoothness ---
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
    }, 250);

    return () => clearTimeout(timer);
  }, [
    sourceType,
    rasterImage,
    rasterSettings
  ]);"""
    text = text[:s1] + new_effect + text[e1:]

# 4. Inject RasterSettingsPanel
old_ui_start = text.find('{/* 1. ZIELGR')
old_ui_end = text.find('{/* ADD VECTORIZED GRAPHIC TO CANVAS BUTTON */}', old_ui_start)

if old_ui_start != -1 and old_ui_end != -1:
    new_ui = """{/* Raster Settings extracted to Panel */}
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
    text = text[:old_ui_start] + new_ui + text[old_ui_end:]


# 5. Update Lightbox properties
modal_start = text.find('{/* ========================================================================= */}\n      {/* MODAL: Image Trace Lightbox')
if modal_start == -1: modal_start = text.find('{showImageLightbox && rasterImage && (')

if modal_start != -1:
    count = 0
    i = text.find('<div className="fixed inset-0', modal_start)
    if i != -1:
        while count >= 0 and i < len(text):
            if text.startswith('<div', i): count += 1
            elif text.startswith('</div', i):
                count -= 1
                if count == 0:
                    break
            i += 1
        modal_end = text.find(')}', i) + 2
        
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
        
        text = text[:modal_start] + new_modal_jsx + text[modal_end:]


with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
