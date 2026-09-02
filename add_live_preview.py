import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add import
if 'import { preprocessImage }' not in text:
    text = text.replace("import { vectorizeImageAsync } from '../services/imageVectorizer';", "import { vectorizeImageAsync } from '../services/imageVectorizer';\nimport { preprocessImage } from '../services/imagePreprocessor';")

# Find the vector trace effect
trace_effect_start = text.find('// --- Asynchronous & Debounced Vector Trace Preview')
if trace_effect_start == -1:
    print("Could not find trace effect")
else:
    # Build the live preview effect
    live_preview = """
    // --- LIVE Instant Black & White Preview (0ms Debounce) ---
    useEffect(() => {
      if (!rasterImage || sourceType !== 'raster') return;
      
      const raf = requestAnimationFrame(() => {
        try {
          const maxDim = 800; // Limit preview size for 60fps performance
          const scale = Math.min(1, maxDim / Math.max(rasterImage.width, rasterImage.height));
          const w = Math.round(rasterImage.width * scale);
          const h = Math.round(rasterImage.height * scale);
          
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          ctx.drawImage(rasterImage, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const processed = preprocessImage(imgData, rasterSettings);
          ctx.putImageData(processed, 0, 0);
          setBwDataUrl(canvas.toDataURL('image/jpeg', 0.8));
        } catch (err) {
          console.error("Live preview error", err);
        }
      });
      return () => cancelAnimationFrame(raf);
    }, [
      sourceType, 
      rasterImage, 
      rasterSettings.threshold, 
      rasterSettings.brightness, 
      rasterSettings.contrast, 
      rasterSettings.invert, 
      rasterSettings.gamma, 
      rasterSettings.blackLevel, 
      rasterSettings.whiteLevel
    ]);

"""
    text = text[:trace_effect_start] + live_preview + text[trace_effect_start:]

    # Remove setBwDataUrl from the slow worker so it doesn't overwrite it lazily
    text = text.replace("if (res.bwDataUrl) setBwDataUrl(res.bwDataUrl);", "// bwDataUrl is now generated instantly on the main thread")

    with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("Added live preview effect")

