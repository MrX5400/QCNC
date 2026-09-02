import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

idx_start = ws.find("{sourceType === 'raster' && (")
print("idx_start:", idx_start)

start = ws.find('<div className="space-y-4">', idx_start)
print("start:", start)

end_btn = ws.find('{/* ADD VECTORIZED GRAPHIC TO CANVAS BUTTON */}', start)
print("end_btn:", end_btn)
