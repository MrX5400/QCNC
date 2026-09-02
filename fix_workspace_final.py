import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add imports
if 'import { vectorizeImageAsync }' not in text:
    text = text.replace("import { ImageTracerLightbox } from './ImageTracerLightbox';", "import { ImageTracerLightbox } from './ImageTracerLightbox';\nimport { vectorizeImageAsync } from '../services/imageVectorizer';")

# 2. Add bwDataUrl state
if 'const [bwDataUrl, setBwDataUrl]' not in text:
    text = text.replace('const [isTracing, setIsTracing] = useState<boolean>(false);', 'const [isTracing, setIsTracing] = useState<boolean>(false);\n  const [bwDataUrl, setBwDataUrl] = useState<string | undefined>();')

# 3. Update the setTimeout trace block
old_trace = """    setIsTracing(true);

    const timer = setTimeout(() => {
      // Dynamic grid sampling based on detailSensitivity (level 1 = 400px, level 5 = 800px, level 10 = 1800px)
      const detailSens = rasterSettings.detailSensitivity ?? 5;
      const targetDim = Math.round(350 + detailSens * 150);
      const offscreen = document.createElement('canvas');
      const scale = Math.min(1, targetDim / Math.max(rasterImage.width, rasterImage.height));
      const w = Math.max(10, Math.round(rasterImage.width * scale));
      const h = Math.max(10, Math.round(rasterImage.height * scale));
      offscreen.width = w;
      offscreen.height = h;

      const ctx = offscreen.getContext('2d');
      if (ctx) {
        ctx.drawImage(rasterImage, 0, 0, w, h);
        const paths = generateRasterToVectorPaths(offscreen, rasterSettings, targetDim);
        setRasterPolylines(paths);
      }
      setIsTracing(false);
    }, 120);"""

new_trace = """    setIsTracing(true);

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
    }, 250);"""

text = text.replace(old_trace, new_trace)

# 4. Inject RasterSettingsPanel
# Find the exact `{/* 1. ZIELGRÖSSE & SEITENVERHÄLTNIS-SPERRE (GANZ NACH OBEN VERSCHOBEN) */}`
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
old_lightbox = """<ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
        />"""

new_lightbox = """<ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
          polylines={rasterPolylines}
          bwDataUrl={bwDataUrl}
          isTracing={isTracing}
        />"""
text = text.replace(old_lightbox, new_lightbox)


with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
