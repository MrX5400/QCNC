import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace handleAddCurrentToComposition body for raster
old_block = """  const handleAddCurrentToComposition = () => {
    let polylinesToAdd = rawPolylines;

    // For raster source, generate high-resolution vectors from full-scale image for clean CNC curves
    if (sourceType === 'raster' && rasterImage) {
      const highResCanvas = document.createElement('canvas');
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(rasterImage.width, rasterImage.height));
      const w = Math.max(10, Math.round(rasterImage.width * scale));
      const h = Math.max(10, Math.round(rasterImage.height * scale));
      highResCanvas.width = w;
      highResCanvas.height = h;
      const ctx = highResCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(rasterImage, 0, 0, w, h);
        const hiResPaths = generateRasterToVectorPaths(highResCanvas, rasterSettings, 1000);
        if (hiResPaths && hiResPaths.length > 0) {
          polylinesToAdd = hiResPaths;
        }
      }
    }

    if (polylinesToAdd.length === 0) return;"""

new_block = """  const handleAddCurrentToComposition = () => {
    let polylinesToAdd = rawPolylines;

    // Convert Image Coordinates (Y-down) to Cartesian CNC Coordinates (Y-up)
    // and strictly avoid downsampling to maintain exact preview geometry!
    if (sourceType === 'raster' && rasterImage) {
      const targetHeight = rasterSettings.targetHeight || 100;
      polylinesToAdd = polylinesToAdd.map(p => ({
        ...p,
        points: p.points.map(pt => ({
          x: pt.x,
          y: targetHeight - pt.y // CNC-Y-Transformation
        }))
      }));
    }

    if (polylinesToAdd.length === 0) return;"""

if old_block in text:
    text = text.replace(old_block, new_block)
else:
    print("WARNING: handleAddCurrentToComposition block not found! Re-trying with regex.")
    match = re.search(r'const handleAddCurrentToComposition = \(\) => \{[\s\S]*?if \(polylinesToAdd\.length === 0\) return;', text)
    if match:
        text = text[:match.start()] + new_block + text[match.end():]
        print("Found with regex and replaced.")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
