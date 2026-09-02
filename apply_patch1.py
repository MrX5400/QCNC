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
start_effect = text.find('// --- Asynchronous & Debounced Vector Trace Preview')
end_effect = text.find('// --- Update Processed Image Canvas Preview')
if start_effect != -1 and end_effect != -1:
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
  ]);

  """
    text = text[:start_effect] + new_effect + text[end_effect:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
