import re

with open('src/components/Workspace.tsx', 'r', encoding='utf-8') as f:
    ws = f.read()

# Add imports
if 'import { RasterSettingsPanel }' not in ws:
    ws = ws.replace("import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';", "import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';\nimport { RasterSettingsPanel } from './RasterSettingsPanel';\nimport { ImageTracerLightbox } from './ImageTracerLightbox';")

# Replace the inline lightbox with the component
modal_start = ws.find('{/* ========================================================================= */}\n      {/* MODAL: Image Trace Lightbox')
if modal_start == -1: modal_start = ws.find('{showImageLightbox && rasterImage && (')

if modal_start != -1:
    count = 0
    i = ws.find('<div className="fixed inset-0', modal_start)
    if i != -1:
        while count >= 0 and i < len(ws):
            if ws.startswith('<div', i): count += 1
            elif ws.startswith('</div', i):
                count -= 1
                if count == 0:
                    break
            i += 1
        modal_end = ws.find(')}', i) + 2
        
        new_modal_jsx = '''      {showImageLightbox && rasterImage && (
        <ImageTracerLightbox
          isOpen={showImageLightbox}
          onClose={() => setShowImageLightbox(false)}
          image={rasterImage}
          settings={rasterSettings}
          onSettingsChange={setRasterSettings}
        />
      )}'''
        
        ws = ws[:modal_start] + new_modal_jsx + ws[modal_end:]
        print("Replaced Modal.")
    else:
        print("Could not find <div className=\"fixed inset-0")
else:
    print("Could not find modal start.")

with open('src/components/Workspace.tsx', 'w', encoding='utf-8') as f:
    f.write(ws)
