import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

old_raw = """    if (sourceType === 'raster') {
      return rasterPolylines;
    }"""

new_raw = """    if (sourceType === 'raster') {
      const th = rasterSettings.targetHeight || 100;
      return rasterPolylines.map(p => ({
        ...p,
        points: p.points.map(pt => ({ x: pt.x, y: th - pt.y }))
      }));
    }"""

text = text.replace(old_raw, new_raw)

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
