import re
with open('src/components/ImageTracerLightbox.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    'viewBox={`0 0 ${settings.targetWidth} ${settings.targetHeight}`}',
    'viewBox={`0 0 ${settings.targetWidth} ${settings.targetHeight}`}\n                      preserveAspectRatio="none"'
)

with open('src/components/ImageTracerLightbox.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
