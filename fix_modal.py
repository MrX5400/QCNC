import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

idx_start = ws.find('{/* ========================================================================= */}\n      {/* MODAL: Image Trace Lightbox & High-Resolution Inspection (USER REQUEST)   */}')
if idx_start == -1:
    idx_start = ws.find('{showImageLightbox && rasterImage && (')

# Find the end of this block
count = 0
i = ws.find('<div className="fixed inset-0', idx_start)
while count >= 0 and i < len(ws):
    if ws.startswith('<div', i): count += 1
    elif ws.startswith('</div', i):
        count -= 1
        if count == 0:
            break
    i += 1

end_idx = ws.find(')}', i) + 2

# We must replace from idx_start to end_idx.
new_jsx = '''      {showImageLightbox && rasterImage && (
        <ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
        />
      )}'''

ws = ws[:idx_start] + new_jsx + ws[end_idx:]

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
    
print("Replaced inline modal!")
