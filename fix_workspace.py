import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Add imageVectorizer import
if 'vectorizeImageAsync' not in text:
    text = text.replace("import { ImageTracerLightbox } from './ImageTracerLightbox';", "import { ImageTracerLightbox } from './ImageTracerLightbox';\nimport { vectorizeImageAsync } from '../services/imageVectorizer';")

# Find the Asynchronous debounced trace effect
start_idx = text.find('// --- Asynchronous & Debounced Vector Trace Preview for 60 FPS UI Smoothness ---')
end_idx = text.find('// --- Update Processed Image Canvas Preview for Vectorization Menu ---')

if start_idx != -1 and end_idx != -1:
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
    text = text[:start_idx] + new_effect + text[end_idx:]

# Also update the ImageTracerLightbox rendering
modal_start = text.find('<ImageTracerLightbox')
if modal_start != -1:
    modal_end = text.find('/>', modal_start) + 2
    new_modal = """<ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
          polylines={rasterPolylines}
          bwDataUrl={bwDataUrl}
          isTracing={isTracing}
        />"""
    text = text[:modal_start] + new_modal + text[modal_end:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
