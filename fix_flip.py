import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Flip Y in rawPolylines for raster
old_raw = """  const rawPolylines = useMemo<VectorPolyline[]>(() => {
    if (sourceType === 'text') return textPolylines;
    if (sourceType === 'shapes') return shapePolylines;
    if (sourceType === 'file') return filePolylines;
    if (sourceType === 'raster') return rasterPolylines;
    if (sourceType === 'pdf') return pdfPolylines;
    return [];
  }, [sourceType, textPolylines, shapePolylines, filePolylines, rasterPolylines, pdfPolylines]);"""

new_raw = """  const rawPolylines = useMemo<VectorPolyline[]>(() => {
    if (sourceType === 'text') return textPolylines;
    if (sourceType === 'shapes') return shapePolylines;
    if (sourceType === 'file') return filePolylines;
    if (sourceType === 'raster') {
      const th = rasterSettings.targetHeight || 100;
      return rasterPolylines.map(p => ({
        ...p,
        points: p.points.map(pt => ({ x: pt.x, y: th - pt.y }))
      }));
    }
    if (sourceType === 'pdf') return pdfPolylines;
    return [];
  }, [sourceType, textPolylines, shapePolylines, filePolylines, rasterPolylines, pdfPolylines, rasterSettings.targetHeight]);"""

text = text.replace(old_raw, new_raw)

# 2. Remove the flip from handleAddCurrentToComposition
old_add = """      // Convert Image Coordinates (Y-down) to Cartesian CNC Coordinates (Y-up)
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
      }"""

new_add = """      // Cartesian CNC Coordinates (Y-up) are already handled in rawPolylines!
      // Strictly avoid downsampling to maintain exact preview geometry."""

text = text.replace(old_add, new_add)

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
